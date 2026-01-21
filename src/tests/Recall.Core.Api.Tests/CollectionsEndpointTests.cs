using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class CollectionsEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public CollectionsEndpointTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task CreateCollection_ReturnsCreated()
    {
        using var client = CreateClient(out _);

        var response = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Tech Articles",
            Description = "Articles about technology"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(payload);
        Assert.Equal("Tech Articles", payload!.Name);
        Assert.Equal(0, payload.ItemCount);
    }

    [Fact]
    public async Task CreateCollection_DuplicateNameReturnsConflict()
    {
        using var client = CreateClient(out _);

        await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Reading"
        });

        var response = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Reading"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("conflict", error!.Error.Code);
    }

    [Fact]
    public async Task ListCollections_ReturnsItemCounts()
    {
        using var client = CreateClient(out var database);

        var first = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Alpha"
        });
        var second = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Beta"
        });

        var firstCollection = await first.Content.ReadFromJsonAsync<CollectionDto>();
        var secondCollection = await second.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(firstCollection);
        Assert.NotNull(secondCollection);

        var items = database.GetCollection<Item>("items");
        await items.InsertManyAsync(
            [
                BuildItem(firstCollection!.Id, "https://example.com/alpha-1"),
                BuildItem(firstCollection.Id, "https://example.com/alpha-2"),
                BuildItem(secondCollection!.Id, "https://example.com/beta-1")
            ]);

        var response = await client.GetAsync("/api/v1/collections");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CollectionListResponse>();
        Assert.NotNull(payload);

        var alpha = payload!.Collections.Single(c => c.Name == "Alpha");
        var beta = payload.Collections.Single(c => c.Name == "Beta");
        Assert.Equal(2, alpha.ItemCount);
        Assert.Equal(1, beta.ItemCount);
    }

    [Fact]
    public async Task GetCollection_ReturnsItemCount()
    {
        using var client = CreateClient(out var database);

        var createResponse = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Projects"
        });

        var collection = await createResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var items = database.GetCollection<Item>("items");
        await items.InsertOneAsync(BuildItem(collection!.Id, "https://example.com/project"));

        var response = await client.GetAsync($"/api/v1/collections/{collection.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(payload);
        Assert.Equal(1, payload!.ItemCount);
    }

    [Fact]
    public async Task UpdateCollection_ReturnsUpdatedCollection()
    {
        using var client = CreateClient(out _);

        var createResponse = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Reading"
        });

        var collection = await createResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var response = await client.PatchAsJsonAsync($"/api/v1/collections/{collection!.Id}", new UpdateCollectionRequest
        {
            Name = "Reading List",
            Description = "Articles to read"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(payload);
        Assert.Equal("Reading List", payload!.Name);
        Assert.Equal("Articles to read", payload.Description);
    }

    [Fact]
    public async Task DeleteCollection_DefaultOrphansItems()
    {
        using var client = CreateClient(out var database);

        var createResponse = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Inbox"
        });

        var collection = await createResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var items = database.GetCollection<Item>("items");
        await items.InsertOneAsync(BuildItem(collection!.Id, "https://example.com/inbox"));

        var response = await client.DeleteAsync($"/api/v1/collections/{collection.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var orphaned = await items.Find(item => item.CollectionId == null).ToListAsync();
        Assert.Single(orphaned);
    }

    [Fact]
    public async Task DeleteCollection_CascadeDeletesItems()
    {
        using var client = CreateClient(out var database);

        var createResponse = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Trash"
        });

        var collection = await createResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var items = database.GetCollection<Item>("items");
        await items.InsertOneAsync(BuildItem(collection!.Id, "https://example.com/trash"));

        var response = await client.DeleteAsync($"/api/v1/collections/{collection.Id}?mode=cascade");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var remaining = await items.Find(item => item.CollectionId == ObjectId.Parse(collection.Id)).ToListAsync();
        Assert.Empty(remaining);
    }

    private HttpClient CreateClient(out IMongoDatabase database)
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
            });

        var client = factory.CreateClient();
        database = new MongoClient(connectionString).GetDatabase(databaseName);
        return client;
    }

    private static Item BuildItem(string collectionId, string url)
    {
        return new Item
        {
            Id = ObjectId.GenerateNewId(),
            Url = url,
            NormalizedUrl = url,
            Title = null,
            Excerpt = null,
            Status = "unread",
            IsFavorite = false,
            CollectionId = ObjectId.Parse(collectionId),
            Tags = [],
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static string BuildConnectionString(string baseConnectionString, string databaseName)
    {
        if (baseConnectionString.Contains('?', StringComparison.Ordinal))
        {
            var index = baseConnectionString.IndexOf('?', StringComparison.Ordinal);
            var basePart = baseConnectionString.AsSpan(0, index).TrimEnd('/');
            return string.Concat(
                basePart,
                "/",
                databaseName,
                baseConnectionString.AsSpan(index));
        }

        var trimmed = baseConnectionString.TrimEnd('/');
        var connectionString = string.Concat(trimmed, "/", databaseName);

        if (trimmed.Contains('@', StringComparison.Ordinal))
        {
            connectionString = string.Concat(connectionString, "?authSource=admin");
        }

        return connectionString;
    }
}