namespace Recall.Core.Enrichment.Services;

public interface IImageFetcher
{
    Task<byte[]> FetchBytesAsync(string url, CancellationToken cancellationToken = default);
}
