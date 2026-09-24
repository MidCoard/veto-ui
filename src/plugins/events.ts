type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const connectionListeners = new Set<Listener>();
let connected = false;
export const pluginConnected = () => connected;
export function observePluginConnection(listener: Listener) {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}
export function setPluginConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  connectionListeners.forEach(listener => { try { listener(); } catch { console.error("Plugin resource listener failed"); } });
}
export function publishPluginResource(session: string, resource: string) {
  listeners.get(JSON.stringify([session, resource]))?.forEach(listener => { try { listener(); } catch { console.error("Plugin resource listener failed"); } });
}
export function subscribePluginResource(session: string, resource: string, listener: Listener, signal: AbortSignal) {
  signal.throwIfAborted();
  const key = JSON.stringify([session, resource]);
  const group = listeners.get(key) ?? new Set<Listener>();
  listeners.set(key, group); group.add(listener);
  const dispose = () => {
    group.delete(listener);
    if (group.size === 0) listeners.delete(key);
    signal.removeEventListener('abort', dispose);
  };
  signal.addEventListener('abort', dispose, { once: true });
  return dispose;
}

/** Recover every subscribed plugin resource without feature-specific host state. */
export function recoverPluginResources() {
  listeners.forEach((group, key) => {
    if (JSON.parse(key)[1] === 'plugin-frontend') return;
    group.forEach(listener => { try { listener(); } catch { console.error('Plugin resource listener failed'); } });
  });
}
