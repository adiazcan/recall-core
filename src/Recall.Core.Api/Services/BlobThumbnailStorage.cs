using Azure.Storage.Blobs;

namespace Recall.Core.Api.Services;

public sealed class BlobThumbnailStorage : IThumbnailStorage
{
    private readonly BlobContainerClient _container;

    public BlobThumbnailStorage(BlobServiceClient client, EnrichmentOptions options)
    {
        _container = client.GetBlobContainerClient(options.ThumbnailContainer);
    }

    public async Task<Stream?> GetThumbnailAsync(string storageKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            return null;
        }

        var blob = _container.GetBlobClient(storageKey);
        if (!await blob.ExistsAsync(cancellationToken))
        {
            return null;
        }

        var response = await blob.DownloadStreamingAsync(cancellationToken: cancellationToken);
        return response.Value.Content;
    }
}