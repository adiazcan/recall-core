using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Auth;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class ItemsEndpoints
{
    public static IEndpointRouteBuilder MapItemsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/items")
            .RequireAuthorization("ApiScope")
            .WithTags("Items");

        group.MapPost("", async Task<Results<Created<ItemDto>, Ok<ItemDto>, BadRequest<ErrorResponse>>>
            (CreateItemRequest request, IUserContext userContext, IItemService service, CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var result = await service.SaveItemAsync(userContext.UserId, request, cancellationToken);
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
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Save a URL";
                operation.Description = "Save a new URL for later with optional title and tags.";
                return Task.CompletedTask;
            });

        group.MapGet(
            "",
            async Task<Results<Ok<ItemListResponse>, BadRequest<ErrorResponse>>>
            (
                    string? status,
                    string? collectionId,
                    string? tag,
                    bool? isFavorite,
                    string? enrichmentStatus,
                    string? cursor,
                    int? limit,
                    IUserContext userContext,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var response = await service.ListItemsAsync(
                                userContext.UserId,
                                status,
                                collectionId,
                                tag,
                                isFavorite,
                                enrichmentStatus,
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
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List saved items";
                operation.Description = "Retrieve a paginated list of saved items with optional filters.";
                return Task.CompletedTask;
            });

        group.MapGet(
            "{id}",
            async Task<Results<Ok<ItemDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    IUserContext userContext,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var item = await service.GetItemByIdAsync(userContext.UserId, id, cancellationToken);
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
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get item details";
                operation.Description = "Retrieve a single saved item by id.";
                return Task.CompletedTask;
            });

        group.MapPatch(
            "{id}",
            async Task<Results<Ok<ItemDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    UpdateItemRequest request,
                    IUserContext userContext,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var updated = await service.UpdateItemAsync(userContext.UserId, id, request, cancellationToken);
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
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Update item metadata";
                operation.Description = "Update item fields like status, favorite, collection, title, excerpt, or tags.";
                return Task.CompletedTask;
            });

        group.MapDelete(
            "{id}",
            async Task<Results<NoContent, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                    string id,
                    IUserContext userContext,
                    IItemService service,
                    CancellationToken cancellationToken)
                    =>
                    {
                        try
                        {
                            var deleted = await service.DeleteItemAsync(userContext.UserId, id, cancellationToken);
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
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Delete an item";
                operation.Description = "Permanently remove a saved item.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}
