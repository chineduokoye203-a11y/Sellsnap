import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';

const COOKIE_NAME = 'sellsnap_session';

function signToken(payload: string): string {
  const hmac = createHmac('sha256', env.SESSION_SECRET);
  hmac.update(payload);
  return `${payload}.${hmac.digest('hex')}`;
}

function verifyToken(token: string): string | null {
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return null;

  const payload = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  if (!payload || !signature) return null;

  const expectedSignature = createHmac('sha256', env.SESSION_SECRET)
    .update(payload)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'utf-8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a signed session cookie embedding userId and sessionVersion.
 * The sessionVersion allows mass-invalidation of sessions when the
 * user resets their password (version is incremented).
 */
export async function createSession(userId: string, sessionVersion: number = 0) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const token = randomBytes(32).toString('hex');
  const sessionToken = signToken(`${userId}:${sessionVersion}:${token}`);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;

  if (!sessionToken) return null;

  const verified = verifyToken(sessionToken);
  if (!verified) return null;

  // Cookie format: userId:sessionVersion:randomToken
  const parts = verified.split(':');
  const userId = parts[0];
  const cookieSessionVersion = parseInt(parts[1] || '0', 10);

  if (!userId) return null;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        onboardingComplete: true,
        sessionVersion: true,
      }
    });
    if (!user) return null;

    // If sessionVersion in DB is higher than the one baked into the
    // cookie, the password was reset after this session was created.
    if (user.sessionVersion > cookieSessionVersion) return null;

    return user;
  } catch {
    return null;
  }
}
