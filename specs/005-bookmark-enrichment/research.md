# Research: Bookmark Enrichment

**Feature Branch**: `005-bookmark-enrichment`  
**Research Date**: 2026-01-25  
**Status**: Complete

---

## Overview

This document captures research findings for implementing asynchronous bookmark enrichment. Topics include: queue technology, HTML parsing, screenshot generation, thumbnail storage, SSRF protection, and Aspire integration.

---

## 1. Queue Technology

### Decision: ~~Azure Storage Queue~~ → **Dapr Pub/Sub (Redis)**

> ⚠️ **SUPERSEDED**: Original decision was Azure Storage Queue. Per constitution mandate ("Pub/Sub MUST be used for async workflows; no direct queue access"), this has been updated to Dapr Pub/Sub backed by Redis. See **Section 11** for Dapr implementation patterns.

**Original Rationale** (for reference): Aspire 13.1.0 provides first-class support for Azure Storage (blobs + queues) with Azurite emulator for local development.

**Updated Decision**: Dapr Pub/Sub with Redis backing store. See Section 11 for complete implementation patterns.

**Alternatives Considered**:
- **Azure Storage Queue**: Violates constitution—no direct queue access allowed.
- **In-memory queue**: Rejected—jobs lost on restart, no persistence.
- **Azure Service Bus**: More expensive, not required for single-consumer scenario.

### Implementation Pattern

```csharp
// AppHost.cs - Add Azure Storage with Azurite emulator for local dev
var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var queues = storage.AddQueues("queues");
var blobs = storage.AddBlobs("blobs");

var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(queues)
    .WithReference(blobs);

var enrichment = builder.AddProject<Projects.Recall_Core_Enrichment>("enrichment")
    .WithReference(queues)
    .WithReference(blobs)
    .WithReference(mongodb);
```

**Client Integration (API/Enrichment projects)**:
```csharp
// Program.cs
builder.AddAzureQueueServiceClient("queues");
builder.AddAzureBlobServiceClient("blobs");

// Usage
public class EnrichmentQueueService(QueueServiceClient client)
{
    private readonly QueueClient _queue = client.GetQueueClient("enrichment-jobs");
    
    public async Task EnqueueAsync(EnrichmentJob job, CancellationToken ct)
    {
        await _queue.CreateIfNotExistsAsync(ct);
        await _queue.SendMessageAsync(JsonSerializer.Serialize(job), ct);
    }
}
```

**Worker Pattern**:
```csharp
public class EnrichmentWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var messages = await _queue.ReceiveMessagesAsync(maxMessages: 1, stoppingToken);
            foreach (var msg in messages.Value)
            {
                try
                {
                    var job = JsonSerializer.Deserialize<EnrichmentJob>(msg.Body);
                    await ProcessJobAsync(job, stoppingToken);
                    await _queue.DeleteMessageAsync(msg.MessageId, msg.PopReceipt, stoppingToken);
                }
                catch (Exception ex)
                {
                    // Message becomes visible again after visibility timeout (retry)
                    _logger.LogError(ex, "Failed to process job {MessageId}", msg.MessageId);
                }
            }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

**Key Considerations**:
- At-least-once delivery: Worker must be idempotent.
- Dequeue count available for poison message handling (max 5 attempts default).
- Visibility timeout controls retry window (default 30s, configurable).

---

## 2. HTML Parsing & Metadata Extraction

### Decision: AngleSharp

**Rationale**: AngleSharp is a mature, standards-compliant HTML parser for .NET with excellent CSS selector support. No external dependencies required.

**Alternatives Considered**:
- **HtmlAgilityPack**: Less standards-compliant, XPath-based (CSS selectors via extension).
- **Regex**: Fragile, not recommended for HTML parsing.

### Implementation Pattern

```csharp
using AngleSharp;
using AngleSharp.Dom;

