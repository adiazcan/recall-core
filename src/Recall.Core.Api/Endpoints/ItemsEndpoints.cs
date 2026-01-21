using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class ItemsEndpoints
{
    public static IEndpointRouteBuilder MapItemsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/items", async (CreateItemRequest request, IItemService service, CancellationToken cancellationToken) =>
            {
                try
                {
                    var result = await service.SaveItemAsync(request, cancellationToken);
                    var dto = ItemDto.FromEntity(result.Item);
                    return result.Created
                        ? Results.Created($"/api/v1/items/{dto.Id}", dto)
                        : Results.Ok(dto);
                }
                catch (RequestValidationException ex)
                {
                    return Results.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                }
                catch (ArgumentException ex) when (string.Equals(ex.ParamName, "url", StringComparison.Ordinal))
                {
                    return Results.BadRequest(new ErrorResponse(new ErrorDetail("invalid_url", ex.Message)));
                }
            })
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Save a URL";
                operation.Description = "Save a new URL for later with optional title and tags.";
                return Task.CompletedTask;
            });

        endpoints.MapGet(
                "/api/v1/items",
                async (
                    string? status,
                    string? collectionId,
                    string? tag,
                    bool? isFavorite,
                    string? cursor,
                    int? limit,
                    IItemService service,
                    CancellationToken cancellationToken) =>
                {
                    try
                    {
                        var response = await service.ListItemsAsync(
                            status,
                            collectionId,
                            tag,
                            isFavorite,
                            cursor,
                            limit,
                            cancellationToken);
                        return Results.Ok(response);
                    }
                    catch (RequestValidationException ex)
                    {
                        return Results.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List saved items";
                operation.Description = "Retrieve a paginated list of saved items with optional filters.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}
