using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Recall.Core.Api.Auth;

public sealed class HttpUserContext : IUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string UserId
    {
        get
        {
            var principal = _httpContextAccessor.HttpContext?.User;
            var userId = principal?.FindFirstValue("sub")
                ?? principal?.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new InvalidOperationException("Authenticated user id not found.");
            }

            return userId;
        }
    }
}
