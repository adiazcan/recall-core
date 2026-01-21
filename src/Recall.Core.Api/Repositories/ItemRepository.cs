using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public sealed class ItemRepository(IMongoDatabase database) : IItemRepository
{
    private readonly IMongoCollection<Item> _items = database.GetCollection<Item>("items");

    public async Task<Item?> FindByNormalizedUrlAsync(string normalizedUrl, CancellationToken cancellationToken = default)
    {
        return await _items
            .Find(item => item.NormalizedUrl == normalizedUrl)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Item?> GetByIdAsync(ObjectId id, CancellationToken cancellationToken = default)
    {
        return await _items
            .Find(item => item.Id == id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Item> InsertAsync(Item item, CancellationToken cancellationToken = default)
    {
        await _items.InsertOneAsync(item, cancellationToken: cancellationToken);
        return item;
    }

    public async Task<IReadOnlyList<Item>> ListAsync(ItemListQuery query, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Item>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            filter &= Builders<Item>.Filter.Eq(item => item.Status, query.Status);
        }

        if (query.IsFavorite.HasValue)
        {
            filter &= Builders<Item>.Filter.Eq(item => item.IsFavorite, query.IsFavorite.Value);
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            filter &= Builders<Item>.Filter.AnyEq(item => item.Tags, query.Tag);
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

    public async Task<Item?> UpdateAsync(ObjectId id, UpdateDefinition<Item> update, CancellationToken cancellationToken = default)
    {
        var options = new FindOneAndUpdateOptions<Item, Item>
        {
            ReturnDocument = ReturnDocument.After,
            IsUpsert = false
        };

        return await _items.FindOneAndUpdateAsync<Item, Item>(
            item => item.Id == id,
            update,
            options,
            cancellationToken);
    }

    public async Task<long> DeleteAsync(ObjectId id, CancellationToken cancellationToken = default)
    {
        var result = await _items.DeleteOneAsync(item => item.Id == id, cancellationToken);
        return result.DeletedCount;
    }

    public async Task<IReadOnlyList<TagCount>> GetAllTagsWithCountsAsync(CancellationToken cancellationToken = default)
    {
        var pipeline = new[]
        {
            new BsonDocument("$unwind", "$tags"),
            new BsonDocument("$group", new BsonDocument
            {
                { "_id", "$tags" },
                { "count", new BsonDocument("$sum", 1) }
            }),
            new BsonDocument("$sort", new BsonDocument("count", -1))
        };

        var results = await _items
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(cancellationToken);

        return results
            .Where(doc => doc.Contains("_id") && doc.Contains("count") && doc["_id"].IsString)
            .Select(doc => new TagCount(doc["_id"].AsString, doc["count"].ToInt32()))
            .ToList();
    }

    public async Task<long> RenameTagAsync(string oldTag, string newTag, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Item>.Filter.AnyEq(item => item.Tags, oldTag);
        var update = Builders<Item>.Update.Set("tags.$[tag]", newTag);
        var options = new UpdateOptions
        {
            ArrayFilters =
            [
                new BsonDocumentArrayFilterDefinition<BsonDocument>(new BsonDocument("tag", oldTag))
            ]
        };

        var result = await _items.UpdateManyAsync(filter, update, options, cancellationToken);
        return result.MatchedCount;
    }

    public async Task<long> DeleteTagAsync(string tag, CancellationToken cancellationToken = default)
    {
        var filter = Builders<Item>.Filter.AnyEq(item => item.Tags, tag);
        var update = Builders<Item>.Update.Pull(item => item.Tags, tag);
        var result = await _items.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);
        return result.MatchedCount;
    }
}
