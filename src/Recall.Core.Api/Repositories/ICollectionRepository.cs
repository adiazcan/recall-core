using MongoDB.Bson;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public interface ICollectionRepository
{
    Task<Collection?> GetByIdAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
    Task<CollectionWithCount?> GetWithCountAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CollectionWithCount>> ListWithCountsAsync(string userId, CancellationToken cancellationToken = default);
    Task<Collection> InsertAsync(string userId, Collection collection, CancellationToken cancellationToken = default);
    Task<bool> ReplaceAsync(string userId, Collection collection, CancellationToken cancellationToken = default);
    Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
    Task<long> OrphanItemsAsync(string userId, ObjectId collectionId, CancellationToken cancellationToken = default);
    Task<long> DeleteItemsAsync(string userId, ObjectId collectionId, CancellationToken cancellationToken = default);
}

public sealed record CollectionWithCount(Collection Collection, int ItemCount);