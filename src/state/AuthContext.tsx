import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getToken, onUnauthorized, setToken } from '../api/client';
import { login, logout, setup } from '../api/endpoints';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { backendApiUrl, getBackendPort, isValidBackendPort, setBackendPort } from '../config/backend';

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

export type ConnectionState = 'checking' | 'online' | 'offline' | 'invalid';

export type AuthState = 'loading' | 'setup' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthState;
  connection: ConnectionState;
  portInput: string;
  changePort: (value: string) => void;
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

  const [portInput, setPortInput] = useState(String(getBackendPort()));
  const [connection, setConnection] = useState<ConnectionState>('checking');
  const authEpoch = useRef(0);
  const signedIn = status === 'signedIn';

  const changePort = useCallback((value: string): void => {
    authEpoch.current += 1;
    setToken(null);
    setUsername(null);
    setRole(null);
    setAuthError(null);
    setStatus('signedOut');
    setConnection(/^\d+$/.test(value) && isValidBackendPort(Number(value)) ? 'checking' : 'invalid');
    setPortInput(value);
  }, []);

  useEffect(() => {
    if (signedIn) return;
    const port = Number(portInput);
    if (!/^\d+$/.test(portInput) || !isValidBackendPort(port)) {
      setConnection('invalid');
      setStatus('signedOut');
      return;
    }
    let cancelled = false;
    let active: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const check = async (): Promise<void> => {
      if (active !== null) return;
      const controller = new AbortController();
      active = controller;
      const epoch = authEpoch.current;
      timeout = setTimeout(() => controller.abort(), 900);
      const url = new URL(backendApiUrl('/api/auth/status'));
      url.port = String(port);
      const token = port === getBackendPort() ? getToken() : null;
      try {
        const response = await fetch(url.toString(), {
          signal: controller.signal,
          cache: 'no-store',
          headers: token === null ? {} : { 'X-Veto-Session-Token': token },
        });
        if (!response.ok) throw new Error('Backend unavailable');
        const data = await response.json();
        if (typeof data?.setupNeeded !== 'boolean' || typeof data?.authenticated !== 'boolean') {
          throw new Error('Not a Veto backend');
        }
        if (cancelled || controller.signal.aborted || epoch !== authEpoch.current) return;
        setBackendPort(port);
        setConnection('online');
        if (token !== null && data.authenticated) {
          setUsername(data.username ?? data.currentUser ?? null);
          setStatus('signedIn');
        } else {
          if (token !== null) setToken(null);
          setStatus(data.setupNeeded ? 'setup' : 'signedOut');
        }
      } catch {
        if (cancelled || epoch !== authEpoch.current) return;
        setConnection('offline');
        setStatus('signedOut');
      } finally {
        clearTimeout(timeout);
        active = null;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      active?.abort();
    };
  }, [portInput, signedIn]);

  useEffect(() => {
    onUnauthorized(() => {
      authEpoch.current += 1;
      setUsername(null);
      setRole(null);
      setStatus('signedOut');
      setAuthError(tRef.current('error.backendRestarted'));
    });
    return () => onUnauthorized(null);
  }, []);

  const signIn = useCallback(async (user: string, password: string): Promise<boolean> => {
    if (connection !== 'online') return false;
    const epoch = ++authEpoch.current;
    setAuthError(null);
    try {
      const response = await login({ username: user, password });
      if (epoch !== authEpoch.current) return false;
      authEpoch.current += 1;
      setToken(response.token);
      setUsername(response.username);
      setRole(response.role);
      setStatus('signedIn');
      return true;
    } catch (error) {
      if (epoch !== authEpoch.current) return false;
      setAuthError(
        error instanceof ApiError
          ? error.message
          : tRef.current('error.backendUnreachable', { port: getBackendPort() }),
      );
      return false;
    }
  }, [connection]);

  const firstRunSetup = useCallback(async (user: string, password: string): Promise<boolean> => {
    if (connection !== 'online') return false;
    const epoch = ++authEpoch.current;
    setAuthError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setAuthError(tRef.current('error.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return false;
    }
    try {
      const response = await setup({ username: user, password });
      if (epoch !== authEpoch.current) return false;
      authEpoch.current += 1;
      setToken(response.token);
      setUsername(response.username);
      setRole(response.role);
      setStatus('signedIn');
      return true;
    } catch (error) {
      if (epoch !== authEpoch.current) return false;
      setAuthError(
        error instanceof ApiError
          ? error.message
          : tRef.current('error.backendUnreachable', { port: getBackendPort() }),
      );
      return false;
    }
  }, [connection]);

  const signOut = useCallback((): void => {
    authEpoch.current += 1;
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
    () => ({ status, connection, portInput, changePort, username, role, authError, signIn, firstRunSetup, signOut }),
    [status, connection, portInput, changePort, username, role, authError, signIn, firstRunSetup, signOut],
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
