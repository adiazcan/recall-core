using Azure.Identity;
using Azure.Storage.Blobs;
using Dapr.Client;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Identity.Web;
using MongoDB.Driver;
using Recall.Core.Api.Auth;
using Recall.Core.Api.Endpoints;
using Recall.Core.Api.Models;
using Recall.Core.Api.Repositories;
using Recall.Core.Api.Services;
using Recall.Core.Enrichment.Common;
using Recall.Core.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
var mongoConnectionString = builder.Configuration.GetConnectionString("recalldb");
if (string.IsNullOrWhiteSpace(mongoConnectionString))
{
    throw new InvalidOperationException("Missing MongoDB connection string: ConnectionStrings:recalldb");
}

// Support both connection string (local dev) and managed identity (Azure)
var blobConnectionString = builder.Configuration.GetConnectionString("blobs");
var blobServiceUri = builder.Configuration["Storage:BlobServiceUri"];
BlobServiceClient blobServiceClient;

if (!string.IsNullOrWhiteSpace(blobConnectionString))
{
    blobServiceClient = new BlobServiceClient(blobConnectionString);
}
else if (!string.IsNullOrWhiteSpace(blobServiceUri))
{
    blobServiceClient = new BlobServiceClient(new Uri(blobServiceUri), new DefaultAzureCredential());
}
else
{
    throw new InvalidOperationException("Missing Blob Storage configuration: either ConnectionStrings:blobs or Storage:BlobServiceUri is required");
}

var mongoUrl = new MongoUrl(mongoConnectionString);
var mongoClient = new MongoClient(mongoUrl);
var mongoDatabaseName = string.IsNullOrWhiteSpace(mongoUrl.DatabaseName)
    ? "recalldb"
    : mongoUrl.DatabaseName;

builder.Services.AddSingleton<IMongoClient>(mongoClient);
builder.Services.AddSingleton(sp => mongoClient.GetDatabase(mongoDatabaseName));
builder.Services.AddHostedService<IndexInitializer>();
builder.Services.AddScoped<IItemRepository, ItemRepository>();
builder.Services.AddScoped<IItemService, ItemService>();
builder.Services.AddScoped<ICollectionRepository, CollectionRepository>();
builder.Services.AddScoped<ICollectionService, CollectionService>();
builder.Services.AddSingleton(blobServiceClient);
builder.Services.AddEnrichmentCommon();
builder.Services.AddSingleton<IThumbnailStorage, BlobThumbnailStorage>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContext, HttpUserContext>();
builder.Services.AddDaprClient();
var useTestAuth = !builder.Environment.IsProduction()
    && builder.Configuration.GetValue<bool>("Authentication:TestMode");

if (useTestAuth)
{
    builder.Services.AddAuthentication(TestAuthHandler.SchemeName)
        .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));
}

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("ApiScope", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            var scopeClaim = context.User.FindFirst("scp")?.Value
                ?? context.User.FindFirst("http://schemas.microsoft.com/identity/claims/scope")?.Value;
            if (string.IsNullOrWhiteSpace(scopeClaim))
            {
                return false;
            }

            return scopeClaim
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Contains("access_as_user", StringComparer.Ordinal);
        });
    });
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
}
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapGet("/swagger", () => Results.Redirect("/swagger/index.html"))
        .ExcludeFromDescription();
    app.MapGet("/swagger/index.html", () => Results.Content(
        """
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Recall Core API Docs</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
            </head>
            <body>
                <div id="swagger-ui"></div>
                <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
                <script>
                    window.ui = SwaggerUIBundle({
                        url: '/openapi/v1.json',
                        dom_id: '#swagger-ui',
                        presets: [SwaggerUIBundle.presets.apis],
                        layout: 'BaseLayout'
                    });
                </script>
            </body>
        </html>
        """,
        "text/html"))
        .ExcludeFromDescription();
}

app.UseCors();
app.UseAuthentication();
app.Use(async (context, next) =>
{
    await next();

    if (context.Response.StatusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(
            "Auth failure {StatusCode} for {Method} {Path}",
            context.Response.StatusCode,
            context.Request.Method,
            context.Request.Path.Value);
    }
});
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new HealthResponse("ok")))
    .WithName("GetHealth")
    .WithTags("System")
    .Produces<HealthResponse>()
    .AddOpenApiOperationTransformer((operation, context, ct) =>
    {
        operation.Summary = "Health check endpoint";
        operation.Description = "Returns the health status of the API.";
        return Task.CompletedTask;
    });

app.MapItemsEndpoints();
app.MapTagsEndpoints();
app.MapCollectionsEndpoints();
app.MapMeEndpoints();

app.Run();

public partial class Program { }
