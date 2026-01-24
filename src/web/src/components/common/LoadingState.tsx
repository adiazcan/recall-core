interface LoadingStateProps {
  title?: string;
  message?: string;
}

export function LoadingState({ title = 'Loading', message = 'Fetching the latest data.' }: LoadingStateProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-neutral-700">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}
