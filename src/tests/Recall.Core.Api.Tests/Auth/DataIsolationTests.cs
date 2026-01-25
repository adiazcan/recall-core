using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Recall.Core.Api.Models;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests.Auth;

public class DataIsolationTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public DataIsolationTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task Users_CannotAccessEachOthersItems()
    {
        using var server = CreateServer();
        using var userAClient = server.CreateClient("user-a");
        using var userBClient = server.CreateClient("user-b");

        var createA = await userAClient.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/a"
        });

        Assert.Equal(HttpStatusCode.Created, createA.StatusCode);
        var itemA = await createA.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(itemA);

        var createB = await userBClient.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/b"
        });

        Assert.Equal(HttpStatusCode.Created, createB.StatusCode);
        var itemB = await createB.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(itemB);

        var listA = await userAClient.GetFromJsonAsync<ItemListResponse>("/api/v1/items");
        Assert.NotNull(listA);
        Assert.Single(listA!.Items);
        Assert.Equal(itemA!.Id, listA.Items[0].Id);

        var listB = await userBClient.GetFromJsonAsync<ItemListResponse>("/api/v1/items");
        Assert.NotNull(listB);
        Assert.Single(listB!.Items);
        Assert.Equal(itemB!.Id, listB.Items[0].Id);

        var crossFetch = await userBClient.GetAsync($"/api/v1/items/{itemA!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossFetch.StatusCode);
    }

    [Fact]
    public async Task Users_CannotAccessEachOthersCollections()
    {
        using var server = CreateServer();
        using var userAClient = server.CreateClient("user-a");
        using var userBClient = server.CreateClient("user-b");

        var createResponse = await userAClient.PostAsJsonAsync("/api/v1/collections", new CreateCollectionRequest
        {
            Name = "User A"
        });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var collection = await createResponse.Content.ReadFromJsonAsync<CollectionDto>();
        Assert.NotNull(collection);

        var listB = await userBClient.GetFromJsonAsync<CollectionListResponse>("/api/v1/collections");
        Assert.NotNull(listB);
        Assert.DoesNotContain(listB!.Collections, c => c.Id == collection!.Id);

        var crossFetch = await userBClient.GetAsync($"/api/v1/collections/{collection!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, crossFetch.StatusCode);
    }

    [Fact]
    public async Task Users_CannotAccessEachOthersTags()
    {
        using var server = CreateServer();
        using var userAClient = server.CreateClient("user-a");
        using var userBClient = server.CreateClient("user-b");

        var createResponse = await userAClient.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/tagged",
            Tags = ["alpha"]
        });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);

        var listB = await userBClient.GetFromJsonAsync<TagListResponse>("/api/v1/tags");
        Assert.NotNull(listB);
        Assert.DoesNotContain(listB!.Tags, tag => tag.Name == "alpha");

        var deleteResponse = await userBClient.DeleteAsync("/api/v1/tags/alpha");
        Assert.Equal(HttpStatusCode.NotFound, deleteResponse.StatusCode);
    }

    private TestServer CreateServer()
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

        // Factory ownership is transferred to TestServer which will dispose it
        return new TestServer(factory);
    }

    private sealed class TestServer : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;

        public TestServer(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
        }

        public HttpClient CreateClient(string userId)
        {
            var client = _factory.CreateClient();
            client.DefaultRequestHeaders.Add("X-Test-UserId", userId);
            return client;
        }

        public void Dispose()
        {
            _factory.Dispose();
        }
    }
}
