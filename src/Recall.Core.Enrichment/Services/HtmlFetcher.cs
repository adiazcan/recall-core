using System.Net;
using System.Net.Http;

namespace Recall.Core.Enrichment.Services;

public sealed class HtmlFetcher : IHtmlFetcher, IDisposable
{
    private readonly ISsrfValidator _ssrfValidator;
    private readonly EnrichmentOptions _options;
    private readonly ILogger<HtmlFetcher> _logger;
    private readonly HttpClient _httpClient;

    public HtmlFetcher(ISsrfValidator ssrfValidator, EnrichmentOptions options, ILogger<HtmlFetcher> logger)
    {
        _ssrfValidator = ssrfValidator;
        _options = options;
        _logger = logger;

        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.All,
            ConnectTimeout = TimeSpan.FromSeconds(_options.ConnectTimeoutSeconds)
        };

        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(_options.FetchTimeoutSeconds)
        };
    }

    public async Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default)
    {
        var bytes = await FetchContentAsync(url, _options.MaxHtmlSizeBytes, cancellationToken);
        return System.Text.Encoding.UTF8.GetString(bytes);
    }

    public Task<byte[]> FetchBytesAsync(string url, CancellationToken cancellationToken = default)
    {
        return FetchContentAsync(url, _options.MaxHtmlSizeBytes, cancellationToken);
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }

    private async Task<byte[]> FetchContentAsync(string url, int maxBytes, CancellationToken cancellationToken)
    {
        var currentUrl = url;
        for (var redirectCount = 0; redirectCount <= _options.MaxRedirects; redirectCount++)
        {
            await ValidateOrThrowAsync(currentUrl, cancellationToken);

            using var request = new HttpRequestMessage(HttpMethod.Get, currentUrl);
            request.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);

            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (IsRedirect(response.StatusCode))
            {
                if (response.Headers.Location is null)
                {
                    throw new InvalidOperationException("Redirect response missing location header.");
                }

                currentUrl = new Uri(new Uri(currentUrl), response.Headers.Location).ToString();
                continue;
            }

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Fetch failed with status {StatusCode} for {Url}",
                    (int)response.StatusCode,
                    currentUrl);
                response.EnsureSuccessStatusCode();
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await ReadStreamWithLimitAsync(stream, maxBytes, cancellationToken);
        }

        throw new InvalidOperationException("Too many redirects.");
    }

    private async Task ValidateOrThrowAsync(string url, CancellationToken cancellationToken)
    {
        var result = await _ssrfValidator.ValidateAsync(url, cancellationToken);
        if (!result.IsAllowed)
        {
            throw new SsrfBlockedException(result.ErrorMessage ?? "URL blocked.");
        }
    }

    private static bool IsRedirect(HttpStatusCode statusCode)
    {
        var code = (int)statusCode;
        return code is >= 300 and < 400;
    }

    private static async Task<byte[]> ReadStreamWithLimitAsync(Stream stream, int maxBytes, CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        var total = 0;
        using var memoryStream = new MemoryStream();

        while (true)
        {
            var read = await stream.ReadAsync(buffer, cancellationToken);
            if (read == 0)
            {
                break;
            }

            total += read;
            if (total > maxBytes)
            {
                throw new InvalidOperationException("Response too large.");
            }

            await memoryStream.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }

        return memoryStream.ToArray();
    }
}

public sealed class SsrfBlockedException(string message) : Exception(message);
