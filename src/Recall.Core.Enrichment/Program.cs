using Dapr.Client;
using MongoDB.Driver;
using Recall.Core.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
var mongoConnectionString = builder.Configuration.GetConnectionString("recalldb");
if (string.IsNullOrWhiteSpace(mongoConnectionString))
{
    throw new InvalidOperationException("Missing MongoDB connection string: ConnectionStrings:recalldb");
}

var mongoUrl = new MongoUrl(mongoConnectionString);
var mongoClient = new MongoClient(mongoUrl);
var mongoDatabaseName = string.IsNullOrWhiteSpace(mongoUrl.DatabaseName)
    ? "recalldb"
    : mongoUrl.DatabaseName;

builder.Services.AddSingleton<IMongoClient>(mongoClient);
builder.Services.AddSingleton(sp => mongoClient.GetDatabase(mongoDatabaseName));
builder.Services.AddDaprClient();
builder.Services.AddControllers().AddDapr();

var app = builder.Build();

app.MapDefaultEndpoints();
app.UseCloudEvents();
app.MapControllers();
app.MapSubscribeHandler();

app.MapGet("/api/enrichment/ping", () => Results.Ok(new { status = "ok" }))
    .WithName("EnrichmentPing")
    .WithTags("Enrichment");

app.Run();
