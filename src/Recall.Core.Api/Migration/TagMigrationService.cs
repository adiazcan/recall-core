using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Services;
using EntityTag = Recall.Core.Api.Entities.Tag;

namespace Recall.Core.Api.Migration;

public sealed class TagMigrationService(IMongoDatabase database, ILogger<TagMigrationService> logger)
{
    private const int DefaultBatchSize = 100;
    private const int DefaultBatchDelayMs = 100;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    private readonly IMongoCollection<Item> _items = database.GetCollection<Item>("items");
    private readonly IMongoCollection<EntityTag> _tags = database.GetCollection<EntityTag>("tags");

    public async Task<TagMigrationResult> MigrateAsync(
        string exportPath,
        bool dryRun,
        int batchSize = DefaultBatchSize,
        int batchDelayMs = DefaultBatchDelayMs,
        CancellationToken cancellationToken = default)
    {
        if (batchSize <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(batchSize), "Batch size must be greater than 0.");
        }

        if (batchDelayMs < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(batchDelayMs), "Batch delay must be non-negative.");
        }

        var result = new TagMigrationResult { DryRun = dryRun };
        var export = new TagMigrationExport
        {
            MigratedAt = DateTime.UtcNow,
            Metrics = result
        };

        var cache = new Dictionary<TagKey, ObjectId>();
        ObjectId? cursor = null;

        while (true)
        {
            var filter = BuildPendingMigrationFilter(cursor);

            var batch = await _items
                .Find(filter)
                .SortBy(item => item.Id)
                .Limit(batchSize)
                .ToListAsync(cancellationToken);

            if (batch.Count == 0)
            {
                break;
            }

            foreach (var item in batch)
            {
                cancellationToken.ThrowIfCancellationRequested();

                try
                {
                    await MigrateItemAsync(item, export, result, cache, dryRun, cancellationToken);
                }
                catch (Exception ex)
                {
                    result.Errors++;
                    logger.LogError(ex, "Failed to migrate item {ItemId} for user {UserId}", item.Id, item.UserId);
                }
            }

            cursor = batch[^1].Id;

            // Rate limiting: delay between batches to prevent MongoDB overload
            if (batchDelayMs > 0 && batch.Count == batchSize)
            {
                await Task.Delay(batchDelayMs, cancellationToken);
            }
        }

        export.MigratedAt = DateTime.UtcNow;
        var exportJson = JsonSerializer.Serialize(export, JsonOptions);
        await File.WriteAllTextAsync(exportPath, exportJson, cancellationToken);

        return result;
    }

    public async Task<TagRollbackResult> RollbackAsync(
        string importPath,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(importPath))
        {
            throw new FileNotFoundException("Migration import file was not found.", importPath);
        }

        var content = await File.ReadAllTextAsync(importPath, cancellationToken);
        var export = JsonSerializer.Deserialize<TagMigrationExport>(content, JsonOptions)
            ?? throw new InvalidOperationException("Migration import file is invalid.");

        var rollback = new TagRollbackResult();

        foreach (var (userId, userExport) in export.Users)
        {
            foreach (var item in userExport.Items)
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!ObjectId.TryParse(item.ItemId, out var itemId))
                {
                    rollback.Errors++;
                    logger.LogWarning("Skipping rollback entry with invalid itemId {ItemId}", item.ItemId);
                    continue;
                }

                var update = Builders<Item>.Update
                    .Set(entity => entity.Tags, item.OriginalTags)
                    .Set(entity => entity.TagIds, [])
                    .Set(entity => entity.UpdatedAt, DateTime.UtcNow);

                var response = await _items.UpdateOneAsync(
                    entity => entity.UserId == userId && entity.Id == itemId,
                    update,
                    cancellationToken: cancellationToken);

                if (response.MatchedCount == 0)
                {
                    rollback.ItemsSkipped++;
                    continue;
                }

                rollback.ItemsProcessed++;
                rollback.ItemsUpdated += response.ModifiedCount;
            }
        }

        return rollback;
    }

    private async Task MigrateItemAsync(
        Item item,
        TagMigrationExport export,
        TagMigrationResult result,
        Dictionary<TagKey, ObjectId> cache,
        bool dryRun,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(item.UserId) || item.Tags.Count == 0)
        {
            result.ItemsSkipped++;
            return;
        }

        var tagPairs = CollectTagPairs(item, result);
        if (tagPairs.Count == 0)
        {
            result.ItemsSkipped++;
            return;
        }

        var tagIds = new List<ObjectId>(tagPairs.Count);
        foreach (var pair in tagPairs)
        {
            var key = new TagKey(item.UserId, pair.NormalizedName);
            var tagId = await ResolveTagIdAsync(key, pair.DisplayName, result, cache, dryRun, cancellationToken);
            tagIds.Add(tagId);
        }

        if (!dryRun)
        {
            var update = Builders<Item>.Update
                .Set(entity => entity.TagIds, tagIds)
                .Set(entity => entity.UpdatedAt, DateTime.UtcNow);

            var updateResult = await _items.UpdateOneAsync(
                entity => entity.Id == item.Id && entity.UserId == item.UserId,
                update,
                cancellationToken: cancellationToken);

            if (updateResult.ModifiedCount > 0)
            {
                result.ItemsUpdated++;
            }
            else
            {
                result.ItemsSkipped++;
            }
        }
        else
        {
            result.ItemsUpdated++;
        }

        var userExport = GetOrCreateUserExport(export, item.UserId);
        var tagIdsAsStrings = tagIds.Select(id => id.ToString()).ToList();

        foreach (var pair in tagPairs)
        {
            var key = new TagKey(item.UserId, pair.NormalizedName);
            userExport.TagMapping[pair.NormalizedName] = cache[key].ToString();
        }

        userExport.Items.Add(new MigratedItemExport
        {
            ItemId = item.Id.ToString(),
            OriginalTags = [.. item.Tags],
            TagIds = tagIdsAsStrings
        });

        result.ItemsProcessed++;
    }

    private static UserMigrationExport GetOrCreateUserExport(TagMigrationExport export, string userId)
    {
        if (!export.Users.TryGetValue(userId, out var userExport))
        {
            userExport = new UserMigrationExport();
            export.Users[userId] = userExport;
        }

        return userExport;
    }

    private async Task<ObjectId> ResolveTagIdAsync(
        TagKey key,
        string displayName,
        TagMigrationResult result,
        Dictionary<TagKey, ObjectId> cache,
        bool dryRun,
        CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(key, out var cached))
        {
            return cached;
        }

        var existing = await _tags
            .Find(tag => tag.UserId == key.UserId && tag.NormalizedName == key.NormalizedName)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is not null)
        {
            cache[key] = existing.Id;
            return existing.Id;
        }

        if (dryRun)
        {
            var dryRunId = ObjectId.GenerateNewId();
            cache[key] = dryRunId;
            result.TagsCreated++;
            return dryRunId;
        }

        var now = DateTime.UtcNow;
        var filter = Builders<EntityTag>.Filter.Eq(tag => tag.UserId, key.UserId)
                     & Builders<EntityTag>.Filter.Eq(tag => tag.NormalizedName, key.NormalizedName);

        var update = Builders<EntityTag>.Update
            .SetOnInsert(tag => tag.Id, ObjectId.GenerateNewId())
            .SetOnInsert(tag => tag.UserId, key.UserId)
            .SetOnInsert(tag => tag.DisplayName, displayName)
            .SetOnInsert(tag => tag.NormalizedName, key.NormalizedName)
            .SetOnInsert(tag => tag.Color, null)
            .SetOnInsert(tag => tag.CreatedAt, now)
            .SetOnInsert(tag => tag.UpdatedAt, now);

        var options = new FindOneAndUpdateOptions<EntityTag>
        {
            IsUpsert = true,
            ReturnDocument = ReturnDocument.Before
        };

        var before = await _tags.FindOneAndUpdateAsync(filter, update, options, cancellationToken);
        if (before is null)
        {
            result.TagsCreated++;
        }

        var resolved = before ?? await _tags
            .Find(tag => tag.UserId == key.UserId && tag.NormalizedName == key.NormalizedName)
            .FirstAsync(cancellationToken);

        cache[key] = resolved.Id;
        return resolved.Id;
    }

    private List<TagPair> CollectTagPairs(Item item, TagMigrationResult result)
    {
        var unique = new Dictionary<string, string>(StringComparer.Ordinal);
        var validTagCount = 0;

        foreach (var rawTag in item.Tags)
        {
            if (string.IsNullOrWhiteSpace(rawTag))
            {
                continue;
            }

            var displayName = rawTag.Trim();
            if (displayName.Length > TagNormalizer.MaxLength)
            {
                logger.LogWarning(
                    "Truncating tag '{TagName}' to {MaxLength} characters during migration for item {ItemId}",
                    displayName,
                    TagNormalizer.MaxLength,
                    item.Id);

                displayName = displayName[..TagNormalizer.MaxLength];
            }

            var normalizedName = TagNormalizer.Normalize(displayName);
            validTagCount++;

            if (!unique.ContainsKey(normalizedName))
            {
                unique[normalizedName] = displayName;
            }
        }

        result.DuplicatesMerged += Math.Max(0, validTagCount - unique.Count);

        return unique
            .Select(entry => new TagPair(entry.Value, entry.Key))
            .ToList();
    }

    private static FilterDefinition<Item> BuildPendingMigrationFilter(ObjectId? cursor)
    {
        var hasLegacyTags = Builders<Item>.Filter.Exists("tags", true)
                            & Builders<Item>.Filter.Not(Builders<Item>.Filter.Size("tags", 0));

        var missingOrEmptyTagIds = Builders<Item>.Filter.Exists("tagIds", false)
                                 | Builders<Item>.Filter.Size("tagIds", 0);

        var filter = hasLegacyTags & missingOrEmptyTagIds;
        if (cursor.HasValue)
        {
            filter &= Builders<Item>.Filter.Gt(item => item.Id, cursor.Value);
        }

        return filter;
    }

    private sealed record TagKey(string UserId, string NormalizedName);
    private sealed record TagPair(string DisplayName, string NormalizedName);
}

public sealed record TagMigrationResult
{
    public bool DryRun { get; set; }
    public int ItemsProcessed { get; set; }
    public int TagsCreated { get; set; }
    public int DuplicatesMerged { get; set; }
    public int ItemsUpdated { get; set; }
    public int ItemsSkipped { get; set; }
    public int Errors { get; set; }
}

public sealed record TagRollbackResult
{
    public int ItemsProcessed { get; set; }
    public long ItemsUpdated { get; set; }
    public int ItemsSkipped { get; set; }
    public int Errors { get; set; }
}

public sealed record TagMigrationExport
{
    public DateTime MigratedAt { get; set; }
    public Dictionary<string, UserMigrationExport> Users { get; set; } = [];
    public TagMigrationResult Metrics { get; set; } = new();
}

public sealed record UserMigrationExport
{
    public Dictionary<string, string> TagMapping { get; set; } = [];
    public List<MigratedItemExport> Items { get; set; } = [];
}

public sealed record MigratedItemExport
{
    public string ItemId { get; set; } = string.Empty;
    public List<string> OriginalTags { get; set; } = [];
    public List<string> TagIds { get; set; } = [];
}