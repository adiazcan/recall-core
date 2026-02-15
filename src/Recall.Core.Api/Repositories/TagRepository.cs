using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using EntityTag = Recall.Core.Api.Entities.Tag;

namespace Recall.Core.Api.Repositories;

public sealed class TagRepository(IMongoDatabase database) : ITagRepository
{
    private const int MaxGetByIdsLimit = 1000;
    private readonly IMongoCollection<EntityTag> _tags = database.GetCollection<EntityTag>("tags");

    public async Task<EntityTag> CreateAsync(string userId, EntityTag tag, CancellationToken cancellationToken = default)
    {
        tag.UserId = userId;

        try
        {
            await _tags.InsertOneAsync(tag, cancellationToken: cancellationToken);
            return tag;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            var existing = await _tags
                .Find(candidate => candidate.UserId == userId && candidate.NormalizedName == tag.NormalizedName)
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null)
            {
                return existing;
            }

            throw;
        }
    }

    public async Task<EntityTag?> GetByIdAsync(string userId, ObjectId id, CancellationToken cancellationToken = default)
    {
        return await _tags
            .Find(tag => tag.Id == id && tag.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<EntityTag?> GetByNormalizedNameAsync(string userId, string normalizedName, CancellationToken cancellationToken = default)
    {
        return await _tags
            .Find(tag => tag.UserId == userId && tag.NormalizedName == normalizedName)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EntityTag>> GetByIdsAsync(string userId, IEnumerable<ObjectId> ids, CancellationToken cancellationToken = default)
    {
        var tagIds = ids.Distinct().ToList();
        if (tagIds.Count == 0)
        {
            return Array.Empty<EntityTag>();
        }

        if (tagIds.Count > MaxGetByIdsLimit)
        {
            throw new ArgumentException($"Cannot retrieve more than {MaxGetByIdsLimit} tags at once.", nameof(ids));
        }

        var filter = Builders<EntityTag>.Filter.Eq(tag => tag.UserId, userId)
                 & Builders<EntityTag>.Filter.In(tag => tag.Id, tagIds);

        return await _tags
            .Find(filter)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EntityTag>> ListAsync(
        string userId,
        string? query,
        string? cursor,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<EntityTag>.Filter.Eq(tag => tag.UserId, userId);

        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalizedQuery = query.Trim().ToLowerInvariant();
            filter &= Builders<EntityTag>.Filter.Regex(
                tag => tag.NormalizedName,
                new BsonRegularExpression($"^{Regex.Escape(normalizedQuery)}"));
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            var cursorToken = ParseCursor(cursor);
            var cursorFilter =
                Builders<EntityTag>.Filter.Gt(tag => tag.NormalizedName, cursorToken.NormalizedName)
                |
                (
                    Builders<EntityTag>.Filter.Eq(tag => tag.NormalizedName, cursorToken.NormalizedName)
                    & Builders<EntityTag>.Filter.Gt(tag => tag.Id, cursorToken.Id)
                );

            filter &= cursorFilter;
        }

        return await _tags
            .Find(filter)
            .SortBy(tag => tag.NormalizedName)
            .ThenBy(tag => tag.Id)
            .Limit(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<EntityTag?> UpdateAsync(string userId, ObjectId id, UpdateDefinition<EntityTag> update, CancellationToken cancellationToken = default)
    {
        var filter = Builders<EntityTag>.Filter.Eq(tag => tag.Id, id)
                     & Builders<EntityTag>.Filter.Eq(tag => tag.UserId, userId);

        var result = await _tags.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        if (result.MatchedCount == 0)
        {
            return null;
        }

        return await _tags
            .Find(filter)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<long> DeleteAsync(string userId, ObjectId id, CancellationToken cancellationToken = default)
    {
        var result = await _tags.DeleteOneAsync(tag => tag.Id == id && tag.UserId == userId, cancellationToken);
        return result.DeletedCount;
    }

    private static TagCursorToken ParseCursor(string cursor)
    {
        var parts = cursor.Split('|', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0]) || !ObjectId.TryParse(parts[1], out var objectId))
        {
            throw new ArgumentException("Cursor is invalid.", nameof(cursor));
        }

        return new TagCursorToken(parts[0], objectId);
    }

    private sealed record TagCursorToken(string NormalizedName, ObjectId Id);
}
