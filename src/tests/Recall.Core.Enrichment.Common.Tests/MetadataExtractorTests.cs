using Recall.Core.Enrichment.Common.Services;

namespace Recall.Core.Enrichment.Common.Tests;

public sealed class MetadataExtractorTests
{
    private readonly IMetadataExtractor _extractor = new MetadataExtractor();

    [Fact]
    public async Task ExtractAsync_PrefersOgTitleOverTitleAndH1()
    {
        var html = """
            <html>
                <head>
                    <meta property='og:title' content='OG Title' />
                    <title>Doc Title</title>
                </head>
                <body>
                    <h1>Heading</h1>
                </body>
            </html>
            """;

        var metadata = await _extractor.ExtractAsync(html);

        Assert.Equal("OG Title", metadata.Title);
    }

    [Fact]
    public async Task ExtractAsync_PrefersOgDescriptionOverMetaDescription()
    {
        var html = """
            <html>
                <head>
                    <meta property='og:description' content='OG Description' />
                    <meta name='description' content='Meta Description' />
                </head>
                <body>
                    <p>Paragraph text</p>
                </body>
            </html>
            """;

        var metadata = await _extractor.ExtractAsync(html);

        Assert.Equal("OG Description", metadata.Excerpt);
    }

    [Fact]
    public async Task ExtractAsync_FallsBackToFirstParagraphForExcerpt()
    {
        var html = """
            <html>
                <body>
                    <p>First paragraph</p>
                    <p>Second paragraph</p>
                </body>
            </html>
            """;

        var metadata = await _extractor.ExtractAsync(html);

        Assert.Equal("First paragraph", metadata.Excerpt);
    }

    [Fact]
    public async Task ExtractAsync_UsesTwitterImageWhenOgImageMissing()
    {
        var html = """
            <html>
                <head>
                    <meta name='twitter:image' content='https://example.com/twitter.jpg' />
                </head>
            </html>
            """;

        var metadata = await _extractor.ExtractAsync(html);

        Assert.Equal("https://example.com/twitter.jpg", metadata.OgImageUrl);
    }

    [Fact]
    public async Task ExtractAsync_ReturnsNullsWhenMetadataMissing()
    {
        var html = """
            <html>
                <body>
                    <div>No metadata here</div>
                </body>
            </html>
            """;

        var metadata = await _extractor.ExtractAsync(html);

        Assert.Null(metadata.Title);
        Assert.Null(metadata.Excerpt);
        Assert.Null(metadata.OgImageUrl);
    }
}
