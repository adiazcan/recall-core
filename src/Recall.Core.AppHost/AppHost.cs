using Aspire.Hosting;
using CommunityToolkit.Aspire.Hosting.Dapr;

var builder = DistributedApplication.CreateBuilder(args);

var mongoUser = builder.AddParameter("mongo-username", "admin", publishValueAsDefault: true, secret: false);
var mongoPassword = builder.AddParameter("mongo-password", "devpassword", publishValueAsDefault: false, secret: true);

var mongo = builder.AddMongoDB("mongo", port: null, userName: mongoUser, password: mongoPassword)
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume("mongo-data");

var mongodb = mongo.AddDatabase("recalldb");

var redis = builder.AddRedis("redis")
    .WithLifetime(ContainerLifetime.Persistent);

var storage = builder.AddAzureStorage("storage").RunAsEmulator();
var blobs = storage.AddBlobs("blobs");

var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(mongodb)
    .WithReference(blobs)
    .WithDaprSidecar(new DaprSidecarOptions
    {
        AppId = "api",
        ResourcesPaths = ["./components"]
    })
    .WaitFor(mongodb)
    .WaitFor(redis)
    .WithHttpHealthCheck("/health");

var enrichment = builder.AddProject<Projects.Recall_Core_Enrichment>("enrichment")
    .WithReference(mongodb)
    .WithReference(blobs)
    .WithDaprSidecar(new DaprSidecarOptions
    {
        AppId = "enrichment",
        ResourcesPaths = ["./components"]
    })
    .WaitFor(mongodb)
    .WaitFor(redis)
    .WaitFor(api);

builder.AddViteApp("web", "../web")
    .WithHttpEndpoint(name: "web-http", env: "PORT")
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
