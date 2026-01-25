using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
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
    public async Task ListTags_ReturnsTagCounts()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/tech-a",
            Tags = ["tech", "reading"]
        });

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/tech-b",
            Tags = ["tech"]
        });

        var response = await client.GetAsync("/api/v1/tags");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<TagListResponse>();
        Assert.NotNull(payload);

        var tech = payload!.Tags.Single(tag => tag.Name == "tech");
        Assert.Equal(2, tech.Count);
    }

    [Fact]
    public async Task RenameTag_ReturnsItemsUpdated()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/rename-a",
            Tags = ["tech"]
        });

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/rename-b",
            Tags = ["tech"]
        });

        var response = await client.PatchAsJsonAsync("/api/v1/tags/tech", new RenameTagRequest
        {
            NewName = "Technology"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<TagOperationResponse>();
        Assert.NotNull(payload);
        Assert.Equal("tech", payload!.OldName);
        Assert.Equal("technology", payload.NewName);
        Assert.Equal(2, payload.ItemsUpdated);
    }

    [Fact]
    public async Task DeleteTag_RemovesTagFromItems()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/delete-a",
            Tags = ["obsolete", "keep"]
        });

        await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/delete-b",
            Tags = ["obsolete"]
        });

        var response = await client.DeleteAsync("/api/v1/tags/obsolete");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<TagOperationResponse>();
        Assert.NotNull(payload);
        Assert.Equal("obsolete", payload!.OldName);
        Assert.Null(payload.NewName);
        Assert.Equal(2, payload.ItemsUpdated);

        var listResponse = await client.GetAsync("/api/v1/tags");
        var listPayload = await listResponse.Content.ReadFromJsonAsync<TagListResponse>();
        Assert.NotNull(listPayload);
        Assert.DoesNotContain(listPayload!.Tags, tag => tag.Name == "obsolete");
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

        return new TestClientWrapper(factory, client);
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
