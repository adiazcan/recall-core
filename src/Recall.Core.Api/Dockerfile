FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/Directory.Build.props ./
COPY src/RecallCore.sln ./
COPY src/Recall.Core.Api/Recall.Core.Api.csproj Recall.Core.Api/
COPY src/Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj Recall.Core.ServiceDefaults/

RUN dotnet restore Recall.Core.Api/Recall.Core.Api.csproj

COPY src/Recall.Core.Api/ Recall.Core.Api/
COPY src/Recall.Core.ServiceDefaults/ Recall.Core.ServiceDefaults/

RUN dotnet publish Recall.Core.Api/Recall.Core.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "Recall.Core.Api.dll"]
