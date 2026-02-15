using System.Net;
using System.Net.Http.Json;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc.Testing;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Models;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class TagsEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;
    private const string TestUserId = "test-user-123";

    public TagsEndpointTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task CreateTag_ReturnsCreatedWithAllFields()
    {
        using var testClient = CreateClient();
        var stopwatch = Stopwatch.StartNew();
        var response = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = "JavaScript"
        });
        stopwatch.Stop();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(3), $"POST /api/v1/tags exceeded 3s ({stopwatch.Elapsed}).");

        var payload = await response.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(payload);
        Assert.False(string.IsNullOrWhiteSpace(payload!.Id));
        Assert.Equal("JavaScript", payload.DisplayName);
        Assert.Equal("javascript", payload.NormalizedName);
        Assert.Null(payload.Color);
        Assert.Equal(0, payload.ItemCount);
        Assert.False(string.IsNullOrWhiteSpace(payload.CreatedAt));
        Assert.False(string.IsNullOrWhiteSpace(payload.UpdatedAt));
    }

    [Fact]
    public async Task CreateTag_DuplicateReturnsExistingWithOk()
    {
        using var testClient = CreateClient();
        var first = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = "JavaScript"
        });

        var created = await first.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(created);

        var second = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = "javascript"
        });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);

        var duplicate = await second.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(duplicate);
        Assert.Equal(created!.Id, duplicate!.Id);
        Assert.Equal("JavaScript", duplicate.DisplayName);
    }

    [Fact]
    public async Task CreateTag_WithColorReturnsCreated()
    {
        using var testClient = CreateClient();
        var response = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = "Recipes",
            Color = "#FF5733"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(payload);
        Assert.Equal("#FF5733", payload!.Color);
    }

    [Fact]
    public async Task ListTags_ReturnsTagsWithItemCounts_AndSupportsSearch()
    {
        using var testClient = CreateClient();
        var java = await CreateTagAsync(testClient.Client, "JavaScript");
        var recipes = await CreateTagAsync(testClient.Client, "Recipes");

        await SeedItemWithTagIdsAsync(testClient.ConnectionString, testClient.DatabaseName, TestUserId, java.Id, recipes.Id);
        await SeedItemWithTagIdsAsync(testClient.ConnectionString, testClient.DatabaseName, TestUserId, java.Id);

        var listResponse = await testClient.Client.GetAsync("/api/v1/tags");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var listPayload = await listResponse.Content.ReadFromJsonAsync<TagListResponse>();
        Assert.NotNull(listPayload);
        Assert.True(listPayload!.Tags.Count >= 2);

        var javaTag = listPayload.Tags.Single(tag => tag.Id == java.Id);
        var recipesTag = listPayload.Tags.Single(tag => tag.Id == recipes.Id);
        Assert.Equal(2, javaTag.ItemCount);
        Assert.Equal(1, recipesTag.ItemCount);

        var searchResponse = await testClient.Client.GetAsync("/api/v1/tags?q=java");
        Assert.Equal(HttpStatusCode.OK, searchResponse.StatusCode);

        var searchPayload = await searchResponse.Content.ReadFromJsonAsync<TagListResponse>();
        Assert.NotNull(searchPayload);
        Assert.Single(searchPayload!.Tags);
        Assert.Equal(java.Id, searchPayload.Tags[0].Id);
    }

    [Fact]
    public async Task GetTagById_ReturnsTag()
    {
        using var testClient = CreateClient();
        var tag = await CreateTagAsync(testClient.Client, "Tech");

        var response = await testClient.Client.GetAsync($"/api/v1/tags/{tag.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(payload);
        Assert.Equal(tag.Id, payload!.Id);
        Assert.Equal("Tech", payload.DisplayName);
    }

    [Fact]
    public async Task GetTagById_NonExistentReturnsNotFound()
    {
        using var testClient = CreateClient();
        var response = await testClient.Client.GetAsync($"/api/v1/tags/{ObjectId.GenerateNewId()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTag_RenameReturnsOk()
    {
        using var testClient = CreateClient();
        var tag = await CreateTagAsync(testClient.Client, "JavaScript");

        var stopwatch = Stopwatch.StartNew();
        var response = await testClient.Client.PatchAsJsonAsync($"/api/v1/tags/{tag.Id}", new UpdateTagRequest
        {
            Name = "TypeScript"
        });
        stopwatch.Stop();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(3), $"PATCH /api/v1/tags/{{id}} exceeded 3s ({stopwatch.Elapsed}).");

        var payload = await response.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(payload);
        Assert.Equal("TypeScript", payload!.DisplayName);
        Assert.Equal("typescript", payload.NormalizedName);
    }

    [Fact]
    public async Task UpdateTag_RenameConflictReturnsConflict()
    {
        using var testClient = CreateClient();
        var source = await CreateTagAsync(testClient.Client, "JavaScript");
        await CreateTagAsync(testClient.Client, "TypeScript");

        var response = await testClient.Client.PatchAsJsonAsync($"/api/v1/tags/{source.Id}", new UpdateTagRequest
        {
            Name = "TypeScript"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(payload);
        Assert.Equal("duplicate_tag", payload!.Error.Code);
    }

    [Fact]
    public async Task DeleteTag_ReturnsItemsUpdated()
    {
        using var testClient = CreateClient();
        var tag = await CreateTagAsync(testClient.Client, "Obsolete");
        await SeedItemWithTagIdsAsync(testClient.ConnectionString, testClient.DatabaseName, TestUserId, tag.Id);
        await SeedItemWithTagIdsAsync(testClient.ConnectionString, testClient.DatabaseName, TestUserId, tag.Id);

        var stopwatch = Stopwatch.StartNew();
        var response = await testClient.Client.DeleteAsync($"/api/v1/tags/{tag.Id}");
        stopwatch.Stop();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(3), $"DELETE /api/v1/tags/{{id}} exceeded 3s ({stopwatch.Elapsed}).");

        var payload = await response.Content.ReadFromJsonAsync<TagDeleteResponse>();
        Assert.NotNull(payload);
        Assert.Equal(tag.Id, payload!.Id);
        Assert.Equal(2, payload.ItemsUpdated);
    }

    [Fact]
    public async Task DeleteTag_NonExistentReturnsNotFound()
    {
        using var testClient = CreateClient();
        var response = await testClient.Client.DeleteAsync($"/api/v1/tags/{ObjectId.GenerateNewId()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task CreateTag_InvalidNameConstraintsReturnBadRequest()
    {
        using var testClient = CreateClient();

        var emptyResponse = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = "   "
        });

        Assert.Equal(HttpStatusCode.BadRequest, emptyResponse.StatusCode);

        var longResponse = await testClient.Client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = new string('a', 51)
        });

        Assert.Equal(HttpStatusCode.BadRequest, longResponse.StatusCode);
    }

    private static async Task<TagDto> CreateTagAsync(HttpClient client, string name, string? color = null)
    {
        var response = await client.PostAsJsonAsync("/api/v1/tags", new CreateTagRequest
        {
            Name = name,
            Color = color
        });

        Assert.True(response.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<TagDto>();
        Assert.NotNull(payload);
        return payload!;
    }

    private static async Task SeedItemWithTagIdsAsync(string connectionString, string databaseName, string userId, params string[] tagIds)
    {
        var mongoClient = new MongoClient(connectionString);
        var database = mongoClient.GetDatabase(databaseName);
        var collection = database.GetCollection<BsonDocument>("items");
        var tagObjectIds = tagIds.Select(ObjectId.Parse);
        var uniqueSuffix = Guid.NewGuid().ToString("N");
        var now = DateTime.UtcNow;

        var document = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "url", $"https://example.com/seed/{uniqueSuffix}" },
            { "normalizedUrl", $"example.com/seed/{uniqueSuffix}" },
            { "title", "Seeded Item" },
            { "status", "unread" },
            { "isFavorite", false },
            { "tags", new BsonArray() },
            { "tagIds", new BsonArray(tagObjectIds) },
            { "userId", userId },
            { "createdAt", now },
            { "updatedAt", now },
            { "enrichmentStatus", "pending" }
        };

        await collection.InsertOneAsync(document);
    }

    private TestClientWrapper CreateClient()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
                builder.UseSetting("ConnectionStrings:blobs", "UseDevelopmentStorage=true");
                builder.UseSetting("Authentication:TestMode", "true");
            });

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", TestUserId);

        return new TestClientWrapper(factory, client, connectionString, databaseName);
    }

    private sealed class TestClientWrapper : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        public HttpClient Client { get; }
        public string ConnectionString { get; }
        public string DatabaseName { get; }

        public TestClientWrapper(WebApplicationFactory<Program> factory, HttpClient client, string connectionString, string databaseName)
        {
            _factory = factory;
            Client = client;
            ConnectionString = connectionString;
            DatabaseName = databaseName;
        }

        public void Dispose()
        {
            Client.Dispose();
            _factory.Dispose();
        }
    }
}
