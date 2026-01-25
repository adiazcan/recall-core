namespace Recall.Core.Enrichment.Services;

public interface IHtmlFetcher
{
    Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default);
    Task<byte[]> FetchBytesAsync(string url, CancellationToken cancellationToken = default);
}
