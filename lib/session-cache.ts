// A short-lived, per-tab snapshot makes full-page navigation feel immediate.
// The server remains authoritative and every page revalidates after showing it.
export function readSessionCache<T>(key: string, maxAgeMs = 5 * 60_000): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as { savedAt: number; value: T };
    if (!entry.savedAt || Date.now() - entry.savedAt > maxAgeMs) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch { return null; }
}

export function writeSessionCache<T>(key: string, value: T) {
  try {
    const raw = JSON.stringify({ savedAt: Date.now(), value });
    if (raw.length < 4_000_000) sessionStorage.setItem(key, raw);
  } catch { /* Storage can be disabled or full; the normal request still works. */ }
}

export function clearSessionCache(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
}
