using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;
using Recall.Core.Api.Services;

namespace Recall.Core.Api.Endpoints;

public static class TagsEndpoints
{
    public static IEndpointRouteBuilder MapTagsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/tags", async (IItemRepository repository, CancellationToken cancellationToken) =>
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

                return Results.Ok(response);
            })
            .WithTags("Tags")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "List all tags with counts";
                operation.Description = "Retrieve all tags used across items with item counts.";
                return Task.CompletedTask;
            });

        endpoints.MapPatch("/api/v1/tags/{name}", async (
                string name,
                RenameTagRequest request,
                IItemRepository repository,
                CancellationToken cancellationToken) =>
            {
                try
                {
                    var oldName = NormalizeTagName(name, "Tag name is required.");
                    var newName = NormalizeTagName(request.NewName, "New tag name is required.");

                    var itemsUpdated = await repository.RenameTagAsync(oldName, newName, cancellationToken);
                    if (itemsUpdated == 0)
                    {
                        return Results.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                    }

                    return Results.Ok(new TagOperationResponse
                    {
                        OldName = oldName,
                        NewName = newName,
                        ItemsUpdated = (int)itemsUpdated
                    });
                }
                catch (RequestValidationException ex)
                {
                    return Results.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                }
            })
            .WithTags("Tags")
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Rename a tag globally";
                operation.Description = "Rename a tag across all items that use it.";
                return Task.CompletedTask;
            });

        endpoints.MapDelete("/api/v1/tags/{name}", async (
                string name,
                IItemRepository repository,
                CancellationToken cancellationToken) =>
            {
                try
                {
                    var tagName = NormalizeTagName(name, "Tag name is required.");
                    var itemsUpdated = await repository.DeleteTagAsync(tagName, cancellationToken);
                    if (itemsUpdated == 0)
                    {
                        return Results.NotFound(new ErrorResponse(new ErrorDetail("not_found", "Tag not found.")));
                    }

                    return Results.Ok(new TagOperationResponse
                    {
                        OldName = tagName,
                        NewName = null,
                        ItemsUpdated = (int)itemsUpdated
                    });
                }
                catch (RequestValidationException ex)
                {
                    return Results.BadRequest(new ErrorResponse(new ErrorDetail(ex.Code, ex.Message)));
                }
            })
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
