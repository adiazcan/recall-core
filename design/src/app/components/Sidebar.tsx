import React from 'react';
import { 
  Inbox, 
  Star, 
  Archive, 
  Folder, 
  Hash, 
  Plus,
  Settings,
  X
} from 'lucide-react';
import { useRecall } from '../context/RecallContext';
import clsx from 'clsx';
import { Collection, Tag, ViewType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const Sidebar: React.FC = () => {
  const { 
    viewState, 
    setViewState, 
    collections, 
    tags, 
    items,
    isMobileSidebarOpen,
    setMobileSidebarOpen
  } = useRecall();

  const handleNavClick = (type: ViewType, id?: string, title?: string) => {
    setViewState({ type, id, title: title || type.charAt(0).toUpperCase() + type.slice(1) });
    setMobileSidebarOpen(false); // Close sidebar on mobile when navigating
  };

  const NavItem = ({ 
    active, 
    icon: Icon, 
    label, 
    count, 
    onClick 
  }: { 
    active: boolean; 
    icon: any; 
    label: string; 
    count?: number; 
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active 
          ? "bg-neutral-100 text-neutral-900" 
          : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
      )}
    >
      <Icon className={clsx("w-4 h-4", active ? "text-indigo-600" : "text-neutral-500")} />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-neutral-400 font-normal">{count}</span>
      )}
    </button>
  );

  const getUnreadCount = () => items.filter(i => !i.isArchived && !i.isRead).length;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200">
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">Recall</h1>
        <button 
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden p-1 rounded-md text-neutral-400 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-8">
        {/* Main Navigation */}
        <div className="space-y-1">
          <NavItem 
            active={viewState.type === 'inbox'} 
            icon={Inbox} 
            label="Inbox" 
            count={getUnreadCount()}
            onClick={() => handleNavClick('inbox', undefined, 'Inbox')}
          />
          <NavItem 
            active={viewState.type === 'favorites'} 
            icon={Star} 
            label="Favorites" 
            onClick={() => handleNavClick('favorites', undefined, 'Favorites')}
          />
          <NavItem 
            active={viewState.type === 'archive'} 
            icon={Archive} 
            label="Archive" 
            onClick={() => handleNavClick('archive', undefined, 'Archive')}
          />
        </div>

        {/* Collections */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Collections</h3>
            <button className="text-neutral-400 hover:text-indigo-600 transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {collections.map((collection: Collection) => (
              <NavItem 
                key={collection.id}
                active={viewState.type === 'collection' && viewState.id === collection.id}
                icon={Folder} 
                label={collection.name}
                count={collection.count}
                onClick={() => handleNavClick('collection', collection.id, collection.name)}
              />
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Tags</h3>
            <button className="text-neutral-400 hover:text-indigo-600 transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {tags.map((tag: Tag) => (
              <NavItem 
                key={tag.id}
                active={viewState.type === 'tag' && viewState.id === tag.id}
                icon={Hash} 
                label={tag.name}
                onClick={() => handleNavClick('tag', tag.id, tag.name)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-neutral-100 flex-shrink-0">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50">
          <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
            JD
          </div>
          <span className="flex-1 text-left font-medium">John Doe</span>
          <Settings className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 h-full flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden bg-white shadow-xl"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
