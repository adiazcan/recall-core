using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Auth;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class CollectionsEndpoints
{
    public static IEndpointRouteBuilder MapCollectionsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/collections")
            .RequireAuthorization("ApiScope")
            .WithTags("Collections");

        group.MapPost("", async Task<Results<Created<CollectionDto>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>>
            (
                CreateCollectionRequest request,
                IUserContext userContext,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var dto = await service.CreateCollectionAsync(userContext.UserId, request, cancellationToken);
                        return TypedResults.Created($"/api/v1/collections/{dto.Id}", dto);
                    }
                    catch (RequestValidationException ex)
                    {
                        if (string.Equals(ex.Code, "conflict", StringComparison.Ordinal))
                        {
                            return TypedResults.Conflict(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }

                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Created<CollectionDto>>(StatusCodes.Status201Created)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<Conflict<ErrorResponse>>(StatusCodes.Status409Conflict)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Create a collection";
                operation.Description = "Create a new collection for organizing items.";
                return Task.CompletedTask;
            });

        group.MapGet("", async Task<Ok<CollectionListResponse>>
            (
                IUserContext userContext,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    var collections = await service.ListCollectionsAsync(userContext.UserId, cancellationToken);
                    return TypedResults.Ok(new CollectionListResponse { Collections = collections });
                })
            .Produces<Ok<CollectionListResponse>>(StatusCodes.Status200OK)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List collections";
                operation.Description = "Retrieve all collections with their item counts.";
                return Task.CompletedTask;
            });

        group.MapGet("{id}", async Task<Results<Ok<CollectionDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                IUserContext userContext,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var collection = await service.GetCollectionAsync(userContext.UserId, id, cancellationToken);
                        return collection is null
                            ? TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Collection not found.")))
                            : TypedResults.Ok(collection);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<CollectionDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get collection details";
                operation.Description = "Retrieve a specific collection with its item count.";
                return Task.CompletedTask;
            });

        group.MapPatch("{id}", async Task<Results<Ok<CollectionDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>>
            (
                string id,
                UpdateCollectionRequest request,
                IUserContext userContext,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var collection = await service.UpdateCollectionAsync(userContext.UserId, id, request, cancellationToken);
                        if (collection is null)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Collection not found.")));
                        }

                        return TypedResults.Ok(collection);
                    }
                    catch (RequestValidationException ex)
                    {
                        if (string.Equals(ex.Code, "conflict", StringComparison.Ordinal))
                        {
                            return TypedResults.Conflict(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                        }

                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<CollectionDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .Produces<Conflict<ErrorResponse>>(StatusCodes.Status409Conflict)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Update a collection";
                operation.Description = "Update a collection's name, description, or parent.";
                return Task.CompletedTask;
            });

        group.MapDelete("{id}", async Task<Results<NoContent, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                string? mode,
                IUserContext userContext,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var deleted = await service.DeleteCollectionAsync(userContext.UserId, id, mode, cancellationToken);
                        if (!deleted)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Collection not found.")));
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
                operation.Summary = "Delete a collection";
                operation.Description = "Delete a collection with default or cascade mode.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}