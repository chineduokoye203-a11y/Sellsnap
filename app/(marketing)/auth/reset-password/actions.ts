'use server'

import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limiter';

export interface ResetPasswordState {
  error?: string;
}

export async function resetPassword(prevState: ResetPasswordState | null, formData: FormData): Promise<ResetPasswordState> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const rl = rateLimit(`reset-password:${ip}`, 3, 60_000);
  if (!rl.ok) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const token = formData.get('token') as string;
  const password = formData.get('password') as string;

  if (!token || !password) {
    return { error: 'Missing required fields' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }

  try {
    const user = await db.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return { error: 'Invalid or expired reset token' };
    }

    const passwordHash = await bcrypt.hash(password, 14);

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        passwordChangedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    });

    await createSession(updatedUser.id, updatedUser.sessionVersion);
  } catch (error) {
    console.error('Reset password error:', error);
    return { error: 'Something went wrong' };
  }

  redirect('/dashboard');
}
