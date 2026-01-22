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
    <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">
      <div>
        <h2 className="text-lg font-semibold text-red-900">{title}</h2>
        <p className="text-sm text-red-700">{message}</p>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="w-fit rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
