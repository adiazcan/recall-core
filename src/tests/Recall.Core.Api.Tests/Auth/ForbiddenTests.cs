using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Recall.Core.Api.Tests.TestFixtures;
using Xunit;

namespace Recall.Core.Api.Tests.Auth;

public class ForbiddenTests : IClassFixture<MongoDbFixture>
{
    private readonly MongoDbFixture _mongo;
    private const string TestUserId = "test-user-123";

    public ForbiddenTests(MongoDbFixture mongo)
    {
        _mongo = mongo;
    }

    [Fact]
    public async Task MissingScope_ReturnsForbidden()
    {
        using var testClient = CreateClient();
        var response = await testClient.Client.GetAsync("/api/v1/items");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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
                builder.ConfigureServices(services =>
                {
                    services.AddAuthentication(options =>
                        {
                            options.DefaultAuthenticateScheme = NoScopeAuthHandler.SchemeName;
                            options.DefaultChallengeScheme = NoScopeAuthHandler.SchemeName;
                            options.DefaultScheme = NoScopeAuthHandler.SchemeName;
                        })
                        .AddScheme<AuthenticationSchemeOptions, NoScopeAuthHandler>(NoScopeAuthHandler.SchemeName, _ => { });
                });
            });

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-UserId", TestUserId);
        // Factory ownership is transferred to TestClientWrapper which will dispose it
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

    private sealed class NoScopeAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string SchemeName = "NoScope";

        #pragma warning disable CS0618
        public NoScopeAuthHandler(
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
            if (!Request.Headers.TryGetValue("X-Test-UserId", out var userIdValues))
            {
                return Task.FromResult(AuthenticateResult.Fail("Missing X-Test-UserId header."));
            }

            var userId = userIdValues.ToString();
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Task.FromResult(AuthenticateResult.Fail("Missing X-Test-UserId header."));
            }

            var claims = new List<Claim>
            {
                new("sub", userId),
                new(ClaimTypes.NameIdentifier, userId),
                new("tid", "test-tenant")
            };

            var identity = new ClaimsIdentity(claims, SchemeName);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, SchemeName);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
