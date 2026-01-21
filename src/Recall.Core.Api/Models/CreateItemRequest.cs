namespace Recall.Core.Api.Models;

public sealed record CreateItemRequest
{
    public string Url { get; init; } = string.Empty;
    public string? Title { get; init; }
    public IReadOnlyList<string>? Tags { get; init; }
}
