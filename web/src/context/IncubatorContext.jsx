import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { apiClient } from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';

const IncubatorContext = createContext(null);

export function IncubatorProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [incubators, setIncubators] = useState([]);
  const [selectedIncubatorId, setSelectedIncubatorId] = useState(null);
  const [selectedIncubator, setSelectedIncubator] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadIncubators = async (preferredId = null) => {
    setLoading(true);
    try {
      const data = await apiClient.getIncubators();
      setIncubators(data || []);
      
      const savedId = localStorage.getItem('selectedIncubatorId');
      let defaultId = preferredId || savedId;
      
      const exists = data.some(inc => String(inc.id) === String(defaultId));
      if (!exists && data.length > 0) {
        defaultId = data[0].id;
      }
      
      if (defaultId) {
        const found = data.find(inc => String(inc.id) === String(defaultId));
        if (found) {
          setSelectedIncubatorId(found.id);
          setSelectedIncubator(found);
          localStorage.setItem('selectedIncubatorId', String(found.id));
        }
      } else {
        setSelectedIncubatorId(null);
        setSelectedIncubator(null);
        localStorage.removeItem('selectedIncubatorId');
      }
      return data;
    } catch (err) {
      console.error('Erreur chargement des couveuses:', err);
      setIncubators([]);
      setSelectedIncubatorId(null);
      setSelectedIncubator(null);
      localStorage.removeItem('selectedIncubatorId');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      loadIncubators();
      return;
    }

    setIncubators([]);
    setSelectedIncubatorId(null);
    setSelectedIncubator(null);
    localStorage.removeItem('selectedIncubatorId');
    setLoading(false);
  }, [authLoading, user?.id]);

  const selectIncubator = (id) => {
    const found = incubators.find(inc => String(inc.id) === String(id));
    if (!found) return;
    
    setSelectedIncubatorId(found.id);
    localStorage.setItem('selectedIncubatorId', String(found.id));
    
    setSelectedIncubator(found || null);
  };

  const value = {
    incubators,
    selectedIncubatorId,
    selectedIncubator,
    selectIncubator,
    loadIncubators,
    loading,
  };

  return (
    <IncubatorContext.Provider value={value}>
      {children}
    </IncubatorContext.Provider>
  );
}

export function useIncubator() {
  const context = useContext(IncubatorContext);
  if (!context) {
    throw new Error('useIncubator must be used within IncubatorProvider');
  }
  return context;
}