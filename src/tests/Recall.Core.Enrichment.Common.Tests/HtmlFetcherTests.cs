using System.Net;
using System.Net.Http;
using Microsoft.Extensions.Logging;
using Recall.Core.Enrichment.Common.Configuration;
using Recall.Core.Enrichment.Common.Models;
using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Enrichment.Common.Tests;

public sealed class HtmlFetcherTests
{
    [Fact]
    public async Task FetchHtmlAsync_ThrowsWhenResponseTooLarge()
    {
        var handler = new TestHttpMessageHandler((_, _) =>
        {
            var content = new ByteArrayContent(new byte[2048]);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
        });

        var fetcher = CreateFetcher(handler, new EnrichmentOptions { MaxResponseSizeBytes = 1024, FetchTimeoutSeconds = 5 });

        await Assert.ThrowsAsync<InvalidOperationException>(() => fetcher.FetchHtmlAsync("https://example.com"));
    }

    [Fact]
    public async Task FetchHtmlAsync_FollowsRedirectsWithinLimit()
    {
        var handler = new TestHttpMessageHandler((request, _) =>
        {
            if (request.RequestUri?.AbsolutePath == "/redirect")
            {
                var response = new HttpResponseMessage(HttpStatusCode.Redirect);
                response.Headers.Location = new Uri("https://example.com/final");
                return Task.FromResult(response);
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("ok")
            });
        });

        var fetcher = CreateFetcher(handler, new EnrichmentOptions { MaxRedirects = 3, FetchTimeoutSeconds = 5 });

        var html = await fetcher.FetchHtmlAsync("https://example.com/redirect");

        Assert.Equal("ok", html);
    }

    [Fact]
    public async Task FetchHtmlAsync_ValidatesRedirectTargets()
    {
        var handler = new TestHttpMessageHandler((request, _) =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.Redirect);
            response.Headers.Location = new Uri("https://blocked.local/secret");
            return Task.FromResult(response);
        });

        var fetcher = CreateFetcher(
            handler,
            new EnrichmentOptions { MaxRedirects = 3, FetchTimeoutSeconds = 5 },
            new RedirectBlockingSsrfValidator());

        var exception = await Assert.ThrowsAsync<SsrfBlockedException>(() =>
            fetcher.FetchHtmlAsync("https://example.com/redirect"));

        Assert.Equal("URL blocked.", exception.Message);
    }

    [Fact]
    public async Task FetchHtmlAsync_RespectsTimeout()
    {
        var handler = new TestHttpMessageHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("late")
            };
        });

        var fetcher = CreateFetcher(handler, new EnrichmentOptions { FetchTimeoutSeconds = 1 });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => fetcher.FetchHtmlAsync("https://example.com/slow"));
    }

    private static HtmlFetcher CreateFetcher(
        HttpMessageHandler handler,
        EnrichmentOptions? options = null,
        ISsrfValidator? ssrfValidator = null)
    {
        options ??= new EnrichmentOptions { FetchTimeoutSeconds = 5 };
        ssrfValidator ??= new AllowAllSsrfValidator();
        var loggerFactory = LoggerFactory.Create(builder => builder.AddFilter(_ => false));

        return new HtmlFetcher(
            new TestHttpClientFactory(handler),
            ssrfValidator,
            options,
            loggerFactory.CreateLogger<HtmlFetcher>());
    }

    private sealed class TestHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _handler;

        public TestHttpMessageHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return _handler(request, cancellationToken);
        }
    }

    private sealed class TestHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;

        public TestHttpClientFactory(HttpMessageHandler handler)
        {
            _client = new HttpClient(handler);
        }

        public HttpClient CreateClient(string name) => _client;
    }

    private sealed class AllowAllSsrfValidator : ISsrfValidator
    {
        public Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new SsrfValidationResult(true, null));
        }
    }

    private sealed class RedirectBlockingSsrfValidator : ISsrfValidator
    {
        public Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default)
        {
            if (url.Contains("blocked.local", StringComparison.OrdinalIgnoreCase))
            {
                return Task.FromResult(new SsrfValidationResult(false, "URL blocked."));
            }

            return Task.FromResult(new SsrfValidationResult(true, null));
        }
    }
}
