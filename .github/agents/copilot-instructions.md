# recall-core Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-21

## Active Technologies
- TypeScript 5.7+ / React 19 / Vite 6 + React Router 7.1, Zustand 5, shadcn/ui (Radix), Tailwind CSS 4, lucide-react, motion (003-web-app-integration)
- N/A (backend handles persistence via MongoDB) (003-web-app-integration)
- C# / .NET 10, TypeScript ES2022 (004-entra-external-auth)
- MongoDB (existing) - entities extended with `userId` field (004-entra-external-auth)
- C# / .NET 10, TypeScript / ES2022 + Aspire 13.1.0, CommunityToolkit.Aspire.Hosting.Dapr, Dapr.AspNetCore 1.14.0, MongoDB.Driver.v2, Microsoft.Playwright, Azure.Storage.Blobs, AngleSharp, SkiaSharp (005-bookmark-enrichment)
- MongoDB (items, enrichment status), Azure Blob Storage (thumbnails), Redis (Dapr Pub/Sub backing store) (005-bookmark-enrichment)

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
- 005-bookmark-enrichment: Added C# / .NET 10, TypeScript / ES2022 + Aspire 13.1.0, CommunityToolkit.Aspire.Hosting.Dapr, Dapr.AspNetCore 1.14.0, MongoDB.Driver.v2, Microsoft.Playwright, Azure.Storage.Blobs, AngleSharp, SkiaSharp
- 004-entra-external-auth: Added C# / .NET 10, TypeScript ES2022


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
