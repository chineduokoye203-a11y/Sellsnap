import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_SECRET_HASH: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1).optional(),
  FROM_EMAIL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

function getEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
}

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_target, prop) {
    const data = getEnv();
    return (data as Record<string, unknown>)[prop as string];
  },
});
