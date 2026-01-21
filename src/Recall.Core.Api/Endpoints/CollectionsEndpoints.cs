using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class CollectionsEndpoints
{
    public static IEndpointRouteBuilder MapCollectionsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/v1/collections", async Task<Results<Created<CollectionDto>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>>
            (
                CreateCollectionRequest request,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var dto = await service.CreateCollectionAsync(request, cancellationToken);
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
            .WithTags("Collections")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Create a collection";
                operation.Description = "Create a new collection for organizing items.";
                return Task.CompletedTask;
            });

        endpoints.MapGet("/api/v1/collections", async Task<Ok<CollectionListResponse>>
            (
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    var collections = await service.ListCollectionsAsync(cancellationToken);
                    return TypedResults.Ok(new CollectionListResponse { Collections = collections });
                })
            .Produces<Ok<CollectionListResponse>>(StatusCodes.Status200OK)
            .WithTags("Collections")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List collections";
                operation.Description = "Retrieve all collections with their item counts.";
                return Task.CompletedTask;
            });

        endpoints.MapGet("/api/v1/collections/{id}", async Task<Results<Ok<CollectionDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var collection = await service.GetCollectionAsync(id, cancellationToken);
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
            .WithTags("Collections")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get collection details";
                operation.Description = "Retrieve a specific collection with its item count.";
                return Task.CompletedTask;
            });

        endpoints.MapPatch("/api/v1/collections/{id}", async Task<Results<Ok<CollectionDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>>
            (
                string id,
                UpdateCollectionRequest request,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var collection = await service.UpdateCollectionAsync(id, request, cancellationToken);
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
            .WithTags("Collections")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Update a collection";
                operation.Description = "Update a collection's name, description, or parent.";
                return Task.CompletedTask;
            });

        endpoints.MapDelete("/api/v1/collections/{id}", async Task<Results<NoContent, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                string? mode,
                ICollectionService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var deleted = await service.DeleteCollectionAsync(id, mode, cancellationToken);
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
            .WithTags("Collections")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Delete a collection";
                operation.Description = "Delete a collection with default or cascade mode.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}