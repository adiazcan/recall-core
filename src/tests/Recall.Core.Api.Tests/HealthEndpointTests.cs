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
        using var factory = CreateFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(content);
        var status = document.RootElement.GetProperty("status").GetString();

        Assert.Equal("ok", status);
    }

    private WebApplicationFactory<Program> CreateFactory()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = BuildConnectionString(_mongo.ConnectionString, databaseName);

        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
            });
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
