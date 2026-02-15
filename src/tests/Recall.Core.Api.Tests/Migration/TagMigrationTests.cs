using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Migration;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class TagMigrationTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public TagMigrationTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task Migrate_BasicMigration_ConvertsTagsToTagIdsAndExportsJson()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");
        var tags = database.GetCollection<BsonDocument>("tags");
        var itemId = ObjectId.GenerateNewId();

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", itemId },
            { "url", "https://example.com/migrate-basic" },
            { "normalizedUrl", "example.com/migrate-basic" },
            { "tags", new BsonArray(["JavaScript", "Recipes"]) },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-basic-{Guid.NewGuid():N}.json");
        try
        {
            var result = await service.MigrateAsync(exportPath, dryRun: false);

            Assert.Equal(1, result.ItemsProcessed);
            Assert.Equal(2, result.TagsCreated);
            Assert.Equal(1, result.ItemsUpdated);
            Assert.Equal(0, result.Errors);

            var migratedItem = await items.Find(new BsonDocument("_id", itemId)).FirstAsync();
            Assert.Equal(2, migratedItem["tagIds"].AsBsonArray.Count);

            var tagCount = await tags.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty);
            Assert.Equal(2, tagCount);

            Assert.True(File.Exists(exportPath));
            var json = await File.ReadAllTextAsync(exportPath);
            using var document = JsonDocument.Parse(json);
            Assert.True(document.RootElement.TryGetProperty("migratedAt", out _));
            Assert.True(document.RootElement.TryGetProperty("users", out var users));
            Assert.True(users.TryGetProperty("user-a", out var userEntry));
            Assert.True(userEntry.TryGetProperty("items", out var migratedItems));
            Assert.Equal(1, migratedItems.GetArrayLength());
            Assert.True(document.RootElement.TryGetProperty("metrics", out var metrics));
            Assert.Equal(1, metrics.GetProperty("itemsProcessed").GetInt32());
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    [Fact]
    public async Task Migrate_DeduplicatesCaseVariants_IntoSingleTag()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");
        var tags = database.GetCollection<BsonDocument>("tags");

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "url", "https://example.com/dedup" },
            { "normalizedUrl", "example.com/dedup" },
            { "tags", new BsonArray(["JavaScript", "javascript", "JAVASCRIPT"]) },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-dedup-{Guid.NewGuid():N}.json");
        try
        {
            var result = await service.MigrateAsync(exportPath, dryRun: false);

            Assert.Equal(1, result.ItemsProcessed);
            Assert.Equal(1, result.TagsCreated);
            Assert.Equal(2, result.DuplicatesMerged);

            var tagCount = await tags.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty);
            Assert.Equal(1, tagCount);

            var item = await items.Find(new BsonDocument("userId", "user-a")).FirstAsync();
            Assert.Single(item["tagIds"].AsBsonArray);
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    [Fact]
    public async Task Migrate_SkipsItemsWithEmptyTags()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "url", "https://example.com/empty-tags" },
            { "normalizedUrl", "example.com/empty-tags" },
            { "tags", new BsonArray() },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-empty-{Guid.NewGuid():N}.json");
        try
        {
            var result = await service.MigrateAsync(exportPath, dryRun: false);
            Assert.Equal(0, result.ItemsProcessed);
            Assert.Equal(0, result.ItemsUpdated);
            Assert.Equal(0, result.TagsCreated);
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    [Fact]
    public async Task Migrate_CreatesSeparateTagsPerUser_ForSameName()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");
        var tags = database.GetCollection<BsonDocument>("tags");

        await items.InsertManyAsync([
            new BsonDocument
            {
                { "_id", ObjectId.GenerateNewId() },
                { "url", "https://example.com/u1" },
                { "normalizedUrl", "example.com/u1" },
                { "tags", new BsonArray(["React"]) },
                { "tagIds", new BsonArray() },
                { "userId", "user-1" },
                { "createdAt", DateTime.UtcNow },
                { "updatedAt", DateTime.UtcNow },
                { "status", "unread" },
                { "isFavorite", false },
                { "enrichmentStatus", "pending" }
            },
            new BsonDocument
            {
                { "_id", ObjectId.GenerateNewId() },
                { "url", "https://example.com/u2" },
                { "normalizedUrl", "example.com/u2" },
                { "tags", new BsonArray(["React"]) },
                { "tagIds", new BsonArray() },
                { "userId", "user-2" },
                { "createdAt", DateTime.UtcNow },
                { "updatedAt", DateTime.UtcNow },
                { "status", "unread" },
                { "isFavorite", false },
                { "enrichmentStatus", "pending" }
            }
        ]);

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-users-{Guid.NewGuid():N}.json");
        try
        {
            var result = await service.MigrateAsync(exportPath, dryRun: false);
            Assert.Equal(2, result.ItemsProcessed);
            Assert.Equal(2, result.TagsCreated);

            var allTags = await tags.Find(FilterDefinition<BsonDocument>.Empty).ToListAsync();
            Assert.Equal(2, allTags.Count);
            Assert.Equal(2, allTags.Select(t => t["userId"].AsString).Distinct().Count());
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    [Fact]
    public async Task Migrate_IsIdempotent_WhenRunTwice()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "url", "https://example.com/idempotent" },
            { "normalizedUrl", "example.com/idempotent" },
            { "tags", new BsonArray(["DotNet"]) },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var firstExport = Path.Combine(Path.GetTempPath(), $"migration-first-{Guid.NewGuid():N}.json");
        var secondExport = Path.Combine(Path.GetTempPath(), $"migration-second-{Guid.NewGuid():N}.json");
        try
        {
            var first = await service.MigrateAsync(firstExport, dryRun: false);
            var second = await service.MigrateAsync(secondExport, dryRun: false);

            Assert.Equal(1, first.ItemsProcessed);
            Assert.Equal(1, first.ItemsUpdated);
            Assert.Equal(0, second.ItemsProcessed);
            Assert.Equal(0, second.ItemsUpdated);
            Assert.Equal(0, second.TagsCreated);
        }
        finally
        {
            if (File.Exists(firstExport))
            {
                File.Delete(firstExport);
            }

            if (File.Exists(secondExport))
            {
                File.Delete(secondExport);
            }
        }
    }

    [Fact]
    public async Task Rollback_RestoresOriginalTags_AndClearsTagIds()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");
        var itemId = ObjectId.GenerateNewId();

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", itemId },
            { "url", "https://example.com/rollback" },
            { "normalizedUrl", "example.com/rollback" },
            { "tags", new BsonArray(["Before", "After"]) },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-rollback-{Guid.NewGuid():N}.json");
        try
        {
            await service.MigrateAsync(exportPath, dryRun: false);

            var migrated = await items.Find(new BsonDocument("_id", itemId)).FirstAsync();
            Assert.True(migrated["tagIds"].AsBsonArray.Count > 0);

            var rollbackResult = await service.RollbackAsync(exportPath);
            Assert.True(rollbackResult.ItemsProcessed > 0);
            Assert.True(rollbackResult.ItemsUpdated > 0);

            var restored = await items.Find(new BsonDocument("_id", itemId)).FirstAsync();
            var restoredTags = restored["tags"].AsBsonArray.Select(entry => entry.AsString).ToArray();
            Assert.Equal("Before", restoredTags[0]);
            Assert.Equal("After", restoredTags[1]);
            Assert.Empty(restored["tagIds"].AsBsonArray);
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    [Fact]
    public async Task Migrate_TruncatesTagsLongerThan50Characters()
    {
        var database = CreateDatabase();
        var service = new TagMigrationService(database, NullLogger<TagMigrationService>.Instance);
        var items = database.GetCollection<BsonDocument>("items");
        var tags = database.GetCollection<BsonDocument>("tags");
        var longTag = new string('x', 60);

        await items.InsertOneAsync(new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "url", "https://example.com/long-tag" },
            { "normalizedUrl", "example.com/long-tag" },
            { "tags", new BsonArray([longTag]) },
            { "tagIds", new BsonArray() },
            { "userId", "user-a" },
            { "createdAt", DateTime.UtcNow },
            { "updatedAt", DateTime.UtcNow },
            { "status", "unread" },
            { "isFavorite", false },
            { "enrichmentStatus", "pending" }
        });

        var exportPath = Path.Combine(Path.GetTempPath(), $"migration-truncate-{Guid.NewGuid():N}.json");
        try
        {
            await service.MigrateAsync(exportPath, dryRun: false);

            var migratedTag = await tags.Find(new BsonDocument("userId", "user-a")).FirstAsync();
            Assert.Equal(50, migratedTag["displayName"].AsString.Length);
            Assert.Equal(50, migratedTag["normalizedName"].AsString.Length);
        }
        finally
        {
            if (File.Exists(exportPath))
            {
                File.Delete(exportPath);
            }
        }
    }

    private IMongoDatabase CreateDatabase()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);
        var client = new MongoClient(connectionString);
        return client.GetDatabase(databaseName);
    }
}