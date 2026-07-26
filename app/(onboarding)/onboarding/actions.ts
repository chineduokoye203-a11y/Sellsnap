'use server'

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function completeOnboarding() {
  const user = await getSession();

  if (!user) {
    redirect('/auth');
  }

  await db.user.update({
    where: { id: user.id },
    data: { onboardingComplete: true },
  });

  // Bust the RSC cache so the dashboard layout re-fetches a fresh session
  // with onboardingComplete: true, preventing a stale-cache redirect loop.
  revalidatePath('/', 'layout');

  redirect('/dashboard');
}