public class MetadataExtractor
{
    public async Task<PageMetadata> ExtractAsync(string html)
    {
        var config = Configuration.Default;
        var context = BrowsingContext.New(config);
        var document = await context.OpenAsync(req => req.Content(html));
        
        return new PageMetadata
        {
            Title = ExtractTitle(document),
            Excerpt = ExtractExcerpt(document),
            OgImageUrl = ExtractOgImage(document)
        };
    }
    
    private string? ExtractTitle(IDocument doc)
    {
        // Priority: og:title -> <title> -> first h1
        return doc.QuerySelector("meta[property='og:title']")?.GetAttribute("content")
            ?? doc.QuerySelector("title")?.TextContent?.Trim()
            ?? doc.QuerySelector("h1")?.TextContent?.Trim();
    }
    
    private string? ExtractExcerpt(IDocument doc)
    {
        // Priority: og:description -> meta description -> first paragraph
        return doc.QuerySelector("meta[property='og:description']")?.GetAttribute("content")
            ?? doc.QuerySelector("meta[name='description']")?.GetAttribute("content")
            ?? doc.QuerySelector("article p, main p, .content p, p")?.TextContent?.Trim();
    }
    
    private string? ExtractOgImage(IDocument doc)
    {
        return doc.QuerySelector("meta[property='og:image']")?.GetAttribute("content");
    }
}
```

**Sanitization**:
```csharp
public string SanitizeText(string? input, int maxLength)
{
    if (string.IsNullOrWhiteSpace(input)) return string.Empty;
    
    // Decode HTML entities
    var decoded = System.Net.WebUtility.HtmlDecode(input);
    
    // Remove remaining HTML tags
    var stripped = Regex.Replace(decoded, "<[^>]*>", string.Empty);
    
    // Normalize whitespace
    var normalized = Regex.Replace(stripped, @"\s+", " ").Trim();
    
    // Truncate
    return normalized.Length > maxLength 
        ? normalized[..maxLength] + "..."
        : normalized;
}
```

---

## 3. Screenshot Generation

### Decision: Playwright .NET

**Rationale**: Playwright provides reliable, modern browser automation with built-in screenshot capabilities. Microsoft-maintained, cross-platform, supports all major browsers.

**Alternatives Considered**:
- **Puppeteer-Sharp**: Less actively maintained for .NET.
- **Selenium**: Heavier, more complex setup.

### Implementation Pattern

```csharp
using Microsoft.Playwright;

public class ScreenshotGenerator : IAsyncDisposable
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    
    public async Task InitializeAsync()
    {
        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true
        });
    }
    
    public async Task<byte[]> CaptureAsync(string url, CancellationToken ct)
    {
        var page = await _browser!.NewPageAsync();
        try
        {
            await page.GotoAsync(url, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.NetworkIdle,
                Timeout = 15000 // 15s timeout
            });
            
            return await page.ScreenshotAsync(new PageScreenshotOptions
            {
                Type = ScreenshotType.Jpeg,
                Quality = 80,
                Clip = new Clip { X = 0, Y = 0, Width = 1200, Height = 800 }
            });
        }
        finally
        {
            await page.CloseAsync();
        }
    }
    
    public async ValueTask DisposeAsync()
    {
        if (_browser != null) await _browser.CloseAsync();
        _playwright?.Dispose();
    }
}
```

**Deployment Considerations**:
- Browser binaries needed: Run `playwright install chromium` during CI/CD or Dockerfile.
- Memory/CPU: Chromium headless requires ~100MB+ RAM per instance.
- Timeout budget: 15s for page load + render, configurable.

---

## 4. Thumbnail Storage

### Decision: Azure Blob Storage via Aspire

**Rationale**: Consistent with queue choice, Aspire provides unified Azure Storage integration with Azurite for local dev.

### Implementation Pattern

```csharp
public class BlobThumbnailStorage(BlobServiceClient client)
{
    private readonly BlobContainerClient _container = client.GetBlobContainerClient("thumbnails");
    
