import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getToken, setToken, setOnUnauthorized } from '../services/api.js';
import { loginWithGoogle as loginRequest, fetchMe } from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'loading' until we know, then 'authenticated' | 'anonymous'
  const [status, setStatus] = useState(getToken() ? 'loading' : 'anonymous');

  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setOnUnauthorized(clear);
  }, [clear]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    fetchMe().then(
      ({ user: me }) => {
        if (!cancelled) {
          setUser(me);
          setStatus('authenticated');
        }
      },
      () => {
        if (!cancelled) clear();
      }
    );
    return () => {
      cancelled = true;
    };
  }, [clear]);

  const login = useCallback(async (credential) => {
    const { token, user: me } = await loginRequest(credential);
    setToken(token);
    setUser(me);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => clear(), [clear]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
