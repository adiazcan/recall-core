using AngleSharp;
using AngleSharp.Dom;
using Recall.Core.Enrichment.Common.Models;

namespace Recall.Core.Enrichment.Common.Services;

public sealed class MetadataExtractor : IMetadataExtractor
{
    public async Task<PageMetadata> ExtractAsync(string html)
    {
        var context = BrowsingContext.New(AngleSharp.Configuration.Default);
        var document = await context.OpenAsync(request => request.Content(html));

        var title = GetMetaContent(document, "meta[property='og:title']")
            ?? document.QuerySelector("title")?.TextContent?.Trim()
            ?? document.QuerySelector("h1")?.TextContent?.Trim();

        var excerpt = GetMetaContent(document, "meta[property='og:description']")
            ?? GetMetaContent(document, "meta[name='description']")
            ?? document.QuerySelector("article p, main p, .content p, p")?.TextContent?.Trim();

        var ogImage = GetMetaContent(document, "meta[property='og:image']")
            ?? GetMetaContent(document, "meta[name='twitter:image']");

        return new PageMetadata(title, excerpt, ogImage);
    }

    private static string? GetMetaContent(IDocument document, string selector)
    {
        return document.QuerySelector(selector)?.GetAttribute("content")?.Trim();
    }
}