    public async Task<string> UploadAsync(string key, byte[] imageData, CancellationToken ct)
    {
        await _container.CreateIfNotExistsAsync(cancellationToken: ct);
        var blob = _container.GetBlobClient(key);
        
        await blob.UploadAsync(
            new BinaryData(imageData),
            new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = "image/jpeg" }
            },
            ct);
        
        return key;
    }
    
    public async Task<Stream?> DownloadAsync(string key, CancellationToken ct)
    {
        var blob = _container.GetBlobClient(key);
        if (!await blob.ExistsAsync(ct)) return null;
        
        var response = await blob.DownloadAsync(ct);
        return response.Value.Content;
    }
}
```

**Key Naming Convention**:
- Format: `{userId}/{itemId}.jpg`
- Example: `user_abc123/item_xyz789.jpg`

---

## 5. SSRF Protection

### Decision: Custom SsrfValidator with DNS Resolution

**Rationale**: No single library covers all SSRF scenarios. Must validate both URL scheme and resolved IP addresses before connecting.

### Implementation Pattern

```csharp
public class SsrfValidator
{
    private static readonly IPNetwork[] BlockedNetworks =
    [
        IPNetwork.Parse("10.0.0.0/8"),        // Private Class A
        IPNetwork.Parse("172.16.0.0/12"),     // Private Class B
        IPNetwork.Parse("192.168.0.0/16"),    // Private Class C
        IPNetwork.Parse("127.0.0.0/8"),       // Loopback
        IPNetwork.Parse("169.254.0.0/16"),    // Link-local
        IPNetwork.Parse("::1/128"),           // IPv6 loopback
        IPNetwork.Parse("fc00::/7"),          // IPv6 private
        IPNetwork.Parse("fe80::/10"),         // IPv6 link-local
    ];
    
    public async Task<SsrfValidationResult> ValidateAsync(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return SsrfValidationResult.Invalid("Invalid URL format");
        
        // Block non-HTTP schemes
        if (uri.Scheme != "http" && uri.Scheme != "https")
            return SsrfValidationResult.Blocked("Only http/https allowed");
        
        // Resolve DNS
        var hostEntry = await Dns.GetHostEntryAsync(uri.DnsSafeHost);
        
        // Check all resolved IPs
        foreach (var ip in hostEntry.AddressList)
        {
            if (IsBlocked(ip))
                return SsrfValidationResult.Blocked($"IP {ip} is in blocked range");
        }
        
        return SsrfValidationResult.Valid(hostEntry.AddressList.First());
    }
    
    private bool IsBlocked(IPAddress ip)
    {
        return BlockedNetworks.Any(network => network.Contains(ip));
    }
}
```

**HttpClient Configuration**:
```csharp
// Use SocketsHttpHandler.ConnectCallback to enforce resolved IP
var handler = new SocketsHttpHandler
{
    ConnectCallback = async (context, ct) =>
    {
        // Validate resolved IP using our validator
        var validationResult = await _ssrfValidator.ValidateAsync(context.DnsEndPoint.Host);
        if (!validationResult.IsValid)
            throw new SsrfBlockedException(validationResult.Reason);
        
        // Connect to validated IP
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp);
        await socket.ConnectAsync(validationResult.ValidatedIp!, context.DnsEndPoint.Port, ct);
        return new NetworkStream(socket, ownsSocket: true);
    }
};
```

**Additional Protections**:
- Timeout: 10s connection, 30s total request.
- Size limit: 5MB max response body.
- Redirect limit: Max 3 redirects, validate each redirect URL.
- User-agent: Generic, non-identifying string.

---

## 6. Image Processing

### Decision: SkiaSharp for Resizing

**Rationale**: SkiaSharp is cross-platform, performant, and well-suited for basic image operations. Lighter than ImageSharp for simple resize/compress tasks.

**Alternatives Considered**:
- **ImageSharp**: More features but heavier dependency.
- **System.Drawing**: Deprecated on non-Windows, limited cross-platform.

### Implementation Pattern

```csharp
using SkiaSharp;

