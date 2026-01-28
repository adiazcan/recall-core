FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/Directory.Build.props ./
COPY src/RecallCore.sln ./
COPY src/Recall.Core.Enrichment/Recall.Core.Enrichment.csproj Recall.Core.Enrichment/
COPY src/Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj Recall.Core.ServiceDefaults/

RUN dotnet restore Recall.Core.Enrichment/Recall.Core.Enrichment.csproj

COPY src/Recall.Core.Enrichment/ Recall.Core.Enrichment/
COPY src/Recall.Core.ServiceDefaults/ Recall.Core.ServiceDefaults/

RUN dotnet publish Recall.Core.Enrichment/Recall.Core.Enrichment.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "Recall.Core.Enrichment.dll"]
