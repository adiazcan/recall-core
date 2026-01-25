using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;

namespace Recall.Core.Api.Services;

public sealed class ItemService(IItemRepository repository, ICollectionRepository collections) : IItemService
{
    public async Task<SaveItemResult> SaveItemAsync(string userId, CreateItemRequest request, CancellationToken cancellationToken = default)
    {
        var (url, title, tags) = NormalizeRequest(request);
        var normalizedUrl = UrlNormalizer.Normalize(url);

        var existing = await repository.FindByNormalizedUrlAsync(userId, normalizedUrl, cancellationToken);
        if (existing is not null)
        {
            return new SaveItemResult(existing, false);
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
            Tags = tags,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await repository.InsertAsync(userId, item, cancellationToken);
            return new SaveItemResult(item, true);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            var duplicate = await repository.FindByNormalizedUrlAsync(userId, normalizedUrl, cancellationToken);
            if (duplicate is not null)
            {
                return new SaveItemResult(duplicate, false);
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
        string? tag,
        bool? isFavorite,
        string? enrichmentStatus,
        string? cursor,
        int? limit,
        CancellationToken cancellationToken = default)
    {
        var normalizedStatus = NormalizeStatus(status);
        var normalizedTag = NormalizeTag(tag);
        var normalizedEnrichmentStatus = NormalizeEnrichmentStatus(enrichmentStatus);
        var (inboxOnly, collectionObjectId) = NormalizeCollectionFilter(collectionId);
        var (cursorId, cursorCreatedAt) = NormalizeCursor(cursor);
        var pageSize = NormalizeLimit(limit);

        var query = new ItemListQuery(
            userId,
            normalizedStatus,
            collectionObjectId,
            inboxOnly,
            normalizedTag,
            isFavorite,
            normalizedEnrichmentStatus,
            cursorId,
            cursorCreatedAt,
            pageSize + 1);

        var items = await repository.ListAsync(query, cancellationToken);
        var hasMore = items.Count > pageSize;
        var pageItems = items.Take(pageSize).ToList();
        var nextCursor = hasMore
            ? CursorPagination.Encode(pageItems[^1].Id.ToString(), pageItems[^1].CreatedAt)
            : null;

        var dtos = pageItems.Select(item => ItemDto.FromEntity(item)).ToList();
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

        if (request.Tags is not null)
        {
            var tags = NormalizeTags(request.Tags);
            updates.Add(Builders<Item>.Update.Set(item => item.Tags, tags));
        }

        if (updates.Count == 0)
        {
            throw new RequestValidationException("validation_error", "At least one field must be provided.");
        }

        updates.Add(Builders<Item>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow));
        var update = Builders<Item>.Update.Combine(updates);
        return await repository.UpdateAsync(userId, objectId, update, cancellationToken);
    }

    public async Task<bool> DeleteItemAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "ItemId must be a valid ObjectId.");
        var deleted = await repository.DeleteAsync(userId, objectId, cancellationToken);
        return deleted > 0;
    }

    private static (string Url, string? Title, List<string> Tags) NormalizeRequest(CreateItemRequest request)
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

        var tags = new List<string>();
        if (request.Tags is not null)
        {
            foreach (var tag in request.Tags)
            {
                if (string.IsNullOrWhiteSpace(tag))
                {
                    continue;
                }

                var normalized = tag.Trim().ToLowerInvariant();
                if (normalized.Length > 50)
                {
                    throw new RequestValidationException("validation_error", "Tags must be 50 characters or fewer.");
                }

                tags.Add(normalized);
            }
        }

        tags = tags.Distinct(StringComparer.Ordinal).ToList();
        return (url, title, tags);
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

    private static string? NormalizeTag(string? tag)
    {
        if (string.IsNullOrWhiteSpace(tag))
        {
            return null;
        }

        var normalized = tag.Trim().ToLowerInvariant();
        if (normalized.Length > 50)
        {
            throw new RequestValidationException("validation_error", "Tag must be 50 characters or fewer.");
        }

        return normalized.Length == 0 ? null : normalized;
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

    private static List<string> NormalizeTags(IEnumerable<string> tags)
    {
        var normalizedTags = new List<string>();
        foreach (var tag in tags)
        {
            if (string.IsNullOrWhiteSpace(tag))
            {
                continue;
            }

            var normalized = tag.Trim().ToLowerInvariant();
            if (normalized.Length > 50)
            {
                throw new RequestValidationException("validation_error", "Tags must be 50 characters or fewer.");
            }

            normalizedTags.Add(normalized);
        }

        return normalizedTags.Distinct(StringComparer.Ordinal).ToList();
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
