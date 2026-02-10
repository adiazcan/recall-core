using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.IO;
using System.Text.Json;
using System.Threading;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MongoDB.Bson;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;
using Recall.Core.Enrichment.Common.Models;
using Recall.Core.Enrichment.Common.Services;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class ItemsEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;
    private const string TestUserId = "test-user-123";

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
    public async Task CreateItem_ReturnsEnrichedItemWhenPreviewImageFound()
    {
        var enrichmentResult = new SyncEnrichmentResult(
            "Meta Title",
            "Meta Excerpt",
            "https://example.com/og.png",
            false,
            null,
            TimeSpan.FromMilliseconds(25));

        using var testClient = CreateClient(_ => enrichmentResult);
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/enriched"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal("Meta Title", payload!.Title);
        Assert.Equal("Meta Excerpt", payload.Excerpt);
        Assert.Equal("https://example.com/og.png", payload.PreviewImageUrl);
        Assert.Equal("succeeded", payload.EnrichmentStatus);
    }

    [Fact]
    public async Task CreateItem_ReturnsPendingWhenPreviewImageMissing()
    {
        var enrichmentResult = new SyncEnrichmentResult(
            "Meta Title",
            "Meta Excerpt",
            null,
            true,
            null,
            TimeSpan.FromMilliseconds(25));

        using var testClient = CreateClient(_ => enrichmentResult);
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/no-image"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal("Meta Title", payload!.Title);
        Assert.Equal("Meta Excerpt", payload.Excerpt);
        Assert.Null(payload.PreviewImageUrl);
        Assert.True(payload.EnrichmentStatus is "pending" or "failed");
    }

    [Fact]
    public async Task CreateItem_PreservesUserTitleOverEnrichment()
    {
        var enrichmentResult = new SyncEnrichmentResult(
            "Enriched Title",
            "Meta Excerpt",
            "https://example.com/og.png",
            false,
            null,
            TimeSpan.FromMilliseconds(25));

        using var testClient = CreateClient(_ => enrichmentResult);
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/user-title",
            Title = "User Title"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal("User Title", payload!.Title);
    }

    [Fact]
    public async Task CreateItem_DuplicateUrlReturnsOkWithExistingItem()
    {
        var enrichmentCalls = 0;
        var enrichmentResult = new SyncEnrichmentResult(
            "Meta Title",
            "Meta Excerpt",
            null,
            true,
            null,
            TimeSpan.FromMilliseconds(10));

        using var testClient = CreateClient(_ =>
        {
            enrichmentCalls++;
            return enrichmentResult;
        });
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
        Assert.Equal(1, enrichmentCalls);
        Assert.Equal(1, testClient.PublishedCount);
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

    [Fact]
    public async Task EnrichItem_ReturnsAcceptedWithStatus()
    {
        var enrichmentResult = new SyncEnrichmentResult(
            "Enriched Title",
            "Enriched Excerpt",
            "https://example.com/og.png",
            false,
            null,
            TimeSpan.FromMilliseconds(25));

        using var testClient = CreateClient(_ => enrichmentResult);
        var client = testClient.Client;

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/enrich-test",
            Title = "Test Enrich"
        });

        var item = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(item);

        var enrichResponse = await client.PostAsync($"/api/v1/items/{item!.Id}/enrich", null);
        Assert.Equal(HttpStatusCode.Accepted, enrichResponse.StatusCode);

        var payload = await enrichResponse.Content.ReadFromJsonAsync<EnrichResponse>();
        Assert.NotNull(payload);
        Assert.Equal(item.Id, payload!.ItemId);
        Assert.Equal("succeeded", payload.Status);
        Assert.Equal(0, testClient.PublishedCount);
    }

    [Fact]
    public async Task EnrichItem_QueuesFallbackOnlyWhenPreviewMissing()
    {
        var results = new Queue<SyncEnrichmentResult>(
        [
            new SyncEnrichmentResult(
                "Initial Title",
                "Initial Excerpt",
                null,
                true,
                null,
                TimeSpan.FromMilliseconds(25)),
            new SyncEnrichmentResult(
                "Refreshed Title",
                "Refreshed Excerpt",
                "https://example.com/og-refreshed.png",
                false,
                null,
                TimeSpan.FromMilliseconds(25))
        ]);

        using var testClient = CreateClient(_ => results.Dequeue());
        var client = testClient.Client;

        var createResponse = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "https://example.com/enrich-queue",
            Title = "Original"
        });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(created);
        Assert.Equal(1, testClient.PublishedCount);

        var enrichResponse = await client.PostAsync($"/api/v1/items/{created!.Id}/enrich", null);
        Assert.Equal(HttpStatusCode.Accepted, enrichResponse.StatusCode);

        var payload = await enrichResponse.Content.ReadFromJsonAsync<EnrichResponse>();
        Assert.NotNull(payload);
        Assert.Equal("succeeded", payload!.Status);
        Assert.Equal(1, testClient.PublishedCount);

        var getResponse = await client.GetAsync($"/api/v1/items/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var refreshed = await getResponse.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(refreshed);
        Assert.Equal("Refreshed Title", refreshed!.Title);
        Assert.Equal("Refreshed Excerpt", refreshed.Excerpt);
        Assert.Equal("https://example.com/og-refreshed.png", refreshed.PreviewImageUrl);
        Assert.Equal("succeeded", refreshed.EnrichmentStatus);
    }

    [Fact]
    public async Task EnrichItem_NotFoundReturnsNotFound()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var enrichResponse = await client.PostAsync($"/api/v1/items/{ObjectId.GenerateNewId()}/enrich", null);
        Assert.Equal(HttpStatusCode.NotFound, enrichResponse.StatusCode);

        var error = await enrichResponse.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("not_found", error!.Error.Code);
    }

    [Fact]
    public async Task CreateItem_SsrfBlockedReturnsFailedAndDoesNotQueueAsyncFallback()
    {
        var enrichmentResult = new SyncEnrichmentResult(
            null,
            null,
            null,
            false,
            "URL blocked.",
            TimeSpan.FromMilliseconds(5));

        using var testClient = CreateClient(_ => enrichmentResult);
        var client = testClient.Client;

        var response = await client.PostAsJsonAsync("/api/v1/items", new CreateItemRequest
        {
            Url = "http://192.168.1.1/admin"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<ItemDto>();
        Assert.NotNull(payload);
        Assert.Equal("failed", payload!.EnrichmentStatus);
        Assert.Equal("URL blocked.", payload.EnrichmentError);
        Assert.Null(payload.PreviewImageUrl);
        Assert.Equal(0, testClient.PublishedCount);
    }

    private TestClientWrapper CreateClient(Func<string, SyncEnrichmentResult>? enrichmentHandler = null)
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);
        var handler = enrichmentHandler ?? (_ => new SyncEnrichmentResult(null, null, null, true, null, TimeSpan.Zero));
        var publisher = new FakeEnrichmentJobPublisher();

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
                builder.UseSetting("ConnectionStrings:blobs", "UseDevelopmentStorage=true");
                builder.UseSetting("Authentication:TestMode", "true");
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<ISyncEnrichmentService>();
                    services.AddScoped<ISyncEnrichmentService>(_ => new FakeSyncEnrichmentService(handler));
                    services.RemoveAll<IEnrichmentJobPublisher>();
                    services.AddSingleton<IEnrichmentJobPublisher>(_ => publisher);
                });
            });

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", TestUserId);

        return new TestClientWrapper(factory, client, publisher);
    }

    private sealed class TestClientWrapper : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly FakeEnrichmentJobPublisher _publisher;
        public HttpClient Client { get; }
        public int PublishedCount => _publisher.PublishedCount;

        public TestClientWrapper(WebApplicationFactory<Program> factory, HttpClient client, FakeEnrichmentJobPublisher publisher)
        {
            _factory = factory;
            Client = client;
            _publisher = publisher;
        }

        public void Dispose()
        {
            Client.Dispose();
            _factory.Dispose();
        }
    }

    private sealed class FakeSyncEnrichmentService : ISyncEnrichmentService
    {
        private readonly Func<string, SyncEnrichmentResult> _handler;

        public FakeSyncEnrichmentService(Func<string, SyncEnrichmentResult> handler)
        {
            _handler = handler;
        }

        public Task<SyncEnrichmentResult> EnrichAsync(
            string url,
            string userId,
            string itemId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_handler(url));
        }
    }

    private sealed class FakeEnrichmentJobPublisher : IEnrichmentJobPublisher
    {
        private int _publishedCount;
        public int PublishedCount => Volatile.Read(ref _publishedCount);

        public Task PublishAsync(EnrichmentJob job, CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref _publishedCount);
            return Task.CompletedTask;
        }
    }
}