public class ThumbnailProcessor
{
    private const int MaxWidth = 600;
    private const int MaxHeight = 400;
    private const int JpegQuality = 80;
    
    public byte[] ResizeToThumbnail(byte[] imageData)
    {
        using var original = SKBitmap.Decode(imageData);
        if (original == null) throw new InvalidImageException();
        
        // Calculate dimensions maintaining aspect ratio
        var (newWidth, newHeight) = CalculateDimensions(
            original.Width, original.Height, MaxWidth, MaxHeight);
        
        using var resized = original.Resize(
            new SKImageInfo(newWidth, newHeight),
            SKFilterQuality.High);
        
        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);
        
        return data.ToArray();
    }
    
    private (int width, int height) CalculateDimensions(
        int originalWidth, int originalHeight, int maxWidth, int maxHeight)
    {
        var ratioX = (double)maxWidth / originalWidth;
        var ratioY = (double)maxHeight / originalHeight;
        var ratio = Math.Min(ratioX, ratioY);
        
        return ((int)(originalWidth * ratio), (int)(originalHeight * ratio));
    }
}
```

---

## 7. Aspire AppHost Integration

### Full Configuration

```csharp
// AppHost.cs
var builder = DistributedApplication.CreateBuilder(args);

// MongoDB (existing)
var mongoUser = builder.AddParameter("mongo-username", "admin");
var mongoPassword = builder.AddParameter("mongo-password", secret: true);
var mongo = builder.AddMongoDB("mongo", userName: mongoUser, password: mongoPassword)
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume("mongo-data");
var mongodb = mongo.AddDatabase("recalldb");

// Azure Storage (new)
var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var queues = storage.AddQueues("queues");
var blobs = storage.AddBlobs("blobs");

// API (extended)
var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(mongodb)
    .WithReference(queues)
    .WithReference(blobs)
    .WaitFor(mongodb)
    .WithHttpHealthCheck("/health");

// Enrichment Worker (new)
var enrichment = builder.AddProject<Projects.Recall_Core_Enrichment>("enrichment")
    .WithReference(mongodb)
    .WithReference(queues)
    .WithReference(blobs)
    .WaitFor(mongodb)
    .WaitFor(api);

// Web (existing)
builder.AddViteApp("web", "../web")
    .WithHttpEndpoint(name: "web-http", env: "PORT")
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
```

---

## 8. Worker Service Structure

### Project Setup

```xml
<!-- Recall.Core.Enrichment.csproj -->
<Project Sdk="Microsoft.NET.Sdk.Worker">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <ProjectReference Include="..\Recall.Core.ServiceDefaults\Recall.Core.ServiceDefaults.csproj" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Aspire.Azure.Storage.Queues" Version="13.1.0" />
    <PackageReference Include="Aspire.Azure.Storage.Blobs" Version="13.1.0" />
    <PackageReference Include="Aspire.MongoDB.Driver.v2" Version="13.1.0" />
    <PackageReference Include="AngleSharp" Version="1.1.2" />
    <PackageReference Include="Microsoft.Playwright" Version="1.47.0" />
    <PackageReference Include="SkiaSharp" Version="2.88.8" />
  </ItemGroup>
</Project>
```

### Program.cs

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
builder.AddMongoDBClient("recalldb");
builder.AddAzureQueueServiceClient("queues");
builder.AddAzureBlobServiceClient("blobs");

builder.Services.AddSingleton<IMetadataExtractor, MetadataExtractor>();
builder.Services.AddSingleton<IThumbnailGenerator, ThumbnailGenerator>();
builder.Services.AddSingleton<IThumbnailStorage, BlobThumbnailStorage>();
builder.Services.AddSingleton<ISsrfValidator, SsrfValidator>();
builder.Services.AddSingleton<IHtmlFetcher, HtmlFetcher>();
builder.Services.AddHostedService<EnrichmentWorker>();

var host = builder.Build();
host.Run();
```

