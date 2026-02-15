namespace Recall.Core.Api.Models;

public sealed record UpdateItemRequest
{
    public string? Title { get; init; }
    public string? Excerpt { get; init; }
    public string? Status { get; init; }
    public bool? IsFavorite { get; init; }
    public string? CollectionId { get; init; }
    public IReadOnlyList<string>? TagIds { get; init; }
    public IReadOnlyList<string>? NewTagNames { get; init; }
}
