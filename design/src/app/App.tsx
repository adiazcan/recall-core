import React from 'react';
import { RecallProvider, useRecall } from './context/RecallContext';
import { Sidebar } from './components/Sidebar';
import { ItemList } from './components/ItemList';
import { ItemDetail } from './components/ItemDetail';
import { AnimatePresence } from 'motion/react';

const MainLayout: React.FC = () => {
  const { selectedItemId } = useRecall();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50 font-sans text-neutral-900">
      <Sidebar />
      <div className="flex-1 flex overflow-hidden relative">
        <ItemList />
        <AnimatePresence>
          {selectedItemId && (
            <ItemDetail />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <RecallProvider>
      <MainLayout />
    </RecallProvider>
  );
};

export default App;
