using System.Diagnostics.Metrics;
using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;
using EntityTag = Recall.Core.Api.Entities.Tag;

namespace Recall.Core.Api.Services;

public sealed class TagService : ITagService
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 100;
    private static readonly Regex HexColorRegex = new("^#[0-9A-Fa-f]{6}$", RegexOptions.Compiled);
    private static readonly Meter Meter = new("Recall.Core.Api.Tags", "1.0.0");
    private static readonly Counter<long> TagsCreatedCounter = Meter.CreateCounter<long>("tags.created", "count", "Number of tags created");
    private static readonly Counter<long> TagsDeletedCounter = Meter.CreateCounter<long>("tags.deleted", "count", "Number of tags deleted");
    private static readonly Counter<long> TagsDuplicateHitsCounter = Meter.CreateCounter<long>("tags.duplicate_hits", "count", "Number of duplicate tag creation attempts");

    private readonly ITagRepository tags;
    private readonly IItemRepository items;

    public TagService(ITagRepository tags, IItemRepository items)
    {
        this.tags = tags;
        this.items = items;
    }

    public async Task<CreateTagResult> CreateAsync(string userId, CreateTagRequest request, CancellationToken cancellationToken = default)
    {
        var displayName = NormalizeDisplayName(request.Name);
        var normalizedName = TagNormalizer.Normalize(displayName);
        var color = NormalizeColor(request.Color);

        var existing = await tags.GetByNormalizedNameAsync(userId, normalizedName, cancellationToken);
        if (existing is not null)
        {
            TagsDuplicateHitsCounter.Add(1);
            var existingCount = await GetItemCountAsync(userId, existing.Id, cancellationToken);
            return new CreateTagResult(TagDto.FromEntity(existing, existingCount), false);
        }

        var now = DateTime.UtcNow;
        var candidate = new EntityTag
        {
            Id = ObjectId.GenerateNewId(),
            DisplayName = displayName,
            NormalizedName = normalizedName,
            Color = color,
            UserId = userId,
            CreatedAt = now,
            UpdatedAt = now
        };

        var persisted = await tags.CreateAsync(userId, candidate, cancellationToken);
        var created = persisted.Id == candidate.Id;
        if (created)
        {
            TagsCreatedCounter.Add(1);
        }
        else
        {
            TagsDuplicateHitsCounter.Add(1);
        }

        var itemCount = await GetItemCountAsync(userId, persisted.Id, cancellationToken);
        return new CreateTagResult(TagDto.FromEntity(persisted, itemCount), created);
    }

    public async Task<TagDto?> GetByIdAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "TagId must be a valid ObjectId.");
        var tag = await tags.GetByIdAsync(userId, objectId, cancellationToken);
        if (tag is null)
        {
            return null;
        }

        var itemCount = await GetItemCountAsync(userId, tag.Id, cancellationToken);
        return TagDto.FromEntity(tag, itemCount);
    }

    public async Task<TagListResponse> ListAsync(
        string userId,
        string? query,
        string? cursor,
        int? limit,
        CancellationToken cancellationToken = default)
    {
        var pageSize = NormalizeLimit(limit);
        var normalizedQuery = NormalizeQuery(query);

        IReadOnlyList<EntityTag> fetched;
        try
        {
            fetched = await tags.ListAsync(userId, normalizedQuery, cursor, pageSize + 1, cancellationToken);
        }
        catch (ArgumentException ex) when (ex.ParamName == "cursor")
        {
            throw new RequestValidationException("validation_error", ex.Message);
        }

        var hasMore = fetched.Count > pageSize;
        var page = fetched.Take(pageSize).ToList();

        // Optimize: only fetch counts for tags in current page, not all user's tags
        var tagIds = page.Select(tag => tag.Id).ToList();
        var counts = await items.GetTagIdCountsAsync(userId, tagIds, cancellationToken);
        var countMap = counts.ToDictionary(entry => entry.TagId, entry => entry.Count);

        var dtos = page
            .Select(tag => TagDto.FromEntity(tag, countMap.GetValueOrDefault(tag.Id, 0)))
            .ToList();

        var nextCursor = hasMore
            ? BuildCursor(page[^1])
            : null;

        return new TagListResponse
        {
            Tags = dtos,
            NextCursor = nextCursor,
            HasMore = hasMore
        };
    }

    public async Task<TagDto?> UpdateAsync(string userId, string id, UpdateTagRequest request, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "TagId must be a valid ObjectId.");
        var updates = new List<UpdateDefinition<EntityTag>>();

        if (request.Name is not null)
        {
            var displayName = NormalizeDisplayName(request.Name);
            var normalizedName = TagNormalizer.Normalize(displayName);

            var conflicting = await tags.GetByNormalizedNameAsync(userId, normalizedName, cancellationToken);
            if (conflicting is not null && conflicting.Id != objectId)
            {
                throw new RequestValidationException("duplicate_tag", "A tag with this name already exists.");
            }

            updates.Add(Builders<EntityTag>.Update.Set(tag => tag.DisplayName, displayName));
            updates.Add(Builders<EntityTag>.Update.Set(tag => tag.NormalizedName, normalizedName));
        }

        // Allow clearing color by sending empty string (NormalizeColor converts empty to null)
        if (request.Color is not null)
        {
            var color = NormalizeColor(request.Color);
            updates.Add(Builders<EntityTag>.Update.Set(tag => tag.Color, color));
        }

        if (updates.Count == 0)
        {
            throw new RequestValidationException("validation_error", "At least one field must be provided.");
        }

        updates.Add(Builders<EntityTag>.Update.Set(tag => tag.UpdatedAt, DateTime.UtcNow));
        var update = Builders<EntityTag>.Update.Combine(updates);

        EntityTag? updated;
        try
        {
            updated = await tags.UpdateAsync(userId, objectId, update, cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new RequestValidationException("duplicate_tag", "A tag with this name already exists.");
        }

        if (updated is null)
        {
            return null;
        }

        var itemCount = await GetItemCountAsync(userId, updated.Id, cancellationToken);
        return TagDto.FromEntity(updated, itemCount);
    }

    public async Task<TagDeleteResponse?> DeleteAsync(string userId, string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "TagId must be a valid ObjectId.");

        var existing = await tags.GetByIdAsync(userId, objectId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var itemsUpdated = await items.RemoveTagIdFromItemsAsync(userId, objectId, cancellationToken);
        var deleted = await tags.DeleteAsync(userId, objectId, cancellationToken);
        if (deleted == 0)
        {
            return null;
        }

        TagsDeletedCounter.Add(1);
        return new TagDeleteResponse(id, itemsUpdated);
    }

    private static int NormalizeLimit(int? limit)
    {
        var pageSize = limit ?? DefaultPageSize;
        if (pageSize < 1 || pageSize > MaxPageSize)
        {
            throw new RequestValidationException("validation_error", "Limit must be between 1 and 100.");
        }

        return pageSize;
    }

    private static string NormalizeDisplayName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new RequestValidationException("validation_error", "Tag name is required.");
        }

        var trimmed = name.Trim();
        if (trimmed.Length > TagNormalizer.MaxLength)
        {
            throw new RequestValidationException("validation_error", $"Tag name must be {TagNormalizer.MaxLength} characters or fewer.");
        }

        return trimmed;
    }

    private static string? NormalizeColor(string? color)
    {
        if (string.IsNullOrWhiteSpace(color))
        {
            return null;
        }

        var trimmed = color.Trim();
        if (!HexColorRegex.IsMatch(trimmed))
        {
            throw new RequestValidationException("validation_error", "Color must be a valid hex value like #FF5733.");
        }

        return trimmed.ToUpperInvariant();
    }

    private static string? NormalizeQuery(string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return null;
        }

        var normalized = query.Trim().ToLowerInvariant();
        if (normalized.Length > TagNormalizer.MaxLength)
        {
            throw new RequestValidationException("validation_error", $"Query must be {TagNormalizer.MaxLength} characters or fewer.");
        }

        return normalized;
    }

    private static string BuildCursor(EntityTag tag)
    {
        return $"{tag.NormalizedName}|{tag.Id}";
    }

    private static ObjectId ParseObjectId(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value) || !ObjectId.TryParse(value, out var objectId))
        {
            throw new RequestValidationException("validation_error", message);
        }

        return objectId;
    }

    private async Task<int> GetItemCountAsync(string userId, ObjectId tagId, CancellationToken cancellationToken)
    {
        var counts = await items.GetTagIdCountsAsync(userId, [tagId], cancellationToken);
        var count = counts.FirstOrDefault(entry => entry.TagId == tagId);
        return count?.Count ?? 0;
    }
}
