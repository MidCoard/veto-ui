import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getToken, onUnauthorized, setToken } from '../api/client';
import { getAuthStatus, login, logout, setup } from '../api/endpoints';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { getBackendPort } from '../config/backend';

/**
 * AuthContext — boot flow and session-token lifecycle.
 *
 * Boot: read the stored token, then GET /api/auth/status:
 *   - setupNeeded                    → 'setup'      (first-run vault init)
 *   - token present && authenticated → 'signedIn'
 *   - otherwise                      → 'signedOut'
 * Tokens live in-memory server-side, so any 401 (e.g. after a backend restart)
 * routes back to 'signedOut' with an explanatory message.
 */

export type AuthState = 'loading' | 'setup' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthState;
  username: string | null;
  role: string | null;
  authError: string | null;
  signIn: (username: string, password: string) => Promise<boolean>;
  firstRunSetup: (username: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MIN_PASSWORD_LENGTH = 8;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  // Ref mirror so the boot/401 effects read the current locale without
  // re-running on every language switch.
  const tRef = useRef<Translate>(t);
  tRef.current = t;

  const [status, setStatus] = useState<AuthState>('loading');
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async (): Promise<void> => {
      const token = getToken();
      try {
        const authStatus = await getAuthStatus();
        if (cancelled) return;
        if (authStatus.setupNeeded) {
          setStatus('setup');
        } else if (token !== null && authStatus.authenticated) {
          setUsername(authStatus.username ?? authStatus.currentUser ?? null);
          setStatus('signedIn');
        } else {
          if (token !== null) setToken(null);
          setStatus('signedOut');
        }
      } catch {
        if (cancelled) return;
        setStatus('signedOut');
        setAuthError(tRef.current('error.backendUnreachable', { port: getBackendPort() }));
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      setUsername(null);
      setRole(null);
      setStatus('signedOut');
      setAuthError(tRef.current('error.backendRestarted'));
    });
    return () => onUnauthorized(null);
  }, []);

  const signIn = useCallback(async (user: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const response = await login({ username: user, password });
      setToken(response.token);
      setUsername(response.username);
      setRole(response.role);
      setStatus('signedIn');
      return true;
    } catch (error) {
      setAuthError(
        error instanceof ApiError
          ? error.message
          : tRef.current('error.backendUnreachable', { port: getBackendPort() }),
      );
      return false;
    }
  }, []);

  const firstRunSetup = useCallback(async (user: string, password: string): Promise<boolean> => {
    setAuthError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setAuthError(tRef.current('error.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return false;
    }
    try {
      const response = await setup({ username: user, password });
      setToken(response.token);
      setUsername(response.username);
      setRole(response.role);
      setStatus('signedIn');
      return true;
    } catch (error) {
      setAuthError(
        error instanceof ApiError
          ? error.message
          : tRef.current('error.backendUnreachable', { port: getBackendPort() }),
      );
      return false;
    }
  }, []);

  const signOut = useCallback((): void => {
    void logout().catch(() => {
      // Best-effort: the token may already be dead server-side.
    });
    setToken(null);
    setUsername(null);
    setRole(null);
    setAuthError(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, username, role, authError, signIn, firstRunSetup, signOut }),
    [status, username, role, authError, signIn, firstRunSetup, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
