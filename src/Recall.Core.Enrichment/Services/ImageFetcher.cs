using System.Net.Http;
using Recall.Core.Enrichment.Common.Configuration;

namespace Recall.Core.Enrichment.Services;

public sealed class ImageFetcher : IImageFetcher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EnrichmentOptions _options;
    private readonly ILogger<ImageFetcher> _logger;

    public ImageFetcher(IHttpClientFactory httpClientFactory, EnrichmentOptions options, ILogger<ImageFetcher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public async Task<byte[]> FetchBytesAsync(string url, CancellationToken cancellationToken = default)
    {
        var client = _httpClientFactory.CreateClient("enrichment-fetch");
        client.Timeout = TimeSpan.FromSeconds(_options.ReadTimeoutSeconds);

        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("User-Agent", _options.UserAgent);

        using var response = await client.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Image fetch failed with status {StatusCode} for {Url}",
                (int)response.StatusCode,
                url);
            response.EnsureSuccessStatusCode();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        return await ReadStreamWithLimitAsync(stream, _options.MaxResponseSizeBytes, cancellationToken);
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
