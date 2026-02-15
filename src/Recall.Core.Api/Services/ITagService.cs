using Recall.Core.Api.Models;

namespace Recall.Core.Api.Services;

/// <summary>
/// Service for managing tag entities and their lifecycle operations.
/// </summary>
public interface ITagService
{
    /// <summary>
    /// Creates a new tag or returns an existing tag with the same normalized name.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="request">The tag creation request containing name and optional color.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A result containing the tag DTO and a flag indicating if it was newly created.</returns>
    Task<CreateTagResult> CreateAsync(string userId, CreateTagRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tag by its ID with item count.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID (ObjectId as string).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The tag DTO if found; otherwise, null.</returns>
    Task<TagDto?> GetByIdAsync(string userId, string id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists tags with optional search query and cursor-based pagination.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="query">Optional search query for filtering by normalized name prefix.</param>
    /// <param name="cursor">Optional cursor for pagination.</param>
    /// <param name="limit">Maximum number of results to return (1-100, default 50).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A paginated list of tags with item counts and pagination metadata.</returns>
    Task<TagListResponse> ListAsync(string userId, string? query, string? cursor, int? limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a tag's display name and/or color.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID (ObjectId as string).</param>
    /// <param name="request">The update request containing optional name and/or color.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated tag DTO if found; otherwise, null.</returns>
    Task<TagDto?> UpdateAsync(string userId, string id, UpdateTagRequest request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a tag and removes it from all associated items.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID (ObjectId as string).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A response containing the deleted tag ID and the number of items updated; otherwise, null if not found.</returns>
    Task<TagDeleteResponse?> DeleteAsync(string userId, string id, CancellationToken cancellationToken = default);
}

public sealed record CreateTagResult(TagDto Tag, bool Created);
