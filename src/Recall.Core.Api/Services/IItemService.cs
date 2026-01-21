using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

public interface IItemService
{
    Task<SaveItemResult> SaveItemAsync(CreateItemRequest request, CancellationToken cancellationToken = default);
    Task<ItemListResponse> ListItemsAsync(
        string? status,
        string? collectionId,
        string? tag,
        bool? isFavorite,
        string? cursor,
        int? limit,
        CancellationToken cancellationToken = default);
}

public sealed record SaveItemResult(Item Item, bool Created);
