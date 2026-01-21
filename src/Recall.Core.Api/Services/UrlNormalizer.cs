using Microsoft.AspNetCore.WebUtilities;

namespace Recall.Core.Api.Services;

public static class UrlNormalizer
{
    public static string Normalize(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            throw new ArgumentException("Invalid URL", nameof(url));
        }

        if (uri.Scheme is not ("http" or "https"))
        {
            throw new ArgumentException("Only http/https URLs allowed", nameof(url));
        }

        var builder = new UriBuilder(uri)
        {
            Scheme = uri.Scheme.ToLowerInvariant(),
            Host = uri.Host.ToLowerInvariant(),
            Fragment = string.Empty
        };

        if (builder.Scheme == Uri.UriSchemeHttp && builder.Port == 80)
        {
            builder.Port = -1;
        }
        else if (builder.Scheme == Uri.UriSchemeHttps && builder.Port == 443)
        {
            builder.Port = -1;
        }

        if (builder.Path.Length > 1 && builder.Path.EndsWith("/", StringComparison.Ordinal))
        {
            builder.Path = builder.Path.TrimEnd('/');
        }

        if (!string.IsNullOrEmpty(uri.Query))
        {
            var parsed = QueryHelpers.ParseQuery(uri.Query);
            var keys = parsed.Keys
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .OrderBy(key => key, StringComparer.Ordinal);

            var pairs = new List<string>();
            foreach (var key in keys)
            {
                var values = parsed[key].ToArray();
                Array.Sort(values, StringComparer.Ordinal);

                foreach (var value in values)
                {
                    var encodedKey = Uri.EscapeDataString(key);
                    var encodedValue = value is null ? string.Empty : Uri.EscapeDataString(value);
                    pairs.Add($"{encodedKey}={encodedValue}");
                }
            }

            builder.Query = string.Join("&", pairs);
        }
        else
        {
            builder.Query = string.Empty;
        }

        var normalized = builder.Uri.ToString();
        if (builder.Path.Length > 1 && normalized.EndsWith("/", StringComparison.Ordinal))
        {
            normalized = normalized.TrimEnd('/');
        }

        return normalized;
    }
}
