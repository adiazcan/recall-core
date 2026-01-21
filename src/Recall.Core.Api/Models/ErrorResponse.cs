namespace Recall.Core.Api.Models;

public record ErrorResponse(ErrorDetail Error);

public record ErrorDetail(string Code, string Message);
