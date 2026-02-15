using System.Collections.Concurrent;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;
using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Api.Services;

public sealed class ItemService(
    IItemRepository repository,
    ICollectionRepository collections,
    ITagRepository tagRepository,
    ITagService tagService,
    ISyncEnrichmentService syncEnrichmentService) : IItemService
{
    private const int MaxTagsPerItem = 50;

    public async Task<SaveItemResult> SaveItemAsync(string userId, CreateItemRequest request, CancellationToken cancellationToken = default)
    {
        var (url, title) = NormalizeRequest(request);
        var normalizedUrl = UrlNormalizer.Normalize(url);

        var existing = await repository.FindByNormalizedUrlAsync(userId, normalizedUrl, cancellationToken);
        if (existing is not null)
        {
            return new SaveItemResult(existing, false, false);
        }

        var now = DateTime.UtcNow;
        var item = new Item
        {
            Url = url,
            NormalizedUrl = normalizedUrl,
            Title = title,
            Excerpt = null,
            ThumbnailStorageKey = null,
            EnrichmentStatus = "pending",
            EnrichmentError = null,
            EnrichedAt = null,
            Status = "unread",
            IsFavorite = false,
            CollectionId = null,
            TagIds = [],
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await repository.InsertAsync(userId, item, cancellationToken);

            var enrichmentResult = await syncEnrichmentService.EnrichAsync(
                item.Url,
                userId,
                item.Id.ToString(),
                cancellationToken);

            var status = enrichmentResult.Error is not null && !enrichmentResult.NeedsAsyncFallback
                ? "failed"
                : enrichmentResult.NeedsAsyncFallback
                    ? "pending"
                    : "succeeded";

            var error = status == "failed" ? enrichmentResult.Error : null;
            DateTime? enrichedAt = status == "succeeded" ? DateTime.UtcNow : null;

            var updates = new List<UpdateDefinition<Item>>
            {
                Builders<Item>.Update.Set(item => item.EnrichmentStatus, status),
                Builders<Item>.Update.Set(item => item.EnrichmentError, error),
                Builders<Item>.Update.Set(item => item.EnrichedAt, enrichedAt),
                Builders<Item>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow)
            };

            if (item.Title is null && enrichmentResult.Title is not null)
            {
                updates.Add(Builders<Item>.Update.Set(item => item.Title, enrichmentResult.Title));
            }

            if (item.Excerpt is null && enrichmentResult.Excerpt is not null)
            {
                updates.Add(Builders<Item>.Update.Set(item => item.Excerpt, enrichmentResult.Excerpt));
            }

            if (enrichmentResult.PreviewImageUrl is not null)
            {
                updates.Add(Builders<Item>.Update.Set(item => item.PreviewImageUrl, enrichmentResult.PreviewImageUrl));
            }

            var update = Builders<Item>.Update.Combine(updates);
            var updated = await repository.UpdateAsync(userId, item.Id, update, cancellationToken);
            if (updated is not null)
            {
                item = updated;
            }
            else
            {
                if (item.Title is null && enrichmentResult.Title is not null)
                {
                    item.Title = enrichmentResult.Title;
                }

                if (item.Excerpt is null && enrichmentResult.Excerpt is not null)
                {
                    item.Excerpt = enrichmentResult.Excerpt;
                }

                item.PreviewImageUrl = enrichmentResult.PreviewImageUrl;
                item.EnrichmentStatus = status;
                item.EnrichmentError = error;
                item.EnrichedAt = enrichedAt;
                item.UpdatedAt = DateTime.UtcNow;
            }

            return new SaveItemResult(item, true, status == "pending");
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            var duplicate = await repository.FindByNormalizedUrlAsync(userId, normalizedUrl, cancellationToken);
            if (duplicate is not null)
            {
                return new SaveItemResult(duplicate, false, false);
            }

            throw;
        }
    }

    public async Task<Item?> GetItemByIdAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        return await repository.GetByIdAsync(userId, objectId, cancellationToken);
    }

    public async Task<ItemListResponse> ListItemsAsync(
        string userId,
        string? status,
        string? collectionId,
        string? tagId,
        bool? isFavorite,
        string? enrichmentStatus,
        string? cursor,
        int? limit,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = NormalizeStatus(status);
        var normalizedTagId = NormalizeTagId(tagId);
        var normalizedEnrichmentStatus = NormalizeEnrichmentStatus(enrichmentStatus);
        var (inboxOnly, collectionObjectId) = NormalizeCollectionFilter(collectionId);
        var (cursorId, cursorCreatedAt) = NormalizeCursor(cursor);
        var pageSize = NormalizeLimit(limit);

        var query = new ItemListQuery(
            userId,
            normalizedStatus,
            collectionObjectId,
            inboxOnly,
            normalizedTagId,
            isFavorite,
            normalizedEnrichmentStatus,
            cursorId,
            cursorCreatedAt,
            pageSize + 1);

        var items = await repository.ListAsync(query, cancellationToken);
        var hasMore = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();
        var tagMap = await GetTagSummaryMapAsync(userId, pageItems.SelectMany(item => item.TagIds), cancellationToken);
        var nextCursor = hasMore
            ? CursorPagination.Encode(pageItems[^1].Id.ToString(), pageItems[^1].CreatedAt)
            : null;

        var dtos = pageItems
            .Select(item => ItemDto.FromEntity(item, ExpandTags(item.TagIds, tagMap)))
            .ToList();
        return new ItemListResponse
        {
            Items = dtos,
            Cursor = nextCursor,
            HasMore = hasMore
        };
    }

    public async Task<Item?> UpdateItemAsync(string userId, string id, UpdateItemRequest request, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        Item? existing = null;

        var updates = new List<UpdateDefinition<Item>>();

        if (request.Title is not null)
        {
            var title = NormalizeOptionalText(request.Title, 500, "Title");
            updates.Add(Builders<Item>.Update.Set(item => item.Title, title));
        }

        if (request.Excerpt is not null)
        {
            var excerpt = NormalizeOptionalText(request.Excerpt, 1000, "Excerpt");
            updates.Add(Builders<Item>.Update.Set(item => item.Excerpt, excerpt));
        }

        if (request.Status is not null)
        {
            var status = NormalizeUpdateStatus(request.Status);
            updates.Add(Builders<Item>.Update.Set(item => item.Status, status));
        }

        if (request.IsFavorite.HasValue)
        {
            updates.Add(Builders<Item>.Update.Set(item => item.IsFavorite, request.IsFavorite.Value));
        }

        if (request.CollectionId is not null)
        {
            var collectionId = await NormalizeCollectionAssignmentAsync(userId, request.CollectionId, cancellationToken);
            updates.Add(Builders<Item>.Update.Set(item => item.CollectionId, collectionId));
        }

        if (request.TagIds is not null || request.NewTagNames is not null)
        {
            existing = await repository.GetByIdAsync(userId, objectId, cancellationToken);
            if (existing is null)
            {
                return null;
            }

            var baseTagIds = request.TagIds is null
                ? existing.TagIds
                : await ResolveExistingTagIdsAsync(userId, ParseObjectIds(request.TagIds), cancellationToken);

            var inlineTagIds = await ResolveInlineTagIdsAsync(userId, request.NewTagNames, cancellationToken);
            var resolvedTagIds = baseTagIds
                .Concat(inlineTagIds)
                .Distinct()
                .ToList();

            if (resolvedTagIds.Count > MaxTagsPerItem)
            {
                throw new RequestValidationException("validation_error", "Items can have at most 50 tags.");
            }

            updates.Add(Builders<Item>.Update.Set(item => item.TagIds, resolvedTagIds));
        }

        if (updates.Count == 0)
        {
            throw new RequestValidationException("validation_error", "At least one field must be provided.");
        }

        updates.Add(Builders<Item>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow));
        var update = Builders<Item>.Update.Combine(updates);
        return await repository.UpdateAsync(userId, objectId, update, cancellationToken);
    }

    public async Task<ItemDto> ToDtoAsync(string userId, Item item, CancellationToken cancellationToken = default)
    {
        var tagMap = await GetTagSummaryMapAsync(userId, item.TagIds, cancellationToken);
        return ItemDto.FromEntity(item, ExpandTags(item.TagIds, tagMap));
    }

    public async Task<Item?> MarkEnrichmentPendingAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        var update = Builders<Item>.Update.Combine(
            Builders<Item>.Update.Set(item => item.EnrichmentStatus, "pending"),
            Builders<Item>.Update.Set(item => item.EnrichmentError, null),
            Builders<Item>.Update.Set(item => item.EnrichedAt, null),
            Builders<Item>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow));
        return await repository.UpdateAsync(userId, objectId, update, cancellationToken);
    }

    public async Task<EnrichItemResult?> EnrichItemAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        var item = await repository.GetByIdAsync(userId, objectId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var pendingUpdate = Builders<Item>.Update.Combine(
            Builders<Item>.Update.Set(target => target.EnrichmentStatus, "pending"),
            Builders<Item>.Update.Set(target => target.EnrichmentError, null),
            Builders<Item>.Update.Set(target => target.EnrichedAt, null),
            Builders<Item>.Update.Set(target => target.UpdatedAt, DateTime.UtcNow));
        var pendingItem = await repository.UpdateAsync(userId, objectId, pendingUpdate, cancellationToken);
        if (pendingItem is not null)
        {
            item = pendingItem;
        }
        else
        {
            item.EnrichmentStatus = "pending";
            item.EnrichmentError = null;
            item.EnrichedAt = null;
            item.UpdatedAt = DateTime.UtcNow;
        }

        var enrichmentResult = await syncEnrichmentService.EnrichAsync(
            item.Url,
            userId,
            item.Id.ToString(),
            cancellationToken);

        var status = enrichmentResult.Error is not null && !enrichmentResult.NeedsAsyncFallback
            ? "failed"
            : enrichmentResult.NeedsAsyncFallback
                ? "pending"
                : "succeeded";

        var error = status == "failed" ? enrichmentResult.Error : null;
        DateTime? enrichedAt = status == "succeeded" ? DateTime.UtcNow : null;

        var updates = new List<UpdateDefinition<Item>>
        {
            Builders<Item>.Update.Set(target => target.EnrichmentStatus, status),
            Builders<Item>.Update.Set(target => target.EnrichmentError, error),
            Builders<Item>.Update.Set(target => target.EnrichedAt, enrichedAt),
            Builders<Item>.Update.Set(target => target.PreviewImageUrl, enrichmentResult.PreviewImageUrl),
            Builders<Item>.Update.Set(target => target.UpdatedAt, DateTime.UtcNow)
        };

        if (enrichmentResult.Title is not null)
        {
            updates.Add(Builders<Item>.Update.Set(target => target.Title, enrichmentResult.Title));
        }

        if (enrichmentResult.Excerpt is not null)
        {
            updates.Add(Builders<Item>.Update.Set(target => target.Excerpt, enrichmentResult.Excerpt));
        }

        var update = Builders<Item>.Update.Combine(updates);
        var updated = await repository.UpdateAsync(userId, item.Id, update, cancellationToken);
        if (updated is not null)
        {
            item = updated;
        }
        else
        {
            if (enrichmentResult.Title is not null)
            {
                item.Title = enrichmentResult.Title;
            }

            if (enrichmentResult.Excerpt is not null)
            {
                item.Excerpt = enrichmentResult.Excerpt;
            }

            item.PreviewImageUrl = enrichmentResult.PreviewImageUrl;
            item.EnrichmentStatus = status;
            item.EnrichmentError = error;
            item.EnrichedAt = enrichedAt;
            item.UpdatedAt = DateTime.UtcNow;
        }

        return new EnrichItemResult(item, status, status == "pending");
    }

    public async Task<bool> DeleteItemAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        var deleted = await repository.DeleteAsync(userId, objectId, cancellationToken);
        return deleted > 0;
    }

    private static (string Url, string? Title) NormalizeRequest(CreateItemRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Url))
        {
            throw new RequestValidationException("validation_error", "URL is required.");
        }

        var url = request.Url.Trim();
        if (url.Length > 2048)
        {
            throw new RequestValidationException("validation_error", "URL must be 2048 characters or fewer.");
        }

        string? title = null;
        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            var trimmedTitle = request.Title.Trim();
            if (trimmedTitle.Length > 500)
            {
                throw new RequestValidationException("validation_error", "Title must be 500 characters or fewer.");
            }

            title = trimmedTitle;
        }

        return (url, title);
    }

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        var normalized = status.Trim().ToLowerInvariant();
        return normalized switch
        {
            "unread" => normalized,
            "archived" => normalized,
            _ => throw new RequestValidationException("validation_error", "Status must be unread or archived.")
        };
    }

    private static ObjectId? NormalizeTagId(string? tagId)
    {
        if (string.IsNullOrWhiteSpace(tagId))
        {
            return null;
        }

        if (!ObjectId.TryParse(tagId, out var objectId))
        {
            throw new RequestValidationException("validation_error", "TagId must be a valid ObjectId.");
        }

        return objectId;
    }

    private static string? NormalizeEnrichmentStatus(string? enrichmentStatus)
    {
        if (string.IsNullOrWhiteSpace(enrichmentStatus))
        {
            return null;
        }

        var normalized = enrichmentStatus.Trim().ToLowerInvariant();
        return normalized switch
        {
            "pending" => normalized,
            "succeeded" => normalized,
            "failed" => normalized,
            _ => throw new RequestValidationException("validation_error", "EnrichmentStatus must be pending, succeeded, or failed.")
        };
    }

    private static string? NormalizeOptionalText(string? value, int maxLength, string fieldName)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
        {
            throw new RequestValidationException("validation_error", $"{fieldName} must be {maxLength} characters or fewer.");
        }

        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string NormalizeUpdateStatus(string status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            throw new RequestValidationException("validation_error", "Status must be unread or archived.");
        }

        var normalized = status.Trim().ToLowerInvariant();
        return normalized switch
        {
            "unread" => normalized,
            "archived" => normalized,
            _ => throw new RequestValidationException("validation_error", "Status must be unread or archived.")
        };
    }

    private static List<ObjectId> ParseObjectIds(IEnumerable<string> ids)
    {
        var objectIds = new List<ObjectId>();
        foreach (var id in ids)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                continue;
            }

            if (ObjectId.TryParse(id, out var objectId))
            {
                objectIds.Add(objectId);
            }
        }

        return objectIds.Distinct().ToList();
    }

    private async Task<List<ObjectId>> ResolveTagIdsAsync(
        string userId,
        IReadOnlyList<string>? requestedTagIds,
        IReadOnlyList<string>? newTagNames,
        CancellationToken cancellationToken)
    {
        var existingTagIds = await ResolveExistingTagIdsAsync(userId, ParseObjectIds(requestedTagIds ?? Array.Empty<string>()), cancellationToken);
        var inlineTagIds = await ResolveInlineTagIdsAsync(userId, newTagNames, cancellationToken);

        var resolved = existingTagIds
            .Concat(inlineTagIds)
            .Distinct()
            .ToList();

        if (resolved.Count > MaxTagsPerItem)
        {
            throw new RequestValidationException("validation_error", "Items can have at most 50 tags.");
        }

        return resolved;
    }

    private async Task<List<ObjectId>> ResolveExistingTagIdsAsync(string userId, IReadOnlyList<ObjectId> tagIds, CancellationToken cancellationToken)
    {
        if (tagIds.Count == 0)
        {
            return [];
        }

        var tags = await tagRepository.GetByIdsAsync(userId, tagIds, cancellationToken);
        return tags.Select(tag => tag.Id).Distinct().ToList();
    }

    private async Task<List<ObjectId>> ResolveInlineTagIdsAsync(string userId, IReadOnlyList<string>? newTagNames, CancellationToken cancellationToken)
    {
        if (newTagNames is null || newTagNames.Count == 0)
        {
            return [];
        }

        var validNames = newTagNames
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name.Trim())
            .Distinct()
            .ToList();

        if (validNames.Count == 0)
        {
            return [];
        }

        // Limit concurrency to avoid bursty DB load with large tag lists
        var results = new ConcurrentBag<TagDto>();
        using var semaphore = new SemaphoreSlim(5, 5); // Max 5 concurrent tag creates

        await Task.WhenAll(validNames.Select(async name =>
        {
            await semaphore.WaitAsync(cancellationToken);
            try
            {
                var result = await tagService.CreateAsync(userId, new CreateTagRequest { Name = name }, cancellationToken);
                results.Add(result.Tag);
            }
            finally
            {
                semaphore.Release();
            }
        }));

        var ids = results
            .Select(result => ObjectId.TryParse(result.Id, out var objectId) ? objectId : (ObjectId?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        return ids;
    }

    private async Task<Dictionary<ObjectId, TagSummaryDto>> GetTagSummaryMapAsync(
        string userId,
        IEnumerable<ObjectId> tagIds,
        CancellationToken cancellationToken)
    {
        var distinctTagIds = tagIds.Distinct().ToList();
        if (distinctTagIds.Count == 0)
        {
            return [];
        }

        var tags = await tagRepository.GetByIdsAsync(userId, distinctTagIds, cancellationToken);
        return tags.ToDictionary(
            tag => tag.Id,
            tag => new TagSummaryDto(tag.Id.ToString(), tag.DisplayName, tag.Color));
    }

    private static IReadOnlyList<TagSummaryDto> ExpandTags(
        IEnumerable<ObjectId> tagIds,
        IReadOnlyDictionary<ObjectId, TagSummaryDto> tagMap)
    {
        return tagIds
            .Select(tagId => tagMap.TryGetValue(tagId, out var summary) ? summary : null)
            .Where(summary => summary is not null)
            .Select(summary => summary!)
            .ToList();
    }

    private async Task<ObjectId?> NormalizeCollectionAssignmentAsync(string userId, string collectionId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(collectionId) || string.Equals(collectionId, "inbox", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (!ObjectId.TryParse(collectionId, out var objectId))
        {
            throw new RequestValidationException("validation_error", "CollectionId must be a valid ObjectId.");
        }

        var collection = await collections.GetByIdAsync(userId, objectId, cancellationToken);
        if (collection is null)
        {
            throw new RequestValidationException("validation_error", "Collection not found.");
        }

        return objectId;
    }

    private static ObjectId ParseObjectId(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value) || !ObjectId.TryParse(value, out var objectId))
        {
            throw new RequestValidationException("validation_error", message);
        }

        return objectId;
    }

    private static (bool InboxOnly, ObjectId? CollectionId) NormalizeCollectionFilter(string? collectionId)
    {
        if (string.IsNullOrWhiteSpace(collectionId))
        {
            return (false, null);
        }

        if (string.Equals(collectionId, "inbox", StringComparison.OrdinalIgnoreCase))
        {
            return (true, null);
        }

        if (!ObjectId.TryParse(collectionId, out var objectId))
        {
            throw new RequestValidationException("validation_error", "CollectionId must be a valid ObjectId or 'inbox'.");
        }

        return (false, objectId);
    }

    private static (ObjectId? Id, DateTime? CreatedAt) NormalizeCursor(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return (null, null);
        }

        if (!CursorPagination.TryDecode(cursor, out var token) || token is null)
        {
            throw new RequestValidationException("validation_error", "Cursor is invalid.");
        }

        if (!ObjectId.TryParse(token.Id, out var objectId))
        {
            throw new RequestValidationException("validation_error", "Cursor is invalid.");
        }

        return (objectId, token.CreatedAt);
    }

    private static int NormalizeLimit(int? limit)
    {
        var pageSize = limit ?? 20;
        if (pageSize < 1 || pageSize > 50)
        {
            throw new RequestValidationException("validation_error", "Limit must be between 1 and 50.");
        }

        return pageSize;
    }
}

public sealed class RequestValidationException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
