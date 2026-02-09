using System.Net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Recall.Core.Enrichment.Common.Configuration;
using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Enrichment.Common;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddEnrichmentCommon(this IServiceCollection services)
    {
        services.AddOptions<EnrichmentOptions>()
            .BindConfiguration("Enrichment");
        services.AddSingleton(sp => sp.GetRequiredService<IOptions<EnrichmentOptions>>().Value);

        services.AddHttpClient("enrichment-fetch")
            .ConfigurePrimaryHttpMessageHandler(sp =>
            {
                var options = sp.GetRequiredService<EnrichmentOptions>();
                return new SocketsHttpHandler
                {
                    AllowAutoRedirect = false,
                    AutomaticDecompression = DecompressionMethods.All,
                    ConnectTimeout = TimeSpan.FromSeconds(options.ConnectTimeoutSeconds)
                };
            });

        services.AddSingleton<ISsrfValidator, SsrfValidator>();
        services.AddSingleton<IHtmlFetcher, HtmlFetcher>();
        services.AddSingleton<IMetadataExtractor, MetadataExtractor>();
        services.AddScoped<ISyncEnrichmentService>(_ =>
            throw new InvalidOperationException("ISyncEnrichmentService is not implemented yet."));

        return services;
    }
}
