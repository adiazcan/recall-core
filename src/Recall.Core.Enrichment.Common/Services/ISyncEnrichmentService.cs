using Recall.Core.Enrichment.Common.Models;

namespace Recall.Core.Enrichment.Common.Services;

public interface ISyncEnrichmentService
{
    Task<SyncEnrichmentResult> EnrichAsync(
        string url,
        string userId,
        string itemId,
        CancellationToken cancellationToken = default);
}
