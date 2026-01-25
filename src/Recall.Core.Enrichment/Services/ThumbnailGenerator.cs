using Microsoft.Playwright;
using SkiaSharp;

namespace Recall.Core.Enrichment.Services;

public sealed class ThumbnailGenerator : IThumbnailGenerator, IAsyncDisposable
{
    private readonly IHtmlFetcher _htmlFetcher;
    private readonly EnrichmentOptions _options;
    private readonly ILogger<ThumbnailGenerator> _logger;
    private readonly Lazy<Task<IBrowser>> _browser;
    private IPlaywright? _playwright;

    public ThumbnailGenerator(IHtmlFetcher htmlFetcher, EnrichmentOptions options, ILogger<ThumbnailGenerator> logger)
    {
        _htmlFetcher = htmlFetcher;
        _options = options;
        _logger = logger;
        _browser = new Lazy<Task<IBrowser>>(InitializeBrowserAsync);
    }

    public async Task<byte[]?> GenerateAsync(string pageUrl, string? ogImageUrl, CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(ogImageUrl))
        {
            try
            {
                var imageBytes = await _htmlFetcher.FetchBytesAsync(ogImageUrl, cancellationToken);
                return ResizeToThumbnail(imageBytes);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch og:image thumbnail. Url={Url}", ogImageUrl);
            }
        }

        try
        {
            var browser = await _browser.Value;
            var page = await browser.NewPageAsync();
            await page.SetViewportSizeAsync(1200, 800);

            try
            {
                await page.GotoAsync(pageUrl, new PageGotoOptions
                {
                    Timeout = _options.ScreenshotTimeoutSeconds * 1000,
                    WaitUntil = WaitUntilState.NetworkIdle
                });

                var screenshot = await page.ScreenshotAsync(new PageScreenshotOptions
                {
                    Type = ScreenshotType.Jpeg,
                    Quality = _options.ThumbnailQuality,
                    FullPage = true
                });

                return ResizeToThumbnail(screenshot);
            }
            finally
            {
                await page.CloseAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to capture screenshot for {Url}", pageUrl);
            return null;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser.IsValueCreated)
        {
            var browser = await _browser.Value;
            await browser.CloseAsync();
        }

        _playwright?.Dispose();
    }

    private async Task<IBrowser> InitializeBrowserAsync()
    {
        _playwright = await Playwright.CreateAsync();
        return await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true
        });
    }

    private byte[] ResizeToThumbnail(byte[] imageBytes)
    {
        using var original = SKBitmap.Decode(imageBytes);
        if (original is null)
        {
            throw new InvalidOperationException("Invalid image data.");
        }

        var (width, height) = CalculateDimensions(
            original.Width,
            original.Height,
            _options.ThumbnailMaxWidth,
            _options.ThumbnailMaxHeight);

        using var resized = original.Resize(new SKImageInfo(width, height), SKFilterQuality.High);
        using var image = resized is null ? SKImage.FromBitmap(original) : SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, _options.ThumbnailQuality);

        return data.ToArray();
    }

    private static (int Width, int Height) CalculateDimensions(int width, int height, int maxWidth, int maxHeight)
    {
        var ratioX = (double)maxWidth / width;
        var ratioY = (double)maxHeight / height;
        var ratio = Math.Min(ratioX, ratioY);

        var newWidth = Math.Max(1, (int)(width * ratio));
        var newHeight = Math.Max(1, (int)(height * ratio));
        return (newWidth, newHeight);
    }
}
