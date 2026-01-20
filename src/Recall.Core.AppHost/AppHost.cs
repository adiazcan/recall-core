using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

var mongoUser = builder.AddParameter("mongo-username", "admin", publishValueAsDefault: true, secret: false);
var mongoPassword = builder.AddParameter("mongo-password", "devpassword", publishValueAsDefault: false, secret: true);

var mongo = builder.AddMongoDB("mongo", port: null, userName: mongoUser, password: mongoPassword)
    .WithLifetime(ContainerLifetime.Persistent)
    .WithDataVolume("mongo-data");

var mongodb = mongo.AddDatabase("recalldb");

var api = builder.AddProject<Projects.Recall_Core_Api>("api")
    .WithReference(mongodb)
    .WaitFor(mongodb)
    .WithHttpHealthCheck("/health");

builder.AddViteApp("web", "../web")
    .WithHttpEndpoint(name: "web-http", env: "PORT")
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
