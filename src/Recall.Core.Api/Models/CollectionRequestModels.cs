namespace Recall.Core.Api.Models;

public sealed record CreateCollectionRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string? ParentId { get; init; }
}

public sealed record UpdateCollectionRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? ParentId { get; init; }
}