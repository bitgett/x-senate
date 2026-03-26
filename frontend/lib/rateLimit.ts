/**
 * Simple in-memory rate limiter for serverless API routes.
 * Uses IP + route as the key. Resets per cold-start (acceptable for hackathon scale).
 * For production, replace with Redis/Upstash.
 */

const store = new Map<string, number[]>();

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param key   Unique identifier (e.g. IP + route)
 * @param limit Max requests allowed in the window
 * @param windowMs Rolling window in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) ?? []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

/**
 * Extract client IP from Next.js request headers.
 * Falls back to "unknown" if no IP header is present.
 */
export function getClientIp(req: Request): string {
  const headers = (req as any).headers;
  return (
    headers.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get?.("x-real-ip") ??
    "unknown"
  );
}
