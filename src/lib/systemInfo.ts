import { getSystemInfo } from '../api/endpoints';
import type { SystemInfo } from '../api/types';

/**
 * App-level cache for GET /api/system/info: the server's OS never changes
 * while the UI runs, so the first successful fetch is reused. A failed fetch
 * is NOT cached — the next caller retries.
 */
let cached: Promise<SystemInfo> | null = null;

export function loadSystemInfo(): Promise<SystemInfo> {
  if (cached === null) {
    cached = getSystemInfo().catch((error: unknown) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}
