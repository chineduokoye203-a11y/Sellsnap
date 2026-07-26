import { NextRequest } from 'next/server';

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each instance tracks a separate concern (e.g. order creation vs login).
 * In production, swap the Map for a Redis-backed store so rate limits
 * survive restarts and work across multiple server instances.
 *
 * The limiter keys on IP address by default.
 */

type RateLimitEntry = {
  timestamps: number[];
};

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;

    // Periodically purge expired entries to prevent memory leaks
    const cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.windowMs * 2);

    // Allow the Node process to exit even if the interval is running
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  /**
   * Check whether a request should be allowed.
   * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`.
   */
  check(key: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    // Drop timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    entry.timestamps.push(now);
    return { allowed: true };
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, entry] of this.store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Extract a rate-limit key from a request.
 * Uses X-Forwarded-For (for proxied deployments) or falls back to
 * the request URL host. This is best-effort; a production deployment
 * behind a trusted reverse proxy should configure the header correctly.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For can be a comma-separated list; take the first (client) IP
    return forwarded.split(',')[0].trim();
  }
  // Fallback — in development this will be ::1 or 127.0.0.1
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// ── Pre-configured limiters for each concern ────────────────────────

/** Order creation: 10 requests per minute per IP */
export const orderCreationLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
});

/** Payment verification: 5 requests per minute per IP */
export const paymentVerifyLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

/** Order status polling: 30 requests per minute per IP (more lenient, it's just a read) */
export const orderStatusLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
});

/** Login: 5 attempts per minute per IP */
export const loginLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60_000,
});

/** Signup: 3 attempts per minute per IP */
export const signupLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 60_000,
});

/** Password reset request: 3 per minute per IP */
export const passwordResetLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 60_000,
});
