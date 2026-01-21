import React from 'react';
import { useRecall } from '../context/RecallContext';
import { Tag, Collection } from '../types';
import { 
  X, 
  ExternalLink, 
  Calendar, 
  Hash, 
  Folder, 
  Trash2, 
  Archive, 
  Star 
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { motion } from 'motion/react';

export const ItemDetail: React.FC = () => {
  const { 
    items, 
    selectedItemId, 
    setSelectedItemId, 
    tags, 
    collections,
    toggleFavorite,
    toggleArchive,
    deleteItem
  } = useRecall();

  const item = items.find(i => i.id === selectedItemId);

  if (!item) return null;

  const itemTags = item.tags.map(tagId => tags.find(t => t.id === tagId)).filter(Boolean) as Tag[];
  const itemCollection = collections.find(c => c.id === item.collectionId);

  return (
    <>
      {/* Backdrop for Mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        onClick={() => setSelectedItemId(null)}
        className="fixed inset-0 bg-black z-30 md:hidden"
      />
      
      {/* Detail Panel */}
      <motion.div 
        initial={{ x: "100%", opacity: 0.5 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 right-0 w-full md:w-96 border-l border-neutral-200 bg-white h-full flex flex-col shadow-xl z-40"
      >
        {/* Header Actions */}
        <div className="h-14 border-b border-neutral-100 flex items-center justify-between px-4 flex-shrink-0">
          <button 
            onClick={() => setSelectedItemId(null)}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleFavorite(item.id)}
              className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
              title="Favorite"
            >
              <Star className={clsx("w-5 h-5", item.isFavorite ? "fill-amber-400 text-amber-400" : "text-neutral-400")} />
            </button>
            <button 
              onClick={() => toggleArchive(item.id)}
              className="p-2 rounded-full hover:bg-neutral-100 transition-colors"
              title="Archive"
            >
              <Archive className={clsx("w-5 h-5", item.isArchived ? "text-indigo-600" : "text-neutral-400")} />
            </button>
            <button 
              onClick={() => deleteItem(item.id)}
              className="p-2 rounded-full hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Cover Image */}
          {item.imageUrl && (
            <div className="aspect-video w-full rounded-xl overflow-hidden shadow-sm">
               <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Title & Link */}
          <div className="space-y-4">
             <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
               {item.title}
             </h2>
             <a 
               href={item.url} 
               target="_blank" 
               rel="noopener noreferrer"
               className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium break-all"
             >
               <ExternalLink className="w-4 h-4 flex-shrink-0" />
               <span className="truncate">{item.url}</span>
             </a>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-4">
            {/* Collection */}
            <div className="space-y-1">
               <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
                 <Folder className="w-3 h-3" /> Collection
               </label>
               <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border border-neutral-100 text-sm text-neutral-700">
                 {itemCollection ? itemCollection.name : "Uncategorized"}
               </div>
            </div>

            {/* Tags */}
            <div className="space-y-1">
               <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
                 <Hash className="w-3 h-3" /> Tags
               </label>
               <div className="flex flex-wrap gap-2">
                 {itemTags.length > 0 ? (
                   itemTags.map(tag => (
                     <span 
                      key={tag.id}
                      className={clsx("px-2.5 py-1 rounded-full text-xs font-medium border border-transparent", tag.color)}
                     >
                       {tag.name}
                     </span>
                   ))
                 ) : (
                   <span className="text-sm text-neutral-400 italic px-2">No tags</span>
                 )}
                 <button className="px-2 py-1 rounded-full text-xs border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors">
                   + Add
                 </button>
               </div>
            </div>

            {/* Dates */}
            <div className="space-y-1">
               <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-2">
                 <Calendar className="w-3 h-3" /> Added
               </label>
               <div className="text-sm text-neutral-700 px-2">
                 {format(new Date(item.createdAt), 'MMMM d, yyyy • h:mm a')}
               </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2 pt-4 border-t border-neutral-100">
            <label className="text-sm font-semibold text-neutral-900">
               Personal Notes
            </label>
            <textarea 
              className="w-full h-32 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
              placeholder="Add your thoughts here..."
            />
          </div>
        </div>
      </motion.div>
    </>
  );
};
