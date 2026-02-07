FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Install PowerShell for Playwright installation
RUN apt-get update && apt-get install -y --no-install-recommends wget apt-transport-https software-properties-common \
    && wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb \
    && dpkg -i packages-microsoft-prod.deb \
    && rm packages-microsoft-prod.deb \
    && apt-get update \
    && apt-get install -y powershell \
    && rm -rf /var/lib/apt/lists/*

COPY Directory.Build.props ./
COPY RecallCore.sln ./
COPY Recall.Core.Enrichment/Recall.Core.Enrichment.csproj Recall.Core.Enrichment/
COPY Recall.Core.ServiceDefaults/Recall.Core.ServiceDefaults.csproj Recall.Core.ServiceDefaults/

RUN dotnet restore Recall.Core.Enrichment/Recall.Core.Enrichment.csproj

COPY . .
RUN dotnet publish Recall.Core.Enrichment/Recall.Core.Enrichment.csproj -c Release -o /app/publish /p:UseAppHost=false

# Install Playwright browsers in build stage using PowerShell script from package
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pwsh /app/publish/playwright.ps1 install chromium

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libasound2t64 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .
COPY --from=build /ms-playwright /ms-playwright

EXPOSE 8080

ENTRYPOINT ["dotnet", "Recall.Core.Enrichment.dll"]
