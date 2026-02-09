using System.Net;
using System.Net.Sockets;

namespace Recall.Core.Enrichment.Common.Services;

public sealed class SsrfValidator : ISsrfValidator
{
    public async Task<SsrfValidationResult> ValidateAsync(string url, CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return new SsrfValidationResult(false, "Invalid URL format.");
        }

        if (uri.Scheme is not ("http" or "https"))
        {
            return new SsrfValidationResult(false, "Only http/https URLs are allowed.");
        }

        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(uri.DnsSafeHost, cancellationToken);
        }
        catch
        {
            return new SsrfValidationResult(false, "DNS resolution failed.");
        }

        if (addresses.Length == 0)
        {
            return new SsrfValidationResult(false, "DNS resolution failed.");
        }

        foreach (var address in addresses)
        {
            var ip = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
            if (IsBlocked(ip))
            {
                return new SsrfValidationResult(false, "URL blocked: private network access not allowed.");
            }
        }

        return new SsrfValidationResult(true, null);
    }

    private static bool IsBlocked(IPAddress ip)
    {
        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = ip.GetAddressBytes();
            var first = bytes[0];
            var second = bytes[1];

            if (first == 10)
            {
                return true;
            }

            if (first == 172 && second is >= 16 and <= 31)
            {
                return true;
            }

            if (first == 192 && second == 168)
            {
                return true;
            }

            if (first == 127)
            {
                return true;
            }

            if (first == 169 && second == 254)
            {
                return true;
            }

            return false;
        }

        if (IPAddress.IsLoopback(ip))
        {
            return true;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            var bytes = ip.GetAddressBytes();

            if ((bytes[0] & 0xFE) == 0xFC)
            {
                return true;
            }

            if (bytes[0] == 0xFE && (bytes[1] & 0xC0) == 0x80)
            {
                return true;
            }
        }

        return false;
    }
}
