using MongoDB.Bson;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public interface ICollectionRepository
{
    Task<Collection?> GetByIdAsync(ObjectId id, CancellationToken cancellationToken = default);
    Task<CollectionWithCount?> GetWithCountAsync(ObjectId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CollectionWithCount>> ListWithCountsAsync(CancellationToken cancellationToken = default);
    Task<Collection> InsertAsync(Collection collection, CancellationToken cancellationToken = default);
    Task<bool> ReplaceAsync(Collection collection, CancellationToken cancellationToken = default);
    Task<long> DeleteAsync(ObjectId id, CancellationToken cancellationToken = default);
    Task<long> OrphanItemsAsync(ObjectId collectionId, CancellationToken cancellationToken = default);
    Task<long> DeleteItemsAsync(ObjectId collectionId, CancellationToken cancellationToken = default);
}

public sealed record CollectionWithCount(Collection Collection, int ItemCount);