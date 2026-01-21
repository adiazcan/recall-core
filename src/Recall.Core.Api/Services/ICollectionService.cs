using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

public interface ICollectionService
{
    Task<CollectionDto> CreateCollectionAsync(CreateCollectionRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CollectionDto>> ListCollectionsAsync(CancellationToken cancellationToken = default);
    Task<CollectionDto?> GetCollectionAsync(string id, CancellationToken cancellationToken = default);
    Task<CollectionDto?> UpdateCollectionAsync(
        string id,
        UpdateCollectionRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteCollectionAsync(string id, string? mode, CancellationToken cancellationToken = default);
}