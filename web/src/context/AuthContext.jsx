import React, { createContext, useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'smart_incubator_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    };

    window.addEventListener('smart-incubator:session-expired', handleSessionExpired);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { user: savedUser } = JSON.parse(raw);
        setUser(savedUser ? { ...savedUser, name: savedUser.name ?? savedUser.full_name } : null);
      }
    } catch (err) {
      console.error('Erreur lecture session:', err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
    return () => window.removeEventListener('smart-incubator:session-expired', handleSessionExpired);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await apiClient.postLogin({ email, password });
      const signedInUser = { ...res.user, name: res.user.name ?? res.user.full_name };
      setUser(signedInUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: signedInUser,
        token: res.access_token ?? res.token,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Identifiants invalides' };
    }
  };

  const register = async (fullName, email, password) => {
    try {
      await apiClient.postRegister({ full_name: fullName, email, password });
      return await login(email, password);
    } catch (err) {
      return { success: false, message: err.message || 'Inscription impossible' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}