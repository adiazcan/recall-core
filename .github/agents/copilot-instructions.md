# recall-core Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-21

## Active Technologies
- TypeScript 5.7+ / React 19 / Vite 6 + React Router 7.1, Zustand 5, shadcn/ui (Radix), Tailwind CSS 4, lucide-react, motion (003-web-app-integration)
- N/A (backend handles persistence via MongoDB) (003-web-app-integration)
- C# / .NET 10, TypeScript ES2022 (004-entra-external-auth)
- MongoDB (existing) - entities extended with `userId` field (004-entra-external-auth)
- C# / .NET 10, TypeScript / ES2022 + Aspire 13.1.0, CommunityToolkit.Aspire.Hosting.Dapr, Dapr.AspNetCore 1.14.0, MongoDB.Driver.v2, Microsoft.Playwright, Azure.Storage.Blobs, AngleSharp, SkiaSharp (005-bookmark-enrichment)
- MongoDB (items, enrichment status), Azure Blob Storage (thumbnails), Redis (Dapr Pub/Sub backing store) (005-bookmark-enrichment)
- TypeScript ES2022 + React 19, Vite 6, chrome.* APIs (sidePanel, identity, tabs, storage) (006-browser-extension)
- chrome.storage.local for settings and token cache; chrome.storage.session for ephemeral state (006-browser-extension)
- Azure Resource Manager, Azure CLI 2.60+, Bicep CLI (007-infra-azure)
- C# / .NET 10 (`net10.0`) + Aspire 13.1.0, Dapr.AspNetCore 1.14.0, MongoDB.Driver 2.30.0, AngleSharp 1.1.2, SkiaSharp 2.88.8, Microsoft.Playwright 1.47.0, Azure.Storage.Blobs 12.23.0 (008-sync-enrichment)
- MongoDB (items), Azure Blob Storage (thumbnails) (008-sync-enrichment)

- C# / .NET 10 (net10.0) + ASP.NET Core minimal API, MongoDB.Driver 3.x, Aspire.Hosting.MongoDB (13.1.0) (002-items-tags-collections-api)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for C# / .NET 10 (net10.0)

## Code Style

C# / .NET 10 (net10.0): Follow standard conventions

## Recent Changes
- 008-sync-enrichment: Added C# / .NET 10 (`net10.0`) + Aspire 13.1.0, Dapr.AspNetCore 1.14.0, MongoDB.Driver 2.30.0, AngleSharp 1.1.2, SkiaSharp 2.88.8, Microsoft.Playwright 1.47.0, Azure.Storage.Blobs 12.23.0
- 007-infra-azure: Added Azure Resource Manager, Azure CLI 2.60+, Bicep CLI
- 006-browser-extension: Added TypeScript ES2022 + React 19, Vite 6, chrome.* APIs (sidePanel, identity, tabs, storage)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
