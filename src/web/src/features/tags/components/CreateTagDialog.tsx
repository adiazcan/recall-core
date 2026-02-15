import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useTagsStore } from '../store';
import { toast } from 'sonner';

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTagDialog({ open, onOpenChange }: CreateTagDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTag = useTagsStore((state) => state.createTag);

  useEffect(() => {
    if (!open) {
      setName('');
      setColor('#3b82f6');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const tag = await createTag(name.trim(), color || null);
      if (tag) {
        toast.success('Tag created');
        setName('');
        setColor('#3b82f6');
        onOpenChange(false);
      } else {
        toast.error('Failed to create tag');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setColor('#3b82f6');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-neutral-900 border-neutral-200 shadow-xl rounded-2xl">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="text-lg font-semibold">Create New Tag</DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Create a new tag to categorize your saved items.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs font-semibold text-neutral-400 uppercase tracking-wider"
              >
                Tag Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., JavaScript, Design, Tutorial"
                autoFocus
                required
                disabled={isSubmitting}
                className="h-10 rounded-lg border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 shadow-sm focus-visible:ring-indigo-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="color"
                className="text-xs font-semibold text-neutral-400 uppercase tracking-wider"
              >
                Color
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isSubmitting}
                  className="h-10 w-20 rounded-lg border-neutral-200 bg-white cursor-pointer"
                />
                <div
                  className="flex-1 h-10 rounded-lg border border-neutral-200 px-3 flex items-center text-sm text-neutral-600"
                  style={{ backgroundColor: color }}
                >
                  <span className="font-mono text-xs">{color}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="border-neutral-200 text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="bg-neutral-600 text-white hover:bg-neutral-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
