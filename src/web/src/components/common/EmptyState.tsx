interface EmptyStateProps {
  title?: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-neutral-700">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="w-fit rounded-lg border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
