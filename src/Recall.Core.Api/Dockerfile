FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY RecallCore.sln ./
COPY Recall.Core.Api/Recall.Core.Api.csproj Recall.Core.Api/
COPY Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj Recall.Core.ServiceDefaults/

RUN dotnet restore Recall.Core.Api/Recall.Core.Api.csproj

COPY . .
RUN dotnet publish Recall.Core.Api/Recall.Core.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Recall.Core.Api.dll"]
