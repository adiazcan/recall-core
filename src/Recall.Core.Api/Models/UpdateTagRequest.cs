namespace Recall.Core.Api.Models;

public sealed record UpdateTagRequest
{
    public string? Name { get; init; }
    public string? Color { get; init; }
}
