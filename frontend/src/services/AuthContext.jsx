import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCurrentUser, loginUser } from './authApi.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'inspection-auth';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredAuth()?.token || null);
  const [user, setUser] = useState(() => readStoredAuth()?.user || null);
  const [loading, setLoading] = useState(Boolean(token && !user));

  useEffect(() => {
    let ignore = false;

    async function restoreSession() {
      if (!token || user) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(token);
        if (!ignore) {
          setUser(currentUser);
          storeAuth(token, currentUser);
        }
      } catch {
        if (!ignore) {
          clearAuth();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      ignore = true;
    };
  }, [token, user]);

  async function login(credentials) {
    const response = await loginUser(credentials);
    const nextUser = {
      userId: response.userId,
      username: response.username,
      role: response.role
    };
    setToken(response.token);
    setUser(nextUser);
    storeAuth(response.token, nextUser);
    return nextUser;
  }

  function logout() {
    clearAuth();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeAuth(token, user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

