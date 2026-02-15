using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using EntityTag = Recall.Core.Api.Entities.Tag;

namespace Recall.Core.Api.Repositories;

/// <summary>
/// Repository for tag entity persistence and retrieval operations.
/// </summary>
public interface ITagRepository
{
    /// <summary>
    /// Creates a new tag or returns an existing tag if a duplicate normalized name is detected.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="tag">The tag entity to create.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The created tag or existing tag with the same normalized name.</returns>
    Task<EntityTag> CreateAsync(string userId, EntityTag tag, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tag by its ID for the specified user.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The tag if found; otherwise, null.</returns>
    Task<EntityTag?> GetByIdAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a tag by its normalized name for the specified user.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="normalizedName">The normalized tag name (lowercase).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The tag if found; otherwise, null.</returns>
    Task<EntityTag?> GetByNormalizedNameAsync(string userId, string normalizedName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves multiple tags by their IDs for the specified user.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="ids">The collection of tag IDs (maximum 1000).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A list of found tags.</returns>
    Task<IReadOnlyList<EntityTag>> GetByIdsAsync(string userId, IEnumerable<ObjectId> ids, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists tags with optional search query and cursor-based pagination.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="query">Optional search query for filtering by normalized name prefix.</param>
    /// <param name="cursor">Optional cursor for pagination.</param>
    /// <param name="limit">Maximum number of results to return.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A list of tags matching the criteria.</returns>
    Task<IReadOnlyList<EntityTag>> ListAsync(string userId, string? query, string? cursor, int limit, CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates a tag with the specified update definition.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID.</param>
    /// <param name="update">The MongoDB update definition.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated tag if found; otherwise, null.</returns>
    Task<EntityTag?> UpdateAsync(string userId, ObjectId id, UpdateDefinition<EntityTag> update, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a tag.
    /// </summary>
    /// <param name="userId">The user ID for data isolation.</param>
    /// <param name="id">The tag ID.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The number of tags deleted (0 or 1).</returns>
    Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken cancellationToken = default);
}
