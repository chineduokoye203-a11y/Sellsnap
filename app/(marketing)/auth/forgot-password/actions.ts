'use server'

import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limiter';
import { sendPasswordResetEmail } from '@/lib/email';

export interface ForgotPasswordState {
  error?: string;
  success?: boolean;
}

export async function requestReset(prevState: ForgotPasswordState | null, formData: FormData): Promise<ForgotPasswordState> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rl = rateLimit(`forgot-password:${ip}`, 3, 60_000);
  if (!rl.ok) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email is required' };
  }

  try {
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      return { success: true };
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiresAt: expiresAt },
    });

    sendPasswordResetEmail(user.email, resetToken)
      .catch(e => console.error('Failed to send password reset email:', e));

    return { success: true };
  } catch (error) {
    console.error('Forgot password error:', error);
    return { error: 'Something went wrong' };
  }
}
