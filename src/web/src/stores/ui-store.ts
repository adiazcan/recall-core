import { create } from 'zustand';
import { DEFAULT_VIEWS, type ViewState } from '../types/views';

export interface UIState {
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  isSaveUrlOpen: boolean;
  openSaveUrl: () => void;
  closeSaveUrl: () => void;
  isCreateCollectionOpen: boolean;
  openCreateCollection: () => void;
  closeCreateCollection: () => void;
}

export const useUiStore = create<UIState>((set) => ({
  viewState: DEFAULT_VIEWS.inbox,
  setViewState: (view) =>
    set((state) => {
      // Only update if the view type or ID is different to prevent unnecessary re-renders
      if (state.viewState.type === view.type && state.viewState.id === view.id) {
        return state;
      }
      return { viewState: view };
    }),
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  isSaveUrlOpen: false,
  openSaveUrl: () => set({ isSaveUrlOpen: true }),
  closeSaveUrl: () => set({ isSaveUrlOpen: false }),
  isCreateCollectionOpen: false,
  openCreateCollection: () => set({ isCreateCollectionOpen: true }),
  closeCreateCollection: () => set({ isCreateCollectionOpen: false }),
}));
