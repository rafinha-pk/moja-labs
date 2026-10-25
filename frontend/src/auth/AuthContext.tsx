import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, usersApi } from '../api';
import {
  clearTokens,
  currentRefreshToken,
  hasStoredSession,
  restoreSession,
  setSessionLostHandler,
  storeTokens,
} from '../api/client';
import type { ThemeName, User } from '../api/types';
import { applyTheme } from '../theme/theme';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; theme?: ThemeName }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasStoredSession());

  const adopt = useCallback((next: User | null) => {
    setUser(next);
    if (next) applyTheme(next.theme);
  }, []);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    if (!hasStoredSession()) return;
    restoreSession()
      .then((ok) => (ok ? usersApi.me() : null))
      .then(adopt)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [adopt]);

  const login = useCallback(
    async (email: string, password: string) => {
      storeTokens(await authApi.login(email, password));
      adopt(await usersApi.me());
    },
    [adopt],
  );

  const register = useCallback(
    async (email: string, name: string, password: string) => {
      await authApi.register(email, name, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const token = currentRefreshToken();
    clearTokens();
    setUser(null);
    if (token) await authApi.logout(token).catch(() => undefined);
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; theme?: ThemeName }) => {
      adopt(await usersApi.update(data));
    },
    [adopt],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateProfile }),
    [user, loading, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser needs an authenticated user');
  return user;
}