---

## 9. Retry & Backoff Strategy

### Implementation

```csharp
public class EnrichmentWorker : BackgroundService
{
    private const int MaxAttempts = 5;
    private static readonly TimeSpan[] BackoffDelays =
    [
        TimeSpan.FromSeconds(10),
        TimeSpan.FromSeconds(30),
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15)
    ];
    
    private async Task ProcessWithRetryAsync(QueueMessage message)
    {
        var job = JsonSerializer.Deserialize<EnrichmentJob>(message.Body);
        var attempt = (int)message.DequeueCount;
        
        if (attempt > MaxAttempts)
        {
            await MarkJobFailedAsync(job, "Max attempts exceeded");
            await _queue.DeleteMessageAsync(message.MessageId, message.PopReceipt);
            return;
        }
        
        try
        {
            await ProcessJobAsync(job);
            await _queue.DeleteMessageAsync(message.MessageId, message.PopReceipt);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Attempt {Attempt} failed for job {ItemId}", attempt, job.ItemId);
            // Message becomes visible again after visibility timeout
            // Azure Queue handles retry automatically
        }
    }
}
```

---

## 10. Observability

### Structured Logging

```csharp
// EnrichmentWorker.cs
_logger.LogInformation(
    "Enrichment job started. ItemId={ItemId} UserId={UserId} Attempt={Attempt}",
    job.ItemId, job.UserId, attempt);

_logger.LogInformation(
    "Enrichment completed. ItemId={ItemId} Title={Title} HasThumbnail={HasThumbnail} Duration={Duration}ms",
    job.ItemId, result.Title, result.ThumbnailKey != null, stopwatch.ElapsedMilliseconds);

_logger.LogWarning(
    "Enrichment failed. ItemId={ItemId} Error={Error} Attempt={Attempt}",
    job.ItemId, ex.Message, attempt);
```

### Metrics (via OpenTelemetry)

```csharp
private readonly Counter<long> _jobsSucceeded;
private readonly Counter<long> _jobsFailed;
private readonly Histogram<double> _jobDuration;

public EnrichmentWorker(IMeterFactory meterFactory)
{
    var meter = meterFactory.Create("Recall.Core.Enrichment");
    _jobsSucceeded = meter.CreateCounter<long>("enrichment.jobs.succeeded");
    _jobsFailed = meter.CreateCounter<long>("enrichment.jobs.failed");
    _jobDuration = meter.CreateHistogram<double>("enrichment.jobs.duration", "ms");
}
```

---

## 11. Dapr Integration

### Decision: Dapr Pub/Sub + Resiliency

**Rationale**: Constitution mandates "Pub/Sub MUST be used for async workflows; no direct queue access." Dapr provides portable, sidecar-based messaging with built-in resiliency policies.

**Building Blocks Required**:
| Building Block | Purpose |
|----------------|---------|
| **Pub/Sub** | Async messaging for enrichment job queue |
| **Resiliency** | Timeouts, retries, circuit breakers for external HTTP calls |
| **Service Invocation** | (Optional) For API-to-worker communication if needed |

**Alternatives Considered**:
- **Direct Azure Storage Queue**: Violates constitution; lacks portable abstraction.
- **MassTransit**: Adds complexity; Dapr sidecar approach preferred for cloud-native deployment.

### Pub/Sub Configuration

**Component Definition** (`components/pubsub.yaml`):
```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: enrichment-pubsub
spec:
  type: pubsub.redis
  version: v1
  metadata:
    - name: redisHost
      value: localhost:6379
    - name: redisPassword
      value: ""
```

