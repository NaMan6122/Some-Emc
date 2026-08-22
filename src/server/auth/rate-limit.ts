// In-memory login rate limiter (spec-003-v2): 5 failures per IP+email / 10 min.
// Acceptable v1 trade-off: resets on process restart; Redis deferred.

type Entry = { count: number; firstAt: number };
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

const store = new Map<string, Entry>();

function pruneExpired(now: number): void {
  for (const [k, e] of store) if (now - e.firstAt > WINDOW_MS) store.delete(k);
}

export function rateLimitKey(ip: string, email: string): string {
  return `${ip}::${email.trim().toLowerCase()}`;
}

export function checkRateLimit(key: string): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  pruneExpired(now);
  const e = store.get(key);
  if (!e || now - e.firstAt > WINDOW_MS) return { limited: false, retryAfterSeconds: 0 };
  if (e.count < MAX_FAILURES) return { limited: false, retryAfterSeconds: 0 };
  const elapsed = now - e.firstAt;
  return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - elapsed) / 1000)) };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now - e.firstAt > WINDOW_MS) store.set(key, { count: 1, firstAt: now });
  else e.count += 1;
}

export function clearFailures(key: string): void {
  store.delete(key);
}

export function _resetForTests(): void {
  store.clear();
}

export const _constants = { WINDOW_MS, MAX_FAILURES };
