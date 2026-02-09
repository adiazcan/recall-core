namespace Recall.Core.Enrichment.Common.Services;

public interface ISsrfValidator
{
    Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default);
}

public sealed record SsrfValidationResult(bool IsAllowed, string? ErrorMessage);