**Topic Definition** (`components/subscription.yaml`):
```yaml
apiVersion: dapr.io/v2alpha1
kind: Subscription
metadata:
  name: enrichment-subscription
spec:
  pubsubname: enrichment-pubsub
  topic: enrichment.requested
  routes:
    default: /api/enrichment/process
```

### Publisher Pattern (API)

```csharp
// ItemsEndpoints.cs - Publish enrichment job after item creation
using Dapr.Client;

public static class ItemsEndpoints
{
    public static void MapItemsEndpoints(this WebApplication app, DaprClient daprClient)
    {
        app.MapPost("/api/v1/items", async (CreateItemRequest request, ...) =>
        {
            // Create item in MongoDB
            var item = await itemsRepository.CreateAsync(newItem, ct);
            
            // Publish enrichment job via Dapr Pub/Sub
            var enrichmentJob = new EnrichmentJob(item.Id, item.UserId, item.Url);
            await daprClient.PublishEventAsync(
                "enrichment-pubsub",
                "enrichment.requested",
                enrichmentJob,
                ct);
            
            return TypedResults.Created($"/api/v1/items/{item.Id}", ItemDto.FromItem(item));
        });
    }
}
```

### Subscriber Pattern (Enrichment Worker)

```csharp
// EnrichmentController.cs - Subscribe to enrichment jobs
using Dapr;
using Dapr.Client;

[ApiController]
public class EnrichmentController : ControllerBase
{
    private readonly IEnrichmentService _enrichmentService;
    private readonly ILogger<EnrichmentController> _logger;

    public EnrichmentController(
        IEnrichmentService enrichmentService,
        ILogger<EnrichmentController> logger)
    {
        _enrichmentService = enrichmentService;
        _logger = logger;
    }

    [Topic("enrichment-pubsub", "enrichment.requested")]
    [HttpPost("/api/enrichment/process")]
    public async Task<IActionResult> ProcessEnrichmentJob(EnrichmentJob job)
    {
        _logger.LogInformation(
            "Processing enrichment job. ItemId={ItemId} UserId={UserId}",
            job.ItemId, job.UserId);
        
        try
        {
            await _enrichmentService.EnrichAsync(job);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Enrichment failed for ItemId={ItemId}", job.ItemId);
            // Return 500 to trigger Dapr retry
            return StatusCode(500);
        }
    }
}
```

### Resiliency Policies

**Policy Definition** (`components/resiliency.yaml`):
```yaml
apiVersion: dapr.io/v1alpha1
kind: Resiliency
metadata:
  name: enrichment-resiliency
scopes:
  - enrichment
spec:
  policies:
    timeouts:
      httpFetch: 30s
      screenshotCapture: 60s
    retries:
      enrichmentRetry:
        policy: exponential
        maxInterval: 5m
        maxRetries: 5
    circuitBreakers:
      externalHttpBreaker:
        maxRequests: 1
        interval: 5s
        timeout: 30s
        trip: consecutiveFailures >= 5

  targets:
    apps:
      enrichment:
        timeout: httpFetch
        retry: enrichmentRetry
        circuitBreaker: externalHttpBreaker
```

### Aspire Integration with Dapr

```csharp
// AppHost.cs
var builder = DistributedApplication.CreateBuilder(args);

// Redis for Dapr Pub/Sub (required by constitution)
var redis = builder.AddRedis("redis")
    .WithLifetime(ContainerLifetime.Persistent);

// MongoDB (existing)
var mongodb = mongo.AddDatabase("recalldb");

// Azure Storage for blobs only (thumbnails)
var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var blobs = storage.AddBlobs("blobs");

// API with Dapr sidecar
var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(mongodb)
    .WithReference(blobs)
    .WithDaprSidecar(new DaprSidecarOptions
    {
        AppId = "api",
        ResourcesPaths = ["./components"]
    })
    .WaitFor(mongodb)
    .WaitFor(redis);

// Enrichment Worker with Dapr sidecar
var enrichment = builder.AddProject<Projects.Recall_Core_Enrichment>("enrichment")
    .WithReference(mongodb)
    .WithReference(blobs)
    .WithDaprSidecar(new DaprSidecarOptions
    {
        AppId = "enrichment",
        AppPort = 5081,
        ResourcesPaths = ["./components"]
    })
    .WaitFor(mongodb)
    .WaitFor(redis)
    .WaitFor(api);
```

