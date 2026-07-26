'use client';

import React, { useState } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';
import { resetPassword } from '../actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from '../../page.module.css';

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const [password, setPassword] = useState('');
  const [state, action, pending] = useActionState(resetPassword, null);
  const token = React.use(params).token;

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.logo}>SellSnap</Link>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.subtitle}>Enter your new password below</p>

        <form action={action} className={styles.form}>
          <input type="hidden" name="token" value={token} />

          <Input
            name="password"
            type="password"
            label="New Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {state?.error && (
            <div className={styles.error}>{state.error}</div>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? 'Resetting...' : 'Reset password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
