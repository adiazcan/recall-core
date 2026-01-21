using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class ItemsEndpoints
{
    public static IEndpointRouteBuilder MapItemsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/items", async Task<Results<Created<ItemDto>, Ok<ItemDto>, BadRequest<ErrorResponse>>>
            (CreateItemRequest request, IItemService service, CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var result = await service.SaveItemAsync(request, cancellationToken);
                        var dto = ItemDto.FromEntity(result.Item);
                        return result.Created
                            ? TypedResults.Created($"/api/v1/items/{dto.Id}", dto)
                            : TypedResults.Ok(dto);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                    catch (ArgumentException ex) when (string.Equals(ex.ParamName, "url", StringComparison.Ordinal))
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail("invalid_url", ex.Message)));
                    }
                })
            .Produces<Created<ItemDto>>(StatusCodes.Status201Created)
            .Produces<Ok<ItemDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Save a URL";
                operation.Description = "Save a new URL for later with optional title and tags.";
                return Task.CompletedTask;
            });

        endpoints.MapGet(
            "/api/v1/items",
            async Task<Results<Ok<ItemListResponse>, BadRequest<ErrorResponse>>>
            (
                    string? status,
                    string? collectionId,
                    string? tag,
                    bool? isFavorite,
                    string? cursor,
                    int? limit,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
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
                            return TypedResults.Ok(response);
                        }
                        catch (RequestValidationException ex)
                        {
                            return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }
                    })
            .Produces<Ok<ItemListResponse>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List saved items";
                operation.Description = "Retrieve a paginated list of saved items with optional filters.";
                return Task.CompletedTask;
            });

        endpoints.MapGet(
            "/api/v1/items/{id}",
            async Task<Results<Ok<ItemDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var item = await service.GetItemByIdAsync(id, cancellationToken);
                            if (item is null)
                            {
                                return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Item not found")));
                            }

                            return TypedResults.Ok(ItemDto.FromEntity(item));
                        }
                        catch (RequestValidationException ex)
                        {
                            return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }
                    })
            .Produces<Ok<ItemDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get item details";
                operation.Description = "Retrieve a single saved item by id.";
                return Task.CompletedTask;
            });

        endpoints.MapPatch(
            "/api/v1/items/{id}",
            async Task<Results<Ok<ItemDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    UpdateItemRequest request,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var updated = await service.UpdateItemAsync(id, request, cancellationToken);
                            if (updated is null)
                            {
                                return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Item not found")));
                            }

                            return TypedResults.Ok(ItemDto.FromEntity(updated));
                        }
                        catch (RequestValidationException ex)
                        {
                            return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }
                    })
            .Produces<Ok<ItemDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Update item metadata";
                operation.Description = "Update item fields like status, favorite, collection, title, excerpt, or tags.";
                return Task.CompletedTask;
            });

        endpoints.MapDelete(
            "/api/v1/items/{id}",
            async Task<Results<NoContent, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var deleted = await service.DeleteItemAsync(id, cancellationToken);
                            if (!deleted)
                            {
                                return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Item not found")));
                            }

                            return TypedResults.NoContent();
                        }
                        catch (RequestValidationException ex)
                        {
                            return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }
                    })
            .Produces<NoContent>(StatusCodes.Status204NoContent)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .WithTags("Items")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Delete an item";
                operation.Description = "Permanently remove a saved item.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}
