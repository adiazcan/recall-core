import { Archive, Inbox, Star } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { DEFAULT_VIEWS } from '../../types/views';

interface SidebarProps {
  isCollapsed?: boolean;
}

const navItems = [
  { view: DEFAULT_VIEWS.inbox, to: '/inbox', icon: Inbox },
  { view: DEFAULT_VIEWS.favorites, to: '/favorites', icon: Star },
  { view: DEFAULT_VIEWS.archive, to: '/archive', icon: Archive },
];

export function Sidebar({ isCollapsed = false }: SidebarProps) {
  const setViewState = useUiStore((state) => state.setViewState);

  return (
    <div className={cn('flex h-full flex-col gap-8 px-4 py-6', isCollapsed && 'items-center px-2')}>
      <div className="space-y-1">
        <p className={cn('text-xs uppercase tracking-[0.3em] text-slate-500', isCollapsed && 'sr-only')}>
          Navigation
        </p>
        <nav className="space-y-1">
          {navItems.map(({ view, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setViewState(view)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition',
                  isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-900 hover:text-white',
                  isCollapsed && 'justify-center px-2',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className={cn(isCollapsed && 'hidden')}>{view.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <div className={cn('space-y-3', isCollapsed && 'hidden')}>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Collections</p>
        <div className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-500">
          Collections will appear here.
        </div>
      </div>
      <div className={cn('space-y-3', isCollapsed && 'hidden')}>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tags</p>
        <div className="rounded-lg border border-dashed border-slate-800 px-3 py-4 text-xs text-slate-500">
          Tags will appear here.
        </div>
      </div>
    </div>
  );
}
