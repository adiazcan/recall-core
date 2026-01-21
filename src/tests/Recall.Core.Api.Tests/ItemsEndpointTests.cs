using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using MongoDB.Bson;
using Recall.Core.Api.Models;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class ItemsEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public ItemsEndpointTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task CreateItem_ReturnsCreatedWithSavedItem()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/article",
            Title = "Interesting Article",
            Tags = ["Tech", "reading"]
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal("https://example.com/article", payload!.Url);
        Assert.Equal("unread", payload.Status);
        Assert.Contains("tech", payload.Tags);
    }

    [Fact]
    public async Task CreateItem_DuplicateUrlReturnsOkWithExistingItem()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var first = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/dup",
            Title = "Original"
        });

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var firstItem = await first.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(firstItem);

        var second = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/dup",
            Title = "Duplicate"
        });

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var secondItem = await second.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(secondItem);
        Assert.Equal(firstItem!.Id, secondItem!.Id);
    }

    [Fact]
    public async Task CreateItem_InvalidUrlReturnsBadRequest()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "not-a-url"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(content);
        var code = document.RootElement.GetProperty("error").GetProperty("code").GetString();
        Assert.Equal("invalid_url", code);
    }

    [Fact]
    public async Task ListItems_ReturnsPaginatedResults()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest { Url = "https://example.com/a" });
        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest { Url = "https://example.com/b" });
        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest { Url = "https://example.com/c" });

        var response = await client.GetAsync("/api/v1/items?limit=2");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemListResponse>();
        Assert.NotNull(payload);
        Assert.Equal(2, payload!.Items.Count);
        Assert.True(payload.HasMore);
        Assert.False(string.IsNullOrWhiteSpace(payload.Cursor));

        var nextResponse = await client.GetAsync($"/api/v1/items?limit=2&cursor={WebUtility.UrlEncode(payload.Cursor)}");
        Assert.Equal(HttpStatusCode.OK, nextResponse.StatusCode);

        var nextPayload = await nextResponse.Content.ReadFromJsonAsync<ItemListResponse>();
        Assert.NotNull(nextPayload);
        Assert.Single(nextPayload!.Items);
        Assert.False(nextPayload.HasMore);
    }

    [Fact]
    public async Task ListItems_AppliesTagAndFavoriteFilters()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/tech",
            Tags = ["tech", "reading"]
        });

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/other",
            Tags = ["reading"]
        });

        var tagResponse = await client.GetAsync("/api/v1/items?tag=tech");
        Assert.Equal(HttpStatusCode.OK, tagResponse.StatusCode);

        var tagPayload = await tagResponse.Content.ReadFromJsonAsync<ItemListResponse>();
        Assert.NotNull(tagPayload);
        Assert.Single(tagPayload!.Items);
        Assert.Contains("tech", tagPayload.Items[0].Tags);

        var favoriteResponse = await client.GetAsync("/api/v1/items?isFavorite=true");
        Assert.Equal(HttpStatusCode.OK, favoriteResponse.StatusCode);

        var favoritePayload = await favoriteResponse.Content.ReadFromJsonAsync<ItemListResponse>();
        Assert.NotNull(favoritePayload);
        Assert.Empty(favoritePayload!.Items);
    }

    [Fact]
    public async Task GetItem_ReturnsItem()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/details",
            Title = "Details"
        });

        var created = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(created);

        var getResponse = await client.GetAsync($"/api/v1/items/{created!.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var payload = await getResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal(created.Id, payload!.Id);
        Assert.Equal("https://example.com/details", payload.Url);
        Assert.Equal("Details", payload.Title);
    }

    [Fact]
    public async Task GetItem_NotFoundReturnsNotFound()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var response = await client.GetAsync($"/api/v1/items/{ObjectId.GenerateNewId()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        var error = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("not_found", error!.Error.Code);
    }

    [Fact]
    public async Task UpdateItem_ReturnsUpdatedItem()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var collectionResponse = await client.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "Updates"
        });

        var collection = await collectionResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/update",
            Title = "Original"
        });

        var item = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(item);

        var updateResponse = await client.PatchAsJsonAsync($"/api/v1/items/{item!.Id}", new UpdateItemRequest
        {
            Title = "Updated",
            Excerpt = "Short excerpt",
            Status = "archived",
            IsFavorite = true,
            CollectionId = collection!.Id,
            Tags = ["Tech", "Updates"]
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        var updated = await updateResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(updated);
        Assert.Equal("Updated", updated!.Title);
        Assert.Equal("Short excerpt", updated.Excerpt);
        Assert.Equal("archived", updated.Status);
        Assert.True(updated.IsFavorite);
        Assert.Equal(collection.Id, updated.CollectionId);
        Assert.Contains("tech", updated.Tags);
        Assert.Contains("updates", updated.Tags);
    }

    [Fact]
    public async Task UpdateItem_InvalidCollectionReturnsBadRequest()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/invalid-collection"
        });

        var item = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(item);

        var updateResponse = await client.PatchAsJsonAsync($"/api/v1/items/{item!.Id}", new UpdateItemRequest
        {
            CollectionId = ObjectId.GenerateNewId().ToString()
        });

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);

        var error = await updateResponse.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("validation_error", error!.Error.Code);
    }

    [Fact]
    public async Task UpdateItem_NotFoundReturnsNotFound()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var updateResponse = await client.PatchAsJsonAsync($"/api/v1/items/{ObjectId.GenerateNewId()}", new UpdateItemRequest
        {
            Status = "archived"
        });

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);

        var error = await updateResponse.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("not_found", error!.Error.Code);
    }

    [Fact]
    public async Task DeleteItem_ReturnsNoContent()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/delete"
        });

        var item = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(item);

        var deleteResponse = await client.DeleteAsync($"/api/v1/items/{item!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteItem_NotFoundReturnsNotFound()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var deleteResponse = await client.DeleteAsync($"/api/v1/items/{ObjectId.GenerateNewId()}");
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);

        var error = await deleteResponse.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("not_found", error!.Error.Code);
    }

    private TestClientWrapper CreateClient()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
            });

        return new TestClientWrapper(factory, factory.CreateClient());
    }

    private sealed class TestClientWrapper : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        public HttpClient Client { get; }

        public TestClientWrapper(WebApplicationFactory<Program> factory, HttpClient client)
        {
            _factory = factory;
            Client = client;
        }

        public void Dispose()
        {
            Client.Dispose();
            _factory.Dispose();
        }
    }
}
