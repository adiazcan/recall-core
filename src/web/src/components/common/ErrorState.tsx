interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  actionLabel = 'Try again',
  onAction,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
      <div>
        <h2 className="text-lg font-semibold text-rose-50">{title}</h2>
        <p className="text-sm text-rose-200">{message}</p>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="w-fit rounded-lg border border-rose-400/40 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:bg-rose-500/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
