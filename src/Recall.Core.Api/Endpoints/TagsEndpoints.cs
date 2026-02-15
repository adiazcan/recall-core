using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Auth;
using Recall.Core.Api.Models;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class TagsEndpoints
{
    public static IEndpointRouteBuilder MapTagsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/tags")
            .RequireAuthorization("ApiScope")
            .WithTags("Tags");

        group.MapPost("", async Task<Results<Created<TagDto>, Ok<TagDto>, BadRequest<ErrorResponse>>>
            (CreateTagRequest request, IUserContext userContext, ITagService service, CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var result = await service.CreateAsync(userContext.UserId, request, cancellationToken);
                        return result.Created
                            ? TypedResults.Created($"/api/v1/tags/{result.Tag.Id}", result.Tag)
                            : TypedResults.Ok(result.Tag);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Created<TagDto>>(StatusCodes.Status201Created)
            .Produces<Ok<TagDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Create a new tag";
                operation.Description = "Create a new tag for the authenticated user. Returns an existing tag for duplicate normalized names.";
                return Task.CompletedTask;
            });

        group.MapGet("", async Task<Results<Ok<TagListResponse>, BadRequest<ErrorResponse>>>
            (
                string? q,
                string? cursor,
                int? limit,
                IUserContext userContext,
                ITagService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var response = await service.ListAsync(userContext.UserId, q, cursor, limit, cancellationToken);
                        return TypedResults.Ok(response);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagListResponse>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List tags with item counts";
                operation.Description = "Retrieve a paginated list of the authenticated user's tags with optional search.";
                return Task.CompletedTask;
            });

        group.MapGet("{id}", async Task<Results<Ok<TagDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                IUserContext userContext,
                ITagService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var tag = await service.GetByIdAsync(userContext.UserId, id, cancellationToken);
                        if (tag is null)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                        }

                        return TypedResults.Ok(tag);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get a tag by ID";
                operation.Description = "Retrieve a single tag and its item count for the authenticated user.";
                return Task.CompletedTask;
            });

        group.MapPatch("{id}", async Task<Results<Ok<TagDto>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>, Conflict<ErrorResponse>>>
            (
                string id,
                UpdateTagRequest request,
                IUserContext userContext,
                ITagService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var tag = await service.UpdateAsync(userContext.UserId, id, request, cancellationToken);
                        if (tag is null)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                        }

                        return TypedResults.Ok(tag);
                    }
                    catch (RequestValidationException ex) when (string.Equals(ex.Code, "duplicate_tag", StringComparison.Ordinal))
                    {
                        return TypedResults.Conflict(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagDto>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .Produces<Conflict<ErrorResponse>>(StatusCodes.Status409Conflict)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Update a tag";
                operation.Description = "Update a tag's display name and/or color.";
                return Task.CompletedTask;
            });

        group.MapDelete("{id}", async Task<Results<Ok<TagDeleteResponse>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string id,
                IUserContext userContext,
                ITagService service,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var result = await service.DeleteAsync(userContext.UserId, id, cancellationToken);
                        return result is null
                            ? TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")))
                            : TypedResults.Ok(result);
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagDeleteResponse>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Delete a tag";
                operation.Description = "Delete a tag and remove references from items.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}
