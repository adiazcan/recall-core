namespace Recall.Core.Enrichment.Services;

public sealed class EnrichmentOptions
{
    public string ThumbnailContainer { get; init; } = "thumbnails";
    public int FetchTimeoutSeconds { get; init; } = 30;
    public int ConnectTimeoutSeconds { get; init; } = 10;
    public int MaxHtmlSizeBytes { get; init; } = 5 * 1024 * 1024;
    public int MaxRedirects { get; init; } = 3;
    public int ScreenshotTimeoutSeconds { get; init; } = 15;
    public int ThumbnailMaxWidth { get; init; } = 600;
    public int ThumbnailMaxHeight { get; init; } = 400;
    public int ThumbnailQuality { get; init; } = 80;
    public string UserAgent { get; init; } = "Recall.Enrichment/1.0";
}
