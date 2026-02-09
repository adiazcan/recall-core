using Recall.Core.Enrichment.Common.Models;

namespace Recall.Core.Enrichment.Common.Services;

public interface IMetadataExtractor
{
    Task<PageMetadata> ExtractAsync(string html);
}
