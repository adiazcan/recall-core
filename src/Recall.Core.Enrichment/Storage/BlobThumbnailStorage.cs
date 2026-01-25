using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Recall.Core.Enrichment.Services;

namespace Recall.Core.Enrichment.Storage;

public sealed class BlobThumbnailStorage : IThumbnailStorage
{
    private readonly BlobContainerClient _container;

    public BlobThumbnailStorage(BlobServiceClient client, EnrichmentOptions options)
    {
        _container = client.GetBlobContainerClient(options.ThumbnailContainer);
    }

    public async Task<string?> SaveThumbnailAsync(string userId, string itemId, byte[] imageBytes, CancellationToken cancellationToken = default)
    {
        if (imageBytes.Length == 0)
        {
            return null;
        }

        var key = $"{userId}/{itemId}.jpg";
        await _container.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        var blob = _container.GetBlobClient(key);

        await blob.UploadAsync(
            new BinaryData(imageBytes),
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = "image/jpeg" }
            },
            cancellationToken);

        return key;
    }
}
