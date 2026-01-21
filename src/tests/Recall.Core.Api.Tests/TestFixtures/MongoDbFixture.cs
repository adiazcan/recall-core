using Testcontainers.MongoDb;
using Xunit;

namespace Recall.Core.Api.Tests.TestFixtures;

public sealed class MongoDbFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _container = new MongoDbBuilder()
        .WithImage("mongo:7")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public Task InitializeAsync()
    {
        return _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }

    public static string BuildConnectionString(string baseConnectionString, string databaseName)
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
