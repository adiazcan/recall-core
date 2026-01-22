import { Archive, Inbox, Star, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { DEFAULT_VIEWS } from '../../types/views';

const navItems = [
  { view: DEFAULT_VIEWS.inbox, to: '/inbox', icon: Inbox },
  { view: DEFAULT_VIEWS.favorites, to: '/favorites', icon: Star },
  { view: DEFAULT_VIEWS.archive, to: '/archive', icon: Archive },
];

export function Sidebar() {
  const setViewState = useUiStore((state) => state.setViewState);

  return (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200 w-64 flex-shrink-0">
      {/* Header */}
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-neutral-900">Recall</h1>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 space-y-8">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navItems.map(({ view, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setViewState(view)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600' : 'text-neutral-500')} />
                  <span className="flex-1 text-left">{view.title}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Collections */}
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">
            Collections
          </h3>
          <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400">
            Collections will appear here.
          </div>
        </div>

        {/* Tags */}
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Tags</h3>
          <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-400">
            Tags will appear here.
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-neutral-100 flex-shrink-0">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
          <div className="w-6 h-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-medium text-neutral-600">
            JD
          </div>
          <span className="flex-1 text-left font-medium">John Doe</span>
          <Settings className="w-4 h-4 text-neutral-400" />
        </button>
      </div>
    </div>
  );
}
