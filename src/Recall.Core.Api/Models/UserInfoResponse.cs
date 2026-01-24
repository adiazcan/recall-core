namespace Recall.Core.Api.Models;

public record UserInfoResponse(
    string Sub,
    string? DisplayName,
    string? Email,
    string TenantId
);
