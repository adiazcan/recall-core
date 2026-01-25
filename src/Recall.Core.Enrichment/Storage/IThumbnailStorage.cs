namespace Recall.Core.Enrichment.Storage;

public interface IThumbnailStorage
{
    Task<string?> SaveThumbnailAsync(string userId, string itemId, byte[] imageBytes, CancellationToken cancellationToken = default);
}
