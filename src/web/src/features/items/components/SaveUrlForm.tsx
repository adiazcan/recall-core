import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useItemsStore } from '../store';
import { useToastStore } from '../../../stores/toast-store';

interface SaveUrlFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
  variant?: 'dialog' | 'inline';
}

const normalizeUrl = (value: string) => value.trim();

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export function SaveUrlForm({ onSaved, onCancel, variant = 'dialog' }: SaveUrlFormProps) {
  const createItem = useItemsStore((state) => state.createItem);
  const isSaving = useItemsStore((state) => state.isSaving);
  const toast = useToastStore();

  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    const trimmedUrl = normalizeUrl(url);

    if (!trimmedUrl) {
      return 'Please enter a URL.';
    }

    if (!isValidUrl(trimmedUrl)) {
      return 'Please enter a valid URL.';
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      const result = await createItem(normalizeUrl(url));
      if (!result) {
        return;
      }

      if (result.created) {
        toast.success('Saved to your library.');
      } else {
        toast.info('That URL is already saved.');
      }

      setUrl('');
      onSaved?.();
    } catch {
      toast.error('Unable to save that URL.');
    }
  };

  if (variant === 'inline') {
    return (
      <form className="flex flex-col sm:flex-row gap-2 sm:gap-3" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-1.5 sm:space-y-2">
          <Input
            id="save-url-input"
            type="url"
            placeholder="Paste URL to save..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-9 sm:h-10 bg-neutral-50 border-neutral-200 rounded-lg px-3 sm:px-4 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:border-indigo-500 focus-visible:ring-indigo-500/30"
            autoFocus
          />
          {error ? <p className="text-xs sm:text-sm text-rose-600">{error}</p> : null}
        </div>
        <div className="flex gap-1.5 sm:gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="h-9 sm:h-10 rounded-lg border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 text-xs sm:text-sm px-3 sm:px-4"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-9 sm:h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm px-3 sm:px-4"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="save-url-input">
          URL
        </label>
        <Input
          id="save-url-input"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={error ? true : undefined}
          className="h-11 bg-slate-900/80 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:ring-slate-500/30"
        />
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 rounded-lg border-white/90 bg-white text-slate-900 hover:bg-slate-100"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="h-10 rounded-lg bg-white text-slate-900 hover:bg-slate-100"
        >
          {isSaving ? 'Saving…' : 'Save URL'}
        </Button>
      </div>
    </form>
  );
}
