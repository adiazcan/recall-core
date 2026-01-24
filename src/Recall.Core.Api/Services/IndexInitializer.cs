using MongoDB.Driver;
using Recall.Core.Api.Entities;

namespace Recall.Core.Api.Services;

public sealed class IndexInitializer(IMongoDatabase database, ILogger<IndexInitializer> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var items = database.GetCollection<Item>("items");
        var itemIndexes = new List<CreateIndexModel<Item>>
        {
            new(
                Builders<Item>.IndexKeys.Ascending(item => item.UserId).Ascending(item => item.NormalizedUrl),
                new CreateIndexOptions { Unique = true, Name = "ux_items_userId_normalizedUrl" }),
            new(
                Builders<Item>.IndexKeys.Ascending(item => item.UserId)
                    .Descending(item => item.CreatedAt)
                    .Descending(item => item.Id),
                new CreateIndexOptions { Name = "ix_items_userId_createdAt_id" }),
            new(
                Builders<Item>.IndexKeys.Ascending(item => item.UserId)
                    .Ascending(item => item.Status)
                    .Descending(item => item.CreatedAt),
                new CreateIndexOptions { Name = "ix_items_userId_status_createdAt" }),
            new(
                Builders<Item>.IndexKeys.Ascending(item => item.UserId)
                    .Ascending(item => item.CollectionId)
                    .Descending(item => item.CreatedAt),
                new CreateIndexOptions { Name = "ix_items_userId_collection_createdAt" }),
            new(
                Builders<Item>.IndexKeys.Ascending(item => item.UserId)
                    .Ascending(item => item.Tags),
                new CreateIndexOptions { Name = "ix_items_userId_tags" })
        };

        await items.Indexes.CreateManyAsync(itemIndexes, cancellationToken);

        var collections = database.GetCollection<Collection>("collections");
        var collectionIndexes = new List<CreateIndexModel<Collection>>
        {
            new(
                Builders<Collection>.IndexKeys.Ascending(collection => collection.UserId)
                    .Ascending(collection => collection.Name),
                new CreateIndexOptions { Unique = true, Name = "ux_collections_userId_name" }),
            new(
                Builders<Collection>.IndexKeys.Ascending(collection => collection.UserId)
                    .Ascending(collection => collection.ParentId),
                new CreateIndexOptions { Name = "ix_collections_userId_parentId" })
        };

        await collections.Indexes.CreateManyAsync(collectionIndexes, cancellationToken);

        logger.LogInformation("MongoDB indexes ensured for items and collections.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
