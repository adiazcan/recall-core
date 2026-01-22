import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { useItemsStore } from '../store';
import { useToastStore } from '../../../stores/toast-store';

interface SaveUrlFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
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

export function SaveUrlForm({ onSaved, onCancel }: SaveUrlFormProps) {
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
      const result = await createItem(normalizeUrl(url), undefined);
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

  return (
    <div className="bg-white shadow-xl border border-neutral-200 rounded-xl p-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="url"
          autoFocus
          placeholder="Paste URL to save..."
          className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
            className="bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
