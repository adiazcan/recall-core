import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useItemsStore } from '../store';
import { useToastStore } from '../../../stores/toast-store';

interface SaveUrlFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
}

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

const normalizeUrl = (value: string) => value.trim();

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

export function SaveUrlForm({ onSaved, onCancel }: SaveUrlFormProps) {
  const createItem = useItemsStore((state) => state.createItem);
  const isSaving = useItemsStore((state) => state.isSaving);
  const toast = useToastStore();

  const [url, setUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const validate = () => {
    const trimmedUrl = normalizeUrl(url);

    if (!trimmedUrl) {
      return 'Please enter a URL.';
    }

    if (!isValidUrl(trimmedUrl)) {
      return 'Please enter a valid URL.';
    }

    if (tags.length > MAX_TAGS) {
      return 'Too many tags (max 20).';
    }

    const invalidTag = tags.find((tag) => tag.length > MAX_TAG_LENGTH);
    if (invalidTag) {
      return `Tag "${invalidTag}" is too long (max 50 characters).`;
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
      const result = await createItem(normalizeUrl(url), tags.length > 0 ? tags : undefined);
      if (!result) {
        return;
      }

      if (result.created) {
        toast.success('Saved to your library.');
      } else {
        toast.info('That URL is already saved.');
      }

      setUrl('');
      setTagsInput('');
      onSaved?.();
    } catch {
      toast.error('Unable to save that URL.');
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
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
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="save-url-tags">
          Tags (optional)
        </label>
        <Input
          id="save-url-tags"
          type="text"
          placeholder="design, research, productivity"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <p className="text-xs text-slate-500">Separate tags with commas. Up to 20 tags.</p>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save URL'}
        </Button>
      </div>
    </form>
  );
}
