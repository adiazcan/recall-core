import React, { useState } from 'react';
import { useRecall } from '../context/RecallContext';
import { ItemRow } from './ItemRow';
import { Plus, Search, Filter, Inbox, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ItemList: React.FC = () => {
  const { 
    getFilteredItems, 
    viewState, 
    selectedItemId, 
    setSelectedItemId,
    addItem,
    setMobileSidebarOpen
  } = useRecall();
  
  const [showAddInput, setShowAddInput] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const items = getFilteredItems();

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) {
      addItem(newUrl);
      setNewUrl('');
      setShowAddInput(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative w-full">
      {/* Header */}
      <div className="h-16 border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-900"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-semibold text-neutral-900 truncate max-w-[120px] md:max-w-none">
              {viewState.title}
            </h2>
            <span className="text-sm text-neutral-400 font-medium bg-neutral-100 px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative group hidden md:block">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-neutral-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="pl-9 pr-4 py-1.5 text-sm bg-neutral-100 border-transparent rounded-lg focus:bg-white focus:border-neutral-300 focus:ring-0 w-48 transition-all"
            />
          </div>
          
          <button className="md:hidden p-2 text-neutral-400 hover:text-neutral-900 transition-colors">
            <Search className="w-5 h-5" />
          </button>

          <button className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors">
            <Filter className="w-5 h-5 md:w-4 md:h-4" />
          </button>
          
          <button 
            onClick={() => setShowAddInput(true)}
            className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Save URL</span>
          </button>
        </div>
      </div>

      {/* Add Item Input Modal/Overlay */}
      <AnimatePresence>
        {showAddInput && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-4 right-4 md:left-6 md:right-6 z-20 bg-white shadow-xl border border-neutral-200 rounded-xl p-4"
          >
            <form onSubmit={handleAddSubmit} className="flex flex-col md:flex-row gap-3">
              <input
                type="url"
                autoFocus
                placeholder="Paste URL to save..."
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <button 
                  type="button"
                  onClick={() => setShowAddInput(false)}
                  className="bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto w-full">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 px-4 text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-neutral-500 font-medium">No items found</p>
            <p className="text-sm text-neutral-400 mt-1">This view is empty</p>
          </div>
        ) : (
          <div className="pb-20 md:pb-10 w-full">
            {items.map(item => (
              <ItemRow 
                key={item.id} 
                item={item} 
                selected={selectedItemId === item.id}
                onClick={() => setSelectedItemId(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
