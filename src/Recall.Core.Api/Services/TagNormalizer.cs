namespace Recall.Core.Api.Services;

public static class TagNormalizer
{
    public const int MaxLength = 50;

    public static string Normalize(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Tag name cannot be empty.", nameof(displayName));
        }

        var trimmed = displayName.Trim();
        if (trimmed.Length > MaxLength)
        {
            throw new ArgumentException($"Tag name must be {MaxLength} characters or fewer.", nameof(displayName));
        }

        return trimmed.ToLowerInvariant();
    }
}
