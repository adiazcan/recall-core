using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public interface IItemRepository
{
    Task<Item?> FindByNormalizedUrlAsync(string userId, string normalizedUrl, CancellationToken cancellationToken = default);
    Task<Item?> GetByIdAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
    Task<Item> InsertAsync(string userId, Item item, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Item>> ListAsync(ItemListQuery query, CancellationToken cancellationToken = default);
    Task<Item?> UpdateAsync(string userId, ObjectId id, UpdateDefinition<Item> update, CancellationToken cancellationToken = default);
    Task<bool> UpdateEnrichmentResultAsync(
        string userId,
        ObjectId id,
        string? title,
        string? excerpt,
        string? thumbnailStorageKey,
        string status,
        string? error,
        DateTime? enrichedAt,
        CancellationToken cancellationToken = default);
    Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TagCount>> GetAllTagsWithCountsAsync(string userId, CancellationToken cancellationToken = default);
    Task<long> RenameTagAsync(string userId, string oldTag, string newTag, CancellationToken cancellationToken = default);
    Task<long> DeleteTagAsync(string userId, string tag, CancellationToken cancellationToken = default);
}

public sealed record ItemListQuery(
    string UserId,
    string? Status,
    ObjectId? CollectionId,
    bool InboxOnly,
    string? Tag,
    bool? IsFavorite,
    string? EnrichmentStatus,
    ObjectId? CursorId,
    DateTime? CursorCreatedAt,
    int Limit);

public sealed record TagCount(string Name, int Count);
