namespace Recall.Core.Api.Migration;

public sealed class TagMigrationRunner(TagMigrationService migrationService, ILogger<TagMigrationRunner> logger)
{
    public async Task<int> RunAsync(string[] args, CancellationToken cancellationToken = default)
    {
        try
        {
            var options = ParseOptions(args);

            if (options.Rollback)
            {
                var rollbackResult = await migrationService.RollbackAsync(options.ImportPath!, cancellationToken);
                PrintRollbackSummary(options.ImportPath!, rollbackResult);
                return 0;
            }

            var migrationResult = await migrationService.MigrateAsync(
                options.ExportPath,
                options.DryRun,
                cancellationToken: cancellationToken);

            PrintMigrationSummary(options.ExportPath, migrationResult);
            return 0;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Tag migration failed.");
            Console.Error.WriteLine($"Migration failed: {ex.Message}");
            return 1;
        }
    }

    private static MigrationOptions ParseOptions(string[] args)
    {
        var options = new MigrationOptions();

        for (var index = 0; index < args.Length; index++)
        {
            var arg = args[index];
            switch (arg)
            {
                case "--dry-run":
                    options.DryRun = true;
                    break;
                case "--rollback":
                    options.Rollback = true;
                    break;
                case "--export-path":
                    options.ExportPath = ReadOptionValue(args, ref index, "--export-path");
                    break;
                case "--import-path":
                    options.ImportPath = ReadOptionValue(args, ref index, "--import-path");
                    break;
                default:
                    throw new ArgumentException($"Unknown argument '{arg}'.");
            }
        }

        if (options.Rollback && string.IsNullOrWhiteSpace(options.ImportPath))
        {
            throw new ArgumentException("--import-path is required when --rollback is used.");
        }

        if (!options.Rollback && string.IsNullOrWhiteSpace(options.ExportPath))
        {
            throw new ArgumentException("--export-path cannot be empty.");
        }

        return options;
    }

    private static string ReadOptionValue(string[] args, ref int index, string option)
    {
        if (index + 1 >= args.Length)
        {
            throw new ArgumentException($"{option} requires a value.");
        }

        index++;
        return args[index];
    }

    private static void PrintMigrationSummary(string exportPath, TagMigrationResult result)
    {
        Console.WriteLine("Migration complete.");
        Console.WriteLine($"  Dry run: {result.DryRun}");
        Console.WriteLine($"  Items processed: {result.ItemsProcessed}");
        Console.WriteLine($"  Tags created: {result.TagsCreated}");
        Console.WriteLine($"  Duplicates merged: {result.DuplicatesMerged}");
        Console.WriteLine($"  Items updated: {result.ItemsUpdated}");
        Console.WriteLine($"  Items skipped: {result.ItemsSkipped}");
        Console.WriteLine($"  Errors: {result.Errors}");
        Console.WriteLine($"  Export: {exportPath}");
    }

    private static void PrintRollbackSummary(string importPath, TagRollbackResult result)
    {
        Console.WriteLine("Rollback complete.");
        Console.WriteLine($"  Import: {importPath}");
        Console.WriteLine($"  Items processed: {result.ItemsProcessed}");
        Console.WriteLine($"  Items updated: {result.ItemsUpdated}");
        Console.WriteLine($"  Items skipped: {result.ItemsSkipped}");
        Console.WriteLine($"  Errors: {result.Errors}");
    }

    private sealed record MigrationOptions
    {
        public string ExportPath { get; set; } = "./migration-export.json";
        public bool DryRun { get; set; }
        public bool Rollback { get; set; }
        public string? ImportPath { get; set; }
    }
}