'use server'

import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export interface LoginState {
  error?: string;
  success?: boolean;
}

export async function login(prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: "Missing email or password" };
  }

  try {
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: "Invalid email or password" };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { error: "Invalid email or password" };
    }

    await createSession(user.id);
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Something went wrong" };
  }

  return { success: true };
}
