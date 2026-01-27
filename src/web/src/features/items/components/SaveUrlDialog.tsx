import { SaveUrlForm } from './SaveUrlForm';

interface SaveUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveUrlDialog({ open, onOpenChange }: SaveUrlDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 md:left-6 md:right-6 z-20 bg-white shadow-xl border border-neutral-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
      <SaveUrlForm variant="inline" onSaved={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
    </div>
  );
}
