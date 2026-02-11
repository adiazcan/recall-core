import { X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

interface TagChipProps {
  name: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}

export function TagChip({ name, color, onRemove, className }: TagChipProps) {
  const colorClasses = color || 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200';

  return (
    <Badge
      variant="secondary"
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border-0 flex items-center gap-1.5 group',
        colorClasses,
        className,
      )}
    >
      <span>{name}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-4 w-4 p-0 hover:bg-transparent opacity-60 group-hover:opacity-100 transition-opacity"
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Badge>
  );
}