**Enrichment Worker Program.cs (Dapr-enabled)**:
```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddMongoDBClient("recalldb");
builder.AddAzureBlobServiceClient("blobs");

// Dapr client for publishing events
builder.Services.AddDaprClient();

// Enable Dapr Pub/Sub subscriber
builder.Services.AddControllers().AddDapr();

builder.Services.AddScoped<IEnrichmentService, EnrichmentService>();
builder.Services.AddSingleton<IMetadataExtractor, MetadataExtractor>();
builder.Services.AddSingleton<IThumbnailGenerator, ThumbnailGenerator>();
builder.Services.AddSingleton<IThumbnailStorage, BlobThumbnailStorage>();
builder.Services.AddSingleton<ISsrfValidator, SsrfValidator>();
builder.Services.AddSingleton<IHtmlFetcher, HtmlFetcher>();

var app = builder.Build();

app.MapDefaultEndpoints();

// Enable Dapr Pub/Sub subscription endpoint
app.UseCloudEvents();
app.MapControllers();
app.MapSubscribeHandler();

app.Run();
```

### Package References

```xml
<!-- Recall.Core.Api.csproj & Recall.Core.Enrichment.csproj -->
<PackageReference Include="Dapr.AspNetCore" Version="1.14.0" />
```

```xml
<!-- Recall.Core.AppHost.csproj -->
<PackageReference Include="CommunityToolkit.Aspire.Hosting.Dapr" Version="13.1.0" />
```

---

## 12. Dead Letter Handling

### Decision: Dapr Dead Letter Topic

**Rationale**: Dapr Pub/Sub supports dead letter topics for messages that fail after max retries. Provides visibility into failed jobs.

**Configuration**:
```yaml
# components/subscription.yaml
apiVersion: dapr.io/v2alpha1
kind: Subscription
metadata:
  name: enrichment-subscription
spec:
  pubsubname: enrichment-pubsub
  topic: enrichment.requested
  routes:
    default: /api/enrichment/process
  deadLetterTopic: enrichment.deadletter
```

**Dead Letter Subscriber**:
```csharp
[Topic("enrichment-pubsub", "enrichment.deadletter")]
[HttpPost("/api/enrichment/deadletter")]
public async Task<IActionResult> HandleDeadLetter(EnrichmentJob job)
{
    _logger.LogError(
        "Enrichment job moved to dead letter. ItemId={ItemId} UserId={UserId}",
        job.ItemId, job.UserId);
    
    // Update item status to failed
    await _itemsRepository.UpdateEnrichmentStatusAsync(
        job.ItemId, 
        EnrichmentStatus.Failed, 
        "Max retry attempts exceeded");
    
    return Ok();
}
```

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Messaging | Dapr Pub/Sub (Redis) | Constitution mandate; portable abstraction |
| Queue Backing | Redis | Lightweight, Dapr-compatible, no Azure dependency for local |
| HTML Parsing | AngleSharp | Standards-compliant, CSS selectors, no external deps |
| Screenshot | Playwright .NET | Modern, reliable, Microsoft-maintained |
| Blob Storage | Azure Blob Storage | Unified via Aspire, thumbnails only |
| Image Processing | SkiaSharp | Cross-platform, lightweight, performant |
| SSRF Protection | Custom SsrfValidator | DNS resolution + IP range blocking |
| Resiliency | Dapr Resiliency policies | Declarative timeouts, retries, circuit breakers |
| Dead Letters | Dapr dead letter topic | Failed job visibility and handling |
