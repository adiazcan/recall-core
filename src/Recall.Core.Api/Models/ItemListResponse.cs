namespace Recall.Core.Api.Models;

public sealed record ItemListResponse
{
    public IReadOnlyList<ItemDto> Items { get; init; } = Array.Empty<ItemDto>();
    public string? Cursor { get; init; }
    public bool HasMore { get; init; }
}
