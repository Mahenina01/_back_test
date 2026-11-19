import React, { createContext, useContext } from 'react';
import { useLiveSocket } from '../hooks/useLiveSocket';

const LiveDataContext = createContext(null);

export function LiveDataProvider({ children }) {
  const liveData = useLiveSocket();

  return (
    <LiveDataContext.Provider value={liveData}>
      {children}
    </LiveDataContext.Provider>
  );
}

export function useLiveData() {
  const context = useContext(LiveDataContext);
  if (!context) {
    throw new Error('useLiveData must be used within LiveDataProvider');
  }
  return context;
}