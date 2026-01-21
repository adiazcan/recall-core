using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Repositories;

public sealed class CollectionRepository(IMongoDatabase database) : ICollectionRepository
{
    private readonly IMongoCollection<Collection> _collections = database.GetCollection<Collection>("collections");
    private readonly IMongoCollection<Item> _items = database.GetCollection<Item>("items");

    public async Task<Collection?> GetByIdAsync(ObjectId id, CancellationToken cancellationToken = default)
    {
        return await _collections.Find(collection => collection.Id == id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<CollectionWithCount?> GetWithCountAsync(ObjectId id, CancellationToken cancellationToken = default)
    {
        var pipeline = new[]
        {
            new BsonDocument("$match", new BsonDocument("_id", id)),
            new BsonDocument("$lookup", new BsonDocument
            {
                { "from", "items" },
                { "localField", "_id" },
                { "foreignField", "collectionId" },
                { "as", "items" }
            }),
            new BsonDocument("$addFields", new BsonDocument("itemCount", new BsonDocument("$size", "$items"))),
            new BsonDocument("$project", new BsonDocument
            {
                { "_id", 1 },
                { "name", 1 },
                { "description", 1 },
                { "parentId", 1 },
                { "createdAt", 1 },
                { "updatedAt", 1 },
                { "itemCount", 1 }
            })
        };

        var documents = await _collections
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(cancellationToken);

        var document = documents.FirstOrDefault();
        return document is null ? null : Map(document);
    }

    public async Task<IReadOnlyList<CollectionWithCount>> ListWithCountsAsync(CancellationToken cancellationToken = default)
    {
        var pipeline = new[]
        {
            new BsonDocument("$lookup", new BsonDocument
            {
                { "from", "items" },
                { "localField", "_id" },
                { "foreignField", "collectionId" },
                { "as", "items" }
            }),
            new BsonDocument("$addFields", new BsonDocument("itemCount", new BsonDocument("$size", "$items"))),
            new BsonDocument("$project", new BsonDocument
            {
                { "_id", 1 },
                { "name", 1 },
                { "description", 1 },
                { "parentId", 1 },
                { "createdAt", 1 },
                { "updatedAt", 1 },
                { "itemCount", 1 }
            }),
            new BsonDocument("$sort", new BsonDocument("name", 1))
        };

        var documents = await _collections
            .Aggregate<BsonDocument>(pipeline)
            .ToListAsync(cancellationToken);

        return documents.Select(Map).ToList();
    }

    public async Task<Collection> InsertAsync(Collection collection, CancellationToken cancellationToken = default)
    {
        await _collections.InsertOneAsync(collection, cancellationToken: cancellationToken);
        return collection;
    }

    public async Task<bool> ReplaceAsync(Collection collection, CancellationToken cancellationToken = default)
    {
        var result = await _collections.ReplaceOneAsync(
            existing => existing.Id == collection.Id,
            collection,
            new ReplaceOptions { IsUpsert = false },
            cancellationToken);

        return result.MatchedCount > 0;
    }

    public async Task<long> DeleteAsync(ObjectId id, CancellationToken cancellationToken = default)
    {
        var result = await _collections.DeleteOneAsync(collection => collection.Id == id, cancellationToken);
        return result.DeletedCount;
    }

    public async Task<long> OrphanItemsAsync(ObjectId collectionId, CancellationToken cancellationToken = default)
    {
        var update = Builders<Item>.Update.Set(item => item.CollectionId, null);
        var result = await _items.UpdateManyAsync(item => item.CollectionId == collectionId, update, cancellationToken: cancellationToken);
        return result.MatchedCount;
    }

    public async Task<long> DeleteItemsAsync(ObjectId collectionId, CancellationToken cancellationToken = default)
    {
        var result = await _items.DeleteManyAsync(item => item.CollectionId == collectionId, cancellationToken);
        return result.DeletedCount;
    }

    private static CollectionWithCount Map(BsonDocument document)
    {
        var collection = new Collection
        {
            Id = document["_id"].AsObjectId,
            Name = document["name"].AsString,
            Description = document.TryGetValue("description", out var description) && !description.IsBsonNull
                ? description.AsString
                : null,
            ParentId = document.TryGetValue("parentId", out var parentId) && parentId.IsObjectId
                ? parentId.AsObjectId
                : null,
            CreatedAt = document["createdAt"].ToUniversalTime(),
            UpdatedAt = document["updatedAt"].ToUniversalTime()
        };

        var itemCount = document.TryGetValue("itemCount", out var count) ? count.ToInt32() : 0;
        return new CollectionWithCount(collection, itemCount);
    }
}