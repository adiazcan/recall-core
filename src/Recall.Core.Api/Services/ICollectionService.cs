using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

public interface ICollectionService
{
    Task<CollectionDto> CreateCollectionAsync(string userId, CreateCollectionRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CollectionDto>> ListCollectionsAsync(string userId, CancellationToken cancellationToken = default);
    Task<CollectionDto?> GetCollectionAsync(string userId, string id, CancellationToken cancellationToken = default);
    Task<CollectionDto?> UpdateCollectionAsync(
        string userId,
        string id,
        UpdateCollectionRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteCollectionAsync(string userId, string id, string? mode, CancellationToken cancellationToken = default);
}