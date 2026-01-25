using Dapr;
using Microsoft.AspNetCore.Mvc;
using Recall.Core.Enrichment.Models;
using Recall.Core.Enrichment.Services;

namespace Recall.Core.Enrichment.Controllers;

[ApiController]
public sealed class EnrichmentController : ControllerBase
{
    private readonly IEnrichmentService _enrichmentService;
    private readonly ILogger<EnrichmentController> _logger;

    public EnrichmentController(IEnrichmentService enrichmentService, ILogger<EnrichmentController> logger)
    {
        _enrichmentService = enrichmentService;
        _logger = logger;
    }

    [Topic("enrichment-pubsub", "enrichment.requested")]
    [HttpPost("/api/enrichment/process")]
    public async Task<IActionResult> ProcessEnrichmentJob([FromBody] EnrichmentJob job, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Enrichment job started. ItemId={ItemId} UserId={UserId}",
            job.ItemId,
            job.UserId);

        try
        {
            await _enrichmentService.EnrichAsync(job, cancellationToken);
            _logger.LogInformation(
                "Enrichment job succeeded. ItemId={ItemId} UserId={UserId}",
                job.ItemId,
                job.UserId);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Enrichment job failed. ItemId={ItemId} UserId={UserId}",
                job.ItemId,
                job.UserId);
            return StatusCode(500);
        }
    }

    [Topic("enrichment-pubsub", "enrichment.deadletter")]
    [HttpPost("/api/enrichment/deadletter")]
    public async Task<IActionResult> HandleDeadLetter([FromBody] EnrichmentJob job, CancellationToken cancellationToken)
    {
        _logger.LogError(
            "Enrichment job moved to dead letter. ItemId={ItemId} UserId={UserId}",
            job.ItemId,
            job.UserId);

        await _enrichmentService.MarkFailedAsync(job, "Max retry attempts exceeded.", cancellationToken);
        return Ok();
    }
}
