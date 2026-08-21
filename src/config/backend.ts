/** Runtime connection settings shared by REST and the WebSocket bus. */

export const DEFAULT_BACKEND_PORT = 8443;
export const BACKEND_PORT_KEY = 'veto.backend.port';

export function isValidBackendPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

export function getBackendPort(): number {
  const stored = Number(localStorage.getItem(BACKEND_PORT_KEY));
  return isValidBackendPort(stored) ? stored : DEFAULT_BACKEND_PORT;
}

export function setBackendPort(port: number): void {
  if (!isValidBackendPort(port)) {
    throw new RangeError('Backend port must be an integer from 1 to 65535');
  }
  localStorage.setItem(BACKEND_PORT_KEY, String(port));
}

export function backendApiUrl(
  path: string,
  hostname: string = window.location.hostname,
  secure: boolean = window.location.protocol === 'https:',
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${secure ? 'https' : 'http'}://${hostname}:${getBackendPort()}${normalizedPath}`;
}

export function backendWebSocketHost(hostname: string = window.location.hostname): string {
  return `${hostname}:${getBackendPort()}`;
}
