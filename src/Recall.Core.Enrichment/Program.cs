using Azure.Storage.Blobs;
using Dapr.Client;
using MongoDB.Driver;
using Recall.Core.Enrichment.Services;
using Recall.Core.Enrichment.Storage;
using Recall.Core.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
var mongoConnectionString = builder.Configuration.GetConnectionString("recalldb");
if (string.IsNullOrWhiteSpace(mongoConnectionString))
{
    throw new InvalidOperationException("Missing MongoDB connection string: ConnectionStrings:recalldb");
}

var blobConnectionString = builder.Configuration.GetConnectionString("blobs");
if (string.IsNullOrWhiteSpace(blobConnectionString))
{
    throw new InvalidOperationException("Missing Blob Storage connection string: ConnectionStrings:blobs");
}

var enrichmentOptions = builder.Configuration.GetSection("Enrichment").Get<EnrichmentOptions>()
    ?? new EnrichmentOptions();

var mongoUrl = new MongoUrl(mongoConnectionString);
var mongoClient = new MongoClient(mongoUrl);
var mongoDatabaseName = string.IsNullOrWhiteSpace(mongoUrl.DatabaseName)
    ? "recalldb"
    : mongoUrl.DatabaseName;

builder.Services.AddSingleton<IMongoClient>(mongoClient);
builder.Services.AddSingleton(sp => mongoClient.GetDatabase(mongoDatabaseName));
builder.Services.AddSingleton(enrichmentOptions);
builder.Services.AddSingleton(new BlobServiceClient(blobConnectionString));
builder.Services.AddDaprClient();
builder.Services.AddControllers().AddDapr();
builder.Services.AddSingleton<ISsrfValidator, SsrfValidator>();
builder.Services.AddSingleton<IHtmlFetcher, HtmlFetcher>();
builder.Services.AddSingleton<IMetadataExtractor, MetadataExtractor>();
builder.Services.AddSingleton<IThumbnailGenerator, ThumbnailGenerator>();
builder.Services.AddSingleton<IThumbnailStorage, BlobThumbnailStorage>();
builder.Services.AddScoped<IEnrichmentService, EnrichmentService>();

var app = builder.Build();

app.MapDefaultEndpoints();
app.UseCloudEvents();
app.MapControllers();
app.MapSubscribeHandler();

app.MapGet("/api/enrichment/ping", () => Results.Ok(new { status = "ok" }))
    .WithName("EnrichmentPing")
    .WithTags("Enrichment");

app.Run();
