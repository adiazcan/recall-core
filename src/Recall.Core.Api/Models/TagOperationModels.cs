namespace Recall.Core.Api.Models;

public sealed record RenameTagRequest
{
    public string NewName { get; init; } = string.Empty;
}

public sealed record TagOperationResponse
{
    public string OldName { get; init; } = string.Empty;
    public string? NewName { get; init; }
    public int ItemsUpdated { get; init; }
}
