import React from 'react';
import { Item, Tag } from '../types';
import { useRecall } from '../context/RecallContext';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { Star, Archive, MoreHorizontal, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface ItemRowProps {
  item: Item;
  selected: boolean;
  onClick: () => void;
}

export const ItemRow: React.FC<ItemRowProps> = ({ item, selected, onClick }) => {
  const { toggleFavorite, toggleArchive, tags } = useRecall();

  // Helper to get tag details
  const getItemTags = () => {
    return item.tags.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean) as Tag[];
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <motion.div 
      layoutId={`item-${item.id}`}
      onClick={onClick}
      className={clsx(
        "group relative flex items-start gap-4 p-4 border-b border-neutral-100 cursor-pointer transition-colors duration-200",
        selected ? "bg-indigo-50/60" : "hover:bg-neutral-50 bg-white"
      )}
    >
      {/* Favicon / Image Thumbnail placeholder */}
      <div className="flex-shrink-0 mt-1">
        <div className={clsx(
          "w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center",
          selected && "border-indigo-200"
        )}>
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
             <span className="text-xs font-bold text-neutral-400">{item.domain.charAt(0).toUpperCase()}</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-8">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={clsx(
            "text-base font-semibold truncate",
            selected ? "text-indigo-900" : "text-neutral-900"
          )}>
            {item.title}
          </h3>
          {item.isFavorite && (
            <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
          )}
        </div>
        
        <p className="text-sm text-neutral-500 mb-2 truncate">
          {item.excerpt}
        </p>
        
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="font-medium text-neutral-500">{item.domain}</span>
          <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
          <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
          
          <div className="flex items-center gap-2 ml-2">
            {getItemTags().map(tag => (
              <span 
                key={tag.id} 
                className={clsx("px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600", tag.color && "bg-opacity-50")}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Actions */}
      <div className={clsx(
        "absolute right-4 top-4 flex items-center gap-1 transition-opacity",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <button 
          onClick={(e) => handleAction(e, () => toggleFavorite(item.id))}
          className="p-1.5 rounded-md text-neutral-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
          title="Favorite"
        >
          <Star className={clsx("w-4 h-4", item.isFavorite && "fill-amber-400 text-amber-400")} />
        </button>
        <button 
          onClick={(e) => handleAction(e, () => toggleArchive(item.id))}
          className="p-1.5 rounded-md text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Archive"
        >
          <Archive className={clsx("w-4 h-4", item.isArchived && "text-indigo-600")} />
        </button>
        <a 
          href={item.url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          title="Open Original"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </motion.div>
  );
};
