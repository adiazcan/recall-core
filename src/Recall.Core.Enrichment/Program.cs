using Azure.Identity;
using Azure.Storage.Blobs;
using Dapr.Client;
using MongoDB.Driver;
using Recall.Core.Enrichment.Common;
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
builder.Services.AddSingleton(blobServiceClient);
builder.Services.AddDaprClient();
builder.Services.AddControllers().AddDapr();
builder.Services.AddEnrichmentCommon();
builder.Services.AddSingleton<IImageFetcher, ImageFetcher>();
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
