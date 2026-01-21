using System.Text;
using System.Text.Json;

namespace Recall.Core.Api.Models;

public record CursorToken(string Id, DateTime CreatedAt);

public static class CursorPagination
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static string Encode(CursorToken token)
    {
        var payload = JsonSerializer.Serialize(token, SerializerOptions);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(payload));
    }

    public static string Encode(string id, DateTime createdAt)
    {
        return Encode(new CursorToken(id, createdAt));
    }

    public static bool TryDecode(string? cursor, out CursorToken? token)
    {
        token = null;
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return false;
        }

        try
        {
            var bytes = Convert.FromBase64String(cursor);
            var json = Encoding.UTF8.GetString(bytes);
            token = JsonSerializer.Deserialize<CursorToken>(json, SerializerOptions);
            return token is not null && !string.IsNullOrWhiteSpace(token.Id);
        }
        catch (FormatException)
        {
            return false;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
