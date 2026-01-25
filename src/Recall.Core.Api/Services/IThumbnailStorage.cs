namespace Recall.Core.Api.Services;

public interface IThumbnailStorage
{
    Task<Stream?> GetThumbnailAsync(string storageKey, CancellationToken cancellationToken = default);
}