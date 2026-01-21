namespace Recall.Core.Api.Models;

public sealed record CollectionListResponse
{
    public IReadOnlyList<CollectionDto> Collections { get; init; } = Array.Empty<CollectionDto>();
}