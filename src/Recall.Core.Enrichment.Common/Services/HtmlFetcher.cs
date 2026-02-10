using System.Net;
using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Logging;
using Recall.Core.Enrichment.Common.Configuration;
using Recall.Core.Enrichment.Common.Models;

namespace Recall.Core.Enrichment.Common.Services;

public sealed class HtmlFetcher : IHtmlFetcher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ISsrfValidator _ssrfValidator;
    private readonly EnrichmentOptions _options;
    private readonly ILogger<HtmlFetcher> _logger;

    public HtmlFetcher(
        IHttpClientFactory httpClientFactory,
        ISsrfValidator ssrfValidator,
        EnrichmentOptions options,
        ILogger<HtmlFetcher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _ssrfValidator = ssrfValidator;
        _options = options;
        _logger = logger;
    }

    public async Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default)
    {
        var bytes = await FetchContentAsync(url, _options.MaxResponseSizeBytes, _options.FetchTimeoutSeconds, cancellationToken);
        return Encoding.UTF8.GetString(bytes);
    }

    private async Task<byte[]> FetchContentAsync(string url, long maxBytes, int timeoutSeconds, CancellationToken cancellationToken)
    {
        var currentUrl = url;
        var client = _httpClientFactory.CreateClient("enrichment-fetch");
        client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

        for (var redirectCount = 0; redirectCount <= _options.MaxRedirects; redirectCount++)
        {
            await ValidateOrThrowAsync(currentUrl, cancellationToken);

            using var request = new HttpRequestMessage(HttpMethod.Get, currentUrl);
            request.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);

            using var response = await client.SendAsync(
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

    private static async Task<byte[]> ReadStreamWithLimitAsync(Stream stream, long maxBytes, CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        long total = 0;
        using var memoryStream = new MemoryStream();

        while (true)
        {
            var read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
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
