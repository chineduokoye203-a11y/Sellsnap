import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  // Not logged in — send to auth
  if (!user) {
    redirect('/auth');
  }

  // Already completed onboarding — send straight to dashboard
  if (user.onboardingComplete) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
