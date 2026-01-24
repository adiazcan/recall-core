using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Recall.Core.Api.Auth;
using Recall.Core.Api.Models;

namespace Recall.Core.Api.Endpoints;

public static class MeEndpoints
{
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(
                "/api/v1/me",
                Results<Ok<UserInfoResponse>, UnauthorizedHttpResult>
                (ClaimsPrincipal user, IUserContext userContext) =>
                {
                    try
                    {
                        var sub = userContext.UserId;
                        var tenantId = user.FindFirstValue("tid");
                        if (string.IsNullOrWhiteSpace(tenantId))
                        {
                            return TypedResults.Unauthorized();
                        }

                        var displayName = user.FindFirstValue("name")
                            ?? user.FindFirstValue(ClaimTypes.Name);
                        var email = user.FindFirstValue("email")
                            ?? user.FindFirstValue("preferred_username");

                        return TypedResults.Ok(new UserInfoResponse(sub, displayName, email, tenantId));
                    }
                    catch (InvalidOperationException)
                    {
                        return TypedResults.Unauthorized();
                    }
                })
            .RequireAuthorization("ApiScope")
            .WithTags("User")
            .Produces<Ok<UserInfoResponse>>(StatusCodes.Status200OK)
            .Produces<UnauthorizedHttpResult>(StatusCodes.Status401Unauthorized)
            .AddOpenApiOperationTransformer((operation, context, ct) =>
            {
                operation.Summary = "Get current user info";
                operation.Description = "Returns identity information for the authenticated user.";
                return Task.CompletedTask;
            });

        return endpoints;
    }
}
