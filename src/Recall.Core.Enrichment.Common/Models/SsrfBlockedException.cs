namespace Recall.Core.Enrichment.Common.Models;

public sealed class SsrfBlockedException(string message) : Exception(message);
