namespace Recall.Core.Enrichment.Services;

public interface ISsrfValidator
{
    Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default);
}

public sealed record SsrfValidationResult(bool IsAllowed, string? ErrorMessage);
