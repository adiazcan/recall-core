using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Recall.Core.Api.Models;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests.Endpoints;

public class MeEndpointsTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;
    private const string TestUserId = "test-user-456";

    public MeEndpointsTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task GetMe_ReturnsUserIdentity()
    {
        using var testClient = CreateClient();
        var client = testClient.Client;

        var response = await client.GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var payload = await response.Content.ReadFromJsonAsync<UserInfoResponse>();
        Assert.NotNull(payload);
        Assert.Equal(TestUserId, payload!.Sub);
        Assert.Equal("test-tenant", payload.TenantId);
        Assert.Null(payload.DisplayName);
        Assert.Null(payload.Email);
    }

    private TestClientWrapper CreateClient()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
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
