namespace Recall.Core.Enrichment.Common.Services;

public interface IHtmlFetcher
{
    Task<string> FetchHtmlAsync(string url, CancellationToken cancellationToken = default);
}
