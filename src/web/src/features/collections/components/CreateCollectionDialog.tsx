import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useCollectionsStore } from '../store';
import { toast } from 'sonner';

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCollectionDialog({ open, onOpenChange }: CreateCollectionDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createCollection = useCollectionsStore((state) => state.createCollection);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const collection = await createCollection(name.trim(), description.trim() || undefined);
      if (collection) {
        toast.success('Collection created');
        setName('');
        setDescription('');
        onOpenChange(false);
      } else {
        toast.error('Failed to create collection');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create collection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Work, Travel, Recipes..."
                autoFocus
                required
                disabled={isSubmitting}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                disabled={isSubmitting}
                className="bg-slate-900 border-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Collection'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
