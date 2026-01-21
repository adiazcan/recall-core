using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class TagsEndpoints
{
    public static IEndpointRouteBuilder MapTagsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/tags", async Task<Ok<TagListResponse>>
            (IItemRepository repository, CancellationToken cancellationToken)
                =>
                {
                    var tags = await repository.GetAllTagsWithCountsAsync(cancellationToken);
                    var response = new TagListResponse
                    {
                        Tags = tags.Select(tag => new TagDto
                        {
                            Name = tag.Name,
                            Count = tag.Count
                        }).ToList()
                    };

                    return TypedResults.Ok(response);
                })
            .Produces<Ok<TagListResponse>>(StatusCodes.Status200OK)
            .WithTags("Tags")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List all tags with counts";
                operation.Description = "Retrieve all tags used across items with item counts.";
                return Task.CompletedTask;
            });

        endpoints.MapPatch("/api/v1/tags/{name}", async Task<Results<Ok<TagOperationResponse>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string name,
                RenameTagRequest request,
                IItemRepository repository,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var oldName = NormalizeTagName(name, "Tag name is required.");
                        var newName = NormalizeTagName(request.NewName, "New tag name is required.");

                        var itemsUpdated = await repository.RenameTagAsync(oldName, newName, cancellationToken);
                        if (itemsUpdated == 0)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                        }

                        return TypedResults.Ok(new TagOperationResponse
                        {
                            OldName = oldName,
                            NewName = newName,
                            ItemsUpdated = (int)itemsUpdated
                        });
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagOperationResponse>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .WithTags("Tags")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Rename a tag globally";
                operation.Description = "Rename a tag across all items that use it.";
                return Task.CompletedTask;
            });

        endpoints.MapDelete("/api/v1/tags/{name}", async Task<Results<Ok<TagOperationResponse>, NotFound<ErrorResponse>, BadRequest<ErrorResponse>>>
            (
                string name,
                IItemRepository repository,
                CancellationToken cancellationToken)
                =>
                {
                    try
                    {
                        var tagName = NormalizeTagName(name, "Tag name is required.");
                        var itemsUpdated = await repository.DeleteTagAsync(tagName, cancellationToken);
                        if (itemsUpdated == 0)
                        {
                            return TypedResults.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                        }

                        return TypedResults.Ok(new TagOperationResponse
                        {
                            OldName = tagName,
                            NewName = null,
                            ItemsUpdated = (int)itemsUpdated
                        });
                    }
                    catch (RequestValidationException ex)
                    {
                        return TypedResults.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                    }
                })
            .Produces<Ok<TagOperationResponse>>(StatusCodes.Status200OK)
            .Produces<BadRequest<ErrorResponse>>(StatusCodes.Status400BadRequest)
            .Produces<NotFound<ErrorResponse>>(StatusCodes.Status404NotFound)
            .WithTags("Tags")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Delete a tag";
                operation.Description = "Remove a tag from all items.";
                return Task.CompletedTask;
            });

        return endpoints;
    }

    private static string NormalizeTagName(string? name, string requiredMessage)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new RequestValidationException("validation_error", requiredMessage);
        }

        var normalized = name.Trim().ToLowerInvariant();
        if (normalized.Length > 50)
        {
            throw new RequestValidationException("validation_error", "Tag must be 50 characters or fewer.");
        }

        return normalized;
    }
}
