namespace Recall.Core.Api.Models;

public sealed record CreateTagRequest
{
    public string Name { get; init; } = string.Empty;
    public string? Color { get; init; }
}
