using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public sealed class ItemRepository(IMongoDatabase database) : IItemRepository
{
    private readonly IMongoCollection<Item> _items = database.GetCollection<Item>("items");

    public async Task<Item?> FindByNormalizedUrlAsync(string userId, string normalizedUrl, CancellationToken cancellationToken = default)
    {
        return await _items
            .Find(item => item.UserId == userId && item.NormalizedUrl == normalizedUrl)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Item?> GetByIdAsync(string userId, ObjectId id, CancellationToken cancellationToken = default)
    {
        return await _items
            .Find(item => item.Id == id && item.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Item> InsertAsync(string userId, Item item, CancellationToken cancellationToken = default)
    {
        item.UserId = userId;
        await _items.InsertOneAsync(item, cancellationToken: cancellationToken);
        return item;
    }

    public async Task<IReadOnlyList<Item>> ListAsync(ItemListQuery query, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Item>.Filter.Eq(item => item.UserId, query.UserId);

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            filter &= Builders<Item>.Filter.Eq(item => item.Status, query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.EnrichmentStatus))
        {
            filter &= Builders<Item>.Filter.Eq(item => item.EnrichmentStatus, query.EnrichmentStatus);
        }

        if (query.IsFavorite.HasValue)
        {
            filter &= Builders<Item>.Filter.Eq(item => item.IsFavorite, query.IsFavorite.Value);
        }

        if (query.TagId.HasValue)
        {
            filter &= Builders<Item>.Filter.AnyEq(item => item.TagIds, query.TagId.Value);
        }

        if (query.InboxOnly)
        {
            filter &= Builders<Item>.Filter.Eq(item => item.CollectionId, null);
        }
        else if (query.CollectionId.HasValue)
        {
            filter &= Builders<Item>.Filter.Eq(item => item.CollectionId, query.CollectionId.Value);
        }

        if (query.CursorId.HasValue && query.CursorCreatedAt.HasValue)
        {
            var cursorFilter = Builders<Item>.Filter.Lt(item => item.CreatedAt, query.CursorCreatedAt.Value)
                               | (Builders<Item>.Filter.Eq(item => item.CreatedAt, query.CursorCreatedAt.Value)
                                  & Builders<Item>.Filter.Lt(item => item.Id, query.CursorId.Value));
            filter &= cursorFilter;
        }

        return await _items
            .Find(filter)
            .SortByDescending(item => item.CreatedAt)
            .ThenByDescending(item => item.Id)
            .Limit(query.Limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<Item?> UpdateAsync(string userId, ObjectId id, UpdateDefinition<Item> update, CancellationToken cancellationToken = default)
    {
        var options = new FindOneAndUpdateOptions<Item, Item>
        {
            ReturnDocument = ReturnDocument.After,
            IsUpsert = false
        };

        return await _items.FindOneAndUpdateAsync<Item, Item>(
            item => item.Id == id && item.UserId == userId,
            update,
            options,
            cancellationToken);
    }

    public async Task<bool> UpdateEnrichmentResultAsync(
        string userId,
        ObjectId id,
        string? title,
        string? excerpt,
        string? thumbnailStorageKey,
        string status,
        string? error,
        DateTime? enrichedAt,
        CancellationToken cancellationToken = default)
    {
        var updates = new List<UpdateDefinition<Item>>
        {
            Builders<Item>.Update.Set(item => item.EnrichmentStatus, status),
            Builders<Item>.Update.Set(item => item.EnrichmentError, error),
            Builders<Item>.Update.Set(item => item.EnrichedAt, enrichedAt),
            Builders<Item>.Update.Set(item => item.UpdatedAt, DateTime.UtcNow)
        };

        if (title is not null)
        {
            updates.Add(Builders<Item>.Update.Set(item => item.Title, title));
        }

        if (excerpt is not null)
        {
            updates.Add(Builders<Item>.Update.Set(item => item.Excerpt, excerpt));
        }

        if (thumbnailStorageKey is not null)
        {
            updates.Add(Builders<Item>.Update.Set(item => item.ThumbnailStorageKey, thumbnailStorageKey));
        }

        var update = Builders<Item>.Update.Combine(updates);
        var result = await _items.UpdateOneAsync(
            item => item.Id == id && item.UserId == userId,
            update,
            cancellationToken: cancellationToken);

        return result.MatchedCount > 0 && result.ModifiedCount > 0;
    }

    public async Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken cancellationToken = default)
    {
        var result = await _items.DeleteOneAsync(item => item.Id == id && item.UserId == userId, cancellationToken);
        return result.DeletedCount;
    }

    public async Task<IReadOnlyList<TagIdCount>> GetTagIdCountsAsync(string userId, CancellationToken cancellationToken = default)
    {
        var pipeline = new[]
        {
            new BsonDocument("$match", new BsonDocument("userId", userId)),
            new BsonDocument("$unwind", "$tagIds"),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$tagIds" },
                { "count", new BsonDocument("$sum", 1) }
            })
        };

        var results = await _items
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(cancellationToken);

        return results
            .Where(doc => doc.Contains("_id") && doc.Contains("count") && doc["_id"].IsObjectId)
            .Select(doc => new TagIdCount(doc["_id"].AsObjectId, doc["count"].ToInt32()))
            .ToList();
    }

    public async Task<IReadOnlyList<TagIdCount>> GetTagIdCountsAsync(string userId, IReadOnlyList<ObjectId> tagIds, CancellationToken cancellationToken = default)
    {
        if (tagIds.Count == 0)
        {
            return [];
        }

        var pipeline = new[]
        {
            new BsonDocument("$match", new BsonDocument
            {
                { "userId", userId },
                { "tagIds", new BsonDocument("$in", new BsonArray(tagIds)) }
            }),
            new BsonDocument("$unwind", "$tagIds"),
            new BsonDocument("$match", new BsonDocument("tagIds", new BsonDocument("$in", new BsonArray(tagIds)))),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$tagIds" },
                { "count", new BsonDocument("$sum", 1) }
            })
        };

        var results = await _items
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(cancellationToken);

        return results
            .Where(doc => doc.Contains("_id") && doc.Contains("count") && doc["_id"].IsObjectId)
            .Select(doc => new TagIdCount(doc["_id"].AsObjectId, doc["count"].ToInt32()))
            .ToList();
    }

    public async Task<long> RemoveTagIdFromItemsAsync(string userId, ObjectId tagId, CancellationToken cancellationToken = default)
    {
        var filter = new BsonDocument
        {
            { "userId", userId },
            { "tagIds", tagId }
        };

        var update = new BsonDocument("$pull", new BsonDocument("tagIds", tagId));
        var result = await _items.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
        return result.ModifiedCount;
    }
}
