'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { requestReset } from './actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from '../page.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [state, action, pending] = useActionState(requestReset, null);

  if (state?.success) {
    return (
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>SellSnap</Link>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-on-surface-variant)', marginBottom: 24 }}>
            If an account exists with that email, we have sent a password reset link.
          </p>
          <Link href="/auth" className={styles.toggleButton} style={{ display: 'block', textAlign: 'center' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.logo}>SellSnap</Link>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.subtitle}>Enter your email and we will send you a reset link</p>

        <form action={action} className={styles.form}>
          <Input
            name="email"
            type="email"
            label="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {state?.error && (
            <div className={styles.error}>{state.error}</div>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <p className={styles.footer}>
          Remember your password?{' '}
          <Link href="/auth" className={styles.toggleButton}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
