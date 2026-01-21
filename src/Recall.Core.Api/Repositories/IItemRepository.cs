using MongoDB.Bson;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public interface IItemRepository
{
    Task<Item?> FindByNormalizedUrlAsync(string normalizedUrl, CancellationToken cancellationToken = default);
    Task<Item> InsertAsync(Item item, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Item>> ListAsync(ItemListQuery query, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TagCount>> GetAllTagsWithCountsAsync(CancellationToken cancellationToken = default);
    Task<long> RenameTagAsync(string oldTag, string newTag, CancellationToken cancellationToken = default);
    Task<long> DeleteTagAsync(string tag, CancellationToken cancellationToken = default);
}

public sealed record ItemListQuery(
    string? Status,
    ObjectId? CollectionId,
    bool InboxOnly,
    string? Tag,
    bool? IsFavorite,
    ObjectId? CursorId,
    DateTime? CursorCreatedAt,
    int Limit);

public sealed record TagCount(string Name, int Count);
