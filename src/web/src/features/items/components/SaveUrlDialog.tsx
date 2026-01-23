import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { SaveUrlForm } from './SaveUrlForm';

interface SaveUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveUrlDialog({ open, onOpenChange }: SaveUrlDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle>Save a URL</DialogTitle>
        </DialogHeader>
        <SaveUrlForm onSaved={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
