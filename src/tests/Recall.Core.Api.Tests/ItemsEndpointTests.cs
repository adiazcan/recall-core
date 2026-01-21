using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
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
        using var client = CreateClient();

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
        using var client = CreateClient();

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
        using var client = CreateClient();

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
        using var client = CreateClient();

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
        using var client = CreateClient();

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

    private HttpClient CreateClient()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
            });

        return factory.CreateClient();
    }

    private static string BuildConnectionString(string baseConnectionString, string databaseName)
    {
        if (baseConnectionString.Contains('?', StringComparison.Ordinal))
        {
            var index = baseConnectionString.IndexOf('?', StringComparison.Ordinal);
            return string.Concat(
                baseConnectionString.AsSpan(0, index),
                "/",
                databaseName,
                baseConnectionString.AsSpan(index));
        }

        return string.Concat(baseConnectionString, "/", databaseName);
    }
}
