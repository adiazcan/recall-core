using Recall.Core.Enrichment.Models;

namespace Recall.Core.Enrichment.Services;

public interface IEnrichmentService
{
    Task EnrichAsync(EnrichmentJob job, CancellationToken cancellationToken = default);
    Task MarkFailedAsync(EnrichmentJob job, string error, CancellationToken cancellationToken = default);
}
