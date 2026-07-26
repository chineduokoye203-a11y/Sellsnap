'use server'

import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { sendWelcomeEmail } from '@/lib/email';

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  businessName: z.string().min(1, "Business name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface SignupState {
  error?: string;
  errors?: Record<string, string>;
  success?: boolean;
}

export async function signup(prevState: SignupState | null, formData: FormData): Promise<SignupState> {
  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    businessName: formData.get('businessName') as string,
    password: formData.get('password') as string,
  };

  const result = signupSchema.safeParse(data);

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path[0] as string;
      if (!errors[path]) {
        errors[path] = issue.message;
      }
    }
    return { errors };
  }

  try {
    const existingUser = await db.user.findUnique({
      where: { email: result.data.email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await bcrypt.hash(result.data.password, 14);

    const user = await db.user.create({
      data: {
        email: result.data.email,
        name: result.data.name,
        businessName: result.data.businessName,
        passwordHash,
      }
    });

    logger.info(`User created, ID: ${user.id}`);
    await createSession(user.id);
    logger.info(`Session created for user ID: ${user.id}`);

    sendWelcomeEmail(user.email, user.name ?? 'there')
      .catch(e => logger.error('Failed to send welcome email', { error: e }));
  } catch (error) {
    logger.error("SIGNUP_ACTION_ERROR", { error });
    return { error: "Something went wrong during signup" };
  }

  return { success: true };
}
