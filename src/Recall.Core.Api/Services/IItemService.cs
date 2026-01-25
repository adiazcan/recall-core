using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

public interface IItemService
{
    Task<SaveItemResult> SaveItemAsync(string userId, CreateItemRequest request, CancellationToken cancellationToken = default);
    Task<Item?> GetItemByIdAsync(string userId, string id, CancellationToken cancellationToken = default);
    Task<ItemListResponse> ListItemsAsync(
        string userId,
        string? status,
        string? collectionId,
        string? tag,
        bool? isFavorite,
        string? enrichmentStatus,
        string? cursor,
        int? limit,
        CancellationToken cancellationToken = default);
    Task<Item?> UpdateItemAsync(string userId, string id, UpdateItemRequest request, CancellationToken cancellationToken = default);
    Task<Item?> MarkEnrichmentPendingAsync(string userId, string id, CancellationToken cancellationToken = default);
    Task<bool> DeleteItemAsync(string userId, string id, CancellationToken cancellationToken = default);
}

public sealed record SaveItemResult(Item Item, bool Created);
