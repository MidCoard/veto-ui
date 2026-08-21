import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKEND_PORT_KEY,
  DEFAULT_BACKEND_PORT,
  backendApiUrl,
  backendWebSocketHost,
  getBackendPort,
  isValidBackendPort,
  setBackendPort,
} from './backend';

describe('backend connection configuration', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the veto-core port and persists a valid override', () => {
    expect(getBackendPort()).toBe(DEFAULT_BACKEND_PORT);

    setBackendPort(9443);

    expect(localStorage.getItem(BACKEND_PORT_KEY)).toBe('9443');
    expect(getBackendPort()).toBe(9443);
  });

  it('ignores invalid persisted values', () => {
    localStorage.setItem(BACKEND_PORT_KEY, '70000');
    expect(getBackendPort()).toBe(DEFAULT_BACKEND_PORT);
  });

  it('accepts only integral TCP ports', () => {
    expect(isValidBackendPort(1)).toBe(true);
    expect(isValidBackendPort(65535)).toBe(true);
    expect(isValidBackendPort(0)).toBe(false);
    expect(isValidBackendPort(65536)).toBe(false);
    expect(isValidBackendPort(8443.5)).toBe(false);
  });

  it('builds REST and WebSocket targets from the selected port', () => {
    setBackendPort(9443);

    expect(backendApiUrl('/api/auth/status', 'localhost', false))
      .toBe('http://localhost:9443/api/auth/status');
    expect(backendWebSocketHost('veto.local')).toBe('veto.local:9443');
  });
});
