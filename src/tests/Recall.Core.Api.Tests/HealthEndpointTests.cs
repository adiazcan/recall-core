using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests;

public class HealthEndpointTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public HealthEndpointTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task GetHealth_ReturnsOkStatusAndPayload()
    {
        using var client = CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(content);
        var status = document.RootElement.GetProperty("status").GetString();

        Assert.Equal("ok", status);
    }

    private HttpClient CreateClient()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
            });

        return factory.CreateClient();
    }
}
