using Dapr.Client;
using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

public interface IEnrichmentJobPublisher
{
    Task PublishAsync(EnrichmentJob job, CancellationToken cancellationToken = default);
}

public sealed class DaprEnrichmentJobPublisher : IEnrichmentJobPublisher
{
    private readonly DaprClient _daprClient;

    public DaprEnrichmentJobPublisher(DaprClient daprClient)
    {
        _daprClient = daprClient;
    }

    public Task PublishAsync(EnrichmentJob job, CancellationToken cancellationToken = default)
    {
        return _daprClient.PublishEventAsync(
            "enrichment-pubsub",
            "enrichment.requested",
            job,
            cancellationToken);
    }
}
