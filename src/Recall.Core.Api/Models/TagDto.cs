namespace Recall.Core.Api.Models;

public sealed record TagDto
{
    public string Name { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed record TagListResponse
{
    public IReadOnlyList<TagDto> Tags { get; init; } = Array.Empty<TagDto>();
}
