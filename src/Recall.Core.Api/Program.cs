using Recall.Core.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
}
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            Uri.TryCreate(origin, UriKind.Absolute, out var uri)
            && uri.IsLoopback
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
        app.MapOpenApi();
        app.MapGet("/swagger", () => Results.Redirect("/swagger/index.html"));
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
                "text/html"));
}

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .WithName("GetHealth")
    .WithTags("System")
    .WithOpenApi(operation =>
    {
        operation.Summary = "Health check endpoint";
        operation.Description = "Returns the health status of the API.";
        return operation;
    });

app.Run();

public partial class Program { }
