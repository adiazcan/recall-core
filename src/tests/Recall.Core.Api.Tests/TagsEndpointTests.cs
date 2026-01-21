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

    public TagsEndpointTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task ListTags_ReturnsTagCounts()
    {
        using var client = CreateClient();

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
        using var client = CreateClient();

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
        using var client = CreateClient();

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
