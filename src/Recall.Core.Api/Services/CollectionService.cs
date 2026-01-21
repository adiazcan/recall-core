using MongoDB.Bson;
using MongoDB.Driver;
using Recall.Core.Api.Entities;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;

namespace Recall.Core.Api.Services;

public sealed class CollectionService(ICollectionRepository repository) : ICollectionService
{
    public async Task<CollectionDto> CreateCollectionAsync(
        CreateCollectionRequest request,
        CancellationToken cancellationToken = default)
    {
        var name = NormalizeName(request.Name);
        var description = NormalizeDescription(request.Description);
        var parentId = await NormalizeParentIdAsync(request.ParentId, cancellationToken);

        var now = DateTime.UtcNow;
        var collection = new Collection
        {
            Name = name,
            Description = description,
            ParentId = parentId,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            await repository.InsertAsync(collection, cancellationToken);
            return CollectionDto.FromEntity(collection, 0);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new RequestValidationException("conflict", "A collection with this name already exists.");
        }
    }

    public async Task<IReadOnlyList<CollectionDto>> ListCollectionsAsync(CancellationToken cancellationToken = default)
    {
        var collections = await repository.ListWithCountsAsync(cancellationToken);
        return collections
            .Select(result => CollectionDto.FromEntity(result.Collection, result.ItemCount))
            .ToList();
    }

    public async Task<CollectionDto?> GetCollectionAsync(string id, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "CollectionId must be a valid ObjectId.");
        var result = await repository.GetWithCountAsync(objectId, cancellationToken);
        return result is null ? null : CollectionDto.FromEntity(result.Collection, result.ItemCount);
    }

    public async Task<CollectionDto?> UpdateCollectionAsync(
        string id,
        UpdateCollectionRequest request,
        CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "CollectionId must be a valid ObjectId.");
        var collection = await repository.GetByIdAsync(objectId, cancellationToken);
        if (collection is null)
        {
            return null;
        }

        var updated = false;

        if (request.Name is not null)
        {
            var name = NormalizeName(request.Name);
            if (!string.Equals(collection.Name, name, StringComparison.Ordinal))
            {
                collection.Name = name;
                updated = true;
            }
        }

        if (request.Description is not null)
        {
            var description = NormalizeDescription(request.Description, allowNull: true);
            if (!string.Equals(collection.Description, description, StringComparison.Ordinal))
            {
                collection.Description = description;
                updated = true;
            }
        }

        if (request.ParentId is not null)
        {
            var parentId = await NormalizeParentIdAsync(request.ParentId, cancellationToken);
            if (parentId.HasValue && parentId.Value == collection.Id)
            {
                throw new RequestValidationException("validation_error", "Collection cannot be its own parent.");
            }

            if (collection.ParentId != parentId)
            {
                collection.ParentId = parentId;
                updated = true;
            }
        }

        if (updated)
        {
            collection.UpdatedAt = DateTime.UtcNow;
            try
            {
                var saved = await repository.ReplaceAsync(collection, cancellationToken);
                if (!saved)
                {
                    return null;
                }
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                throw new RequestValidationException("conflict", "A collection with this name already exists.");
            }
        }

        var result = await repository.GetWithCountAsync(objectId, cancellationToken);
        return result is null ? null : CollectionDto.FromEntity(result.Collection, result.ItemCount);
    }

    public async Task<bool> DeleteCollectionAsync(string id, string? mode, CancellationToken cancellationToken = default)
    {
        var objectId = ParseObjectId(id, "CollectionId must be a valid ObjectId.");
        var collection = await repository.GetByIdAsync(objectId, cancellationToken);
        if (collection is null)
        {
            return false;
        }

        var deleteMode = NormalizeDeleteMode(mode);
        if (string.Equals(deleteMode, "cascade", StringComparison.Ordinal))
        {
            await repository.DeleteItemsAsync(objectId, cancellationToken);
        }
        else
        {
            await repository.OrphanItemsAsync(objectId, cancellationToken);
        }

        await repository.DeleteAsync(objectId, cancellationToken);
        return true;
    }

    private static string NormalizeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new RequestValidationException("validation_error", "Collection name is required.");
        }

        var trimmed = name.Trim();
        if (trimmed.Length > 100)
        {
            throw new RequestValidationException("validation_error", "Collection name must be 100 characters or fewer.");
        }

        return trimmed;
    }

    private static string? NormalizeDescription(string? description, bool allowNull = false)
    {
        if (description is null)
        {
            if (allowNull)
            {
                return null;
            }
            throw new RequestValidationException("validation_error", "Description is required.");
        }

        var trimmed = description.Trim();
        if (trimmed.Length > 500)
        {
            throw new RequestValidationException("validation_error", "Description must be 500 characters or fewer.");
        }

        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private async Task<ObjectId?> NormalizeParentIdAsync(string? parentId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(parentId))
        {
            return null;
        }

        if (!ObjectId.TryParse(parentId, out var objectId))
        {
            throw new RequestValidationException("validation_error", "ParentId must be a valid ObjectId.");
        }

        var parent = await repository.GetByIdAsync(objectId, cancellationToken);
        if (parent is null)
        {
            throw new RequestValidationException("validation_error", "Parent collection not found.");
        }

        return objectId;
    }

    private static ObjectId ParseObjectId(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value) || !ObjectId.TryParse(value, out var objectId))
        {
            throw new RequestValidationException("validation_error", message);
        }

        return objectId;
    }

    private static string NormalizeDeleteMode(string? mode)
    {
        if (string.IsNullOrWhiteSpace(mode))
        {
            return "default";
        }

        var normalized = mode.Trim().ToLowerInvariant();
        return normalized switch
        {
            "default" => normalized,
            "cascade" => normalized,
            _ => throw new RequestValidationException("validation_error", "Mode must be default or cascade.")
        };
    }
}