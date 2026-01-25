using System.Net;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests.Auth;

public class UnauthorizedTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;

    public UnauthorizedTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task MissingToken_ReturnsUnauthorized()
    {
        using var testClient = CreateClient();
        var response = await testClient.Client.GetAsync("/api/v1/items");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task InvalidToken_ReturnsUnauthorized()
    {
        using var testClient = CreateClientWithInvalidAuth();
        var response = await testClient.Client.GetAsync("/api/v1/items");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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
                builder.UseSetting("ConnectionStrings:blobs", "UseDevelopmentStorage=true");
                builder.UseSetting("Authentication:TestMode", "true");
            });

        // Factory ownership is transferred to TestClientWrapper which will dispose it
        return new TestClientWrapper(factory, factory.CreateClient());
    }

    private TestClientWrapper CreateClientWithInvalidAuth()
    {
        var databaseName = $"recalldb-tests-{Guid.NewGuid():N}";
        var connectionString = MongoDbFixture.BuildConnectionString(_mongo.ConnectionString, databaseName);

        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("ConnectionStrings:recalldb", connectionString);
                builder.UseSetting("ConnectionStrings:blobs", "UseDevelopmentStorage=true");
                builder.UseSetting("Authentication:TestMode", "true");
                builder.ConfigureServices(services =>
                {
                    services.AddAuthentication(options =>
                        {
                            options.DefaultAuthenticateScheme = InvalidAuthHandler.SchemeName;
                            options.DefaultChallengeScheme = InvalidAuthHandler.SchemeName;
                            options.DefaultScheme = InvalidAuthHandler.SchemeName;
                        })
                        .AddScheme<AuthenticationSchemeOptions, InvalidAuthHandler>(
                            InvalidAuthHandler.SchemeName,
                            _ => { });
                });
            });

        // Factory ownership is transferred to TestClientWrapper which will dispose it
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

    private sealed class InvalidAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "Invalid";

        #pragma warning disable CS0618
        public InvalidAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            ISystemClock clock)
            : base(options, logger, encoder, clock)
        #pragma warning restore CS0618
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid token."));
        }
    }
}
