import { X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import type { Tag, TagSummary } from '../../../types/entities';

interface TagChipProps {
  tag: Tag | TagSummary;
  onRemove?: () => void;
  className?: string;
}

const isSummaryTag = (tag: Tag | TagSummary): tag is TagSummary => 'name' in tag;

/**
 * Calculates relative luminance of a color and returns appropriate text color for contrast.
 * Uses WCAG formula for relative luminance.
 */
function getContrastTextColor(backgroundColor: string): string {
  // Parse hex color (supports #RGB and #RRGGBB)
  let hex = backgroundColor.replace('#', '');
  
  // Convert shorthand hex to full form
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Calculate relative luminance
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
  // Use white text only for very dark backgrounds (luminance < 0.4)
  // This ensures grey and lighter colors get black text
  return luminance < 0.4 ? '#ffffff' : '#111827';
}

export function TagChip({ tag, onRemove, className }: TagChipProps) {
  const name = isSummaryTag(tag) ? tag.name : tag.displayName;
  const color = tag.color;
  const textColor = color ? getContrastTextColor(color) : undefined;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border-0 flex items-center gap-1.5 group bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
        className,
      )}
      style={color ? { backgroundColor: color, color: textColor } : undefined}
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
