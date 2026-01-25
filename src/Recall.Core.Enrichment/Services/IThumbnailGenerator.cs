namespace Recall.Core.Enrichment.Services;

public interface IThumbnailGenerator
{
    Task<byte[]?> GenerateAsync(string pageUrl, string? ogImageUrl, CancellationToken cancellationToken = default);
}
