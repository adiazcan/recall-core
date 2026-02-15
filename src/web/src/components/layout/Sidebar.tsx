import { Archive, Inbox, Star, Settings, Plus } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { cn } from '../../lib/utils';
import { useUiStore } from '../../stores/ui-store';
import { DEFAULT_VIEWS, type ViewState } from '../../types/views';
import { CollectionList } from '../../features/collections/components/CollectionList';
import { TagList } from '../../features/tags/components/TagList';
import { SignInButton } from '../auth/SignInButton';
import { UserDisplay } from '../auth/UserDisplay';
import {
  isInExtensionFrame,
  hasValidExtensionToken,
  onExtensionTokenChange,
} from '../../lib/extensionAuth';

const navItems = [
  { view: DEFAULT_VIEWS.inbox, to: '/inbox', icon: Inbox },
  { view: DEFAULT_VIEWS.favorites, to: '/favorites', icon: Star },
  { view: DEFAULT_VIEWS.archive, to: '/archive', icon: Archive },
];

export function Sidebar() {
  const setViewState = useUiStore((state) => state.setViewState);
  const openCreateCollection = useUiStore((state) => state.openCreateCollection);
  const openCreateTag = useUiStore((state) => state.openCreateTag);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const isMsalAuthenticated = useIsAuthenticated();
  const [hasExtensionToken, setHasExtensionToken] = useState(hasValidExtensionToken());
  const inExtensionFrame = isInExtensionFrame();

  // Listen for extension token changes
  useEffect(() => {
    if (!inExtensionFrame) {
      return;
    }

    // Check current state
    if (hasValidExtensionToken()) {
      setHasExtensionToken(true);
    }

    return onExtensionTokenChange((hasToken) => {
      setHasExtensionToken(hasToken);
    });
  }, [inExtensionFrame]);

  // User is authenticated if either MSAL or extension token is valid
  const isAuthenticated = isMsalAuthenticated || (inExtensionFrame && hasExtensionToken);

  // Sync view state with current route on mount and navigation
  useEffect(() => {
    const matchedNav = navItems.find(item => item.to === location.pathname);
    if (matchedNav) {
      setViewState(matchedNav.view);
    }
  }, [location.pathname, setViewState]);

  const handleNavClick = (view: ViewState) => {
    setViewState(view);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!navRef.current) return;

      const focusableElements = navRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled)'
      );
      const focusedElement = document.activeElement as HTMLElement;
      const currentIndex = Array.from(focusableElements).indexOf(focusedElement);

      if (currentIndex === -1) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < focusableElements.length - 1) {
            focusableElements[currentIndex + 1]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            focusableElements[currentIndex - 1]?.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          focusableElements[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          focusableElements[focusableElements.length - 1]?.focus();
          break;
      }
    };

    const navElement = navRef.current;
    navElement?.addEventListener('keydown', handleKeyDown);

    return () => {
      navElement?.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={navRef}
      className="flex flex-col h-full bg-white border-r border-neutral-200 w-56 sm:w-60 md:w-64 lg:w-[183px] flex-shrink-0"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="h-[76px] flex items-center pl-6">
        <h1 className="text-xl font-bold tracking-[-0.95px] text-neutral-900 leading-7">Recall</h1>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 space-y-8">
        {/* Main Navigation */}
        <nav className="space-y-1" role="list" aria-label="Main views">
          {navItems.map(({ view, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => handleNavClick(view)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 h-9 rounded-[10px] text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset',
                  isActive
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                )
              }
              aria-label={view.title}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-4 w-4', isActive ? 'text-indigo-600' : 'text-neutral-500')} />
                  <span className="flex-1 text-left">{view.title}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Collections */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-[0.6px] leading-4">
              Collections
            </h3>
            <button
              type="button"
              className="size-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              onClick={openCreateCollection}
              aria-label="Create new collection"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <CollectionList />
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-[0.6px] leading-4">
              Tags
            </h3>
            <button
              type="button"
              className="size-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              onClick={openCreateTag}
              aria-label="Create new tag"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <TagList />
        </div>
      </div>

      {/* User Profile */}
      <div className="h-[73px] px-4 pt-[17px] border-t border-neutral-100 flex-shrink-0">
        {isAuthenticated ? (
          <div
            className="flex items-center gap-3 px-3 h-10 rounded-[10px]"
            aria-label="User profile"
          >
            {inExtensionFrame ? (
              <span className="text-sm text-neutral-600">Signed in via extension</span>
            ) : (
              <>
                <UserDisplay />
                <Settings className="w-4 h-4 flex-shrink-0 text-neutral-400" />
              </>
            )}
          </div>
        ) : (
          <SignInButton className="w-full" />
        )}
      </div>
    </div>
  );
}
