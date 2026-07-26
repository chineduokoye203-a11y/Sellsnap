'use client';

import { useState, FormEvent, useEffect, useActionState, startTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signup } from './signup-actions';
import { login } from './login-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './page.module.css';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    password: '',
  });
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step2Submitted, setStep2Submitted] = useState(false);

  const [signupState, signupAction, signupPending] = useActionState(signup, null);
  const [loginState, loginAction, loginPending] = useActionState(login, null);
  const [loginErrorDismissed, setLoginErrorDismissed] = useState(false);

  useEffect(() => {
    if (loginState?.error) {
      setLoginErrorDismissed(false);
    }
    if (loginState?.success) {
      router.push('/dashboard');
    }
    if (signupState?.success) {
      router.push('/onboarding');
    }
  }, [loginState, signupState, router]);

const validatePassword = (password: string): string[] => {
  const missing: string[] = [];
  if (password.length < 8) missing.push('Minimum of 8 characters');
  if (!/[A-Z]/.test(password)) missing.push('Must contain an uppercase letter');
  if (!/[a-z]/.test(password)) missing.push('Must contain a lowercase letter');
  if (!/[0-9]/.test(password)) missing.push('Must contain a number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) missing.push('Must contain a special character');
  return missing;
};

const handleNextStep = (e: FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'field cannot be empty';
    if (!formData.email.trim()) newErrors.email = 'field cannot be empty';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFormError('fields cannot be empty');
      return;
    }

    setErrors({});
    setFormError('');
    setStep2Submitted(false);
    setStep(2);
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));

    const next = { ...errors };

    if (name === 'name' && value.length > 0 && value.length < 2) {
      next.name = 'name must be at least 2 characters';
    } else if (name === 'email' && value.length > 0 && !(value.includes('@') && value.split('@')[1].trim().length > 0)) {
      next.email = 'Enter A Valid Email Address';
    } else if (next[name]) {
      delete next[name];
    }

    setErrors(next);
    if (Object.keys(next).length === 0) setFormError('');

    if (step === 2) setStep2Submitted(false);
  };

  const handleBlur = (name: string) => {
    if ((name === 'name' || name === 'businessName') && !formData[name].trim()) {
      setErrors(prev => ({ ...prev, [name]: 'This field cannot be empty' }));
    }
  };

  const handlePrevStep = () => {
    setStep(1);
    setStep2Submitted(false);
    setFormData(prev => ({ ...prev, businessName: '', password: '' }));
  };

  const handleLoginFocus = () => {
    setLoginErrorDismissed(true);
  };

  const handleLogin = (e: FormEvent<HTMLFormElement>) => {
    if (!formData.email.trim() || !formData.password.trim()) {
      e.preventDefault();
      const next: Record<string, string> = {};
      if (!formData.email.trim()) next.email = 'Field cannot be empty';
      if (!formData.password.trim()) next.password = 'Field cannot be empty';
      setErrors(prev => ({ ...prev, ...next }));
    }
  };

  const handleCreateAccount = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!formData.businessName.trim()) next.businessName = 'Field cannot be empty';
    if (!formData.password.trim()) next.password = 'Field cannot be empty';
    if (Object.keys(next).length > 0) {
      setErrors(prev => ({ ...prev, ...next }));
      return;
    }
    setStep2Submitted(true);
    const fd = new FormData();
    fd.set('name', formData.name);
    fd.set('email', formData.email);
    fd.set('businessName', formData.businessName);
    fd.set('password', formData.password);
    startTransition(() => signupAction(fd));
  };

  return (
    <div className={styles.container}>
      {loginState?.error && !loginErrorDismissed && (
        <div className={styles.loginError}>{loginState.error}</div>
      )}
      <Link href="/" className={styles.logo}>SellSnap</Link>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {isLogin ? 'Sign in to your account' : 'Create your account'}
        </h1>

        {isLogin ? (
          <form action={loginAction} onSubmit={handleLogin} onFocus={handleLoginFocus} className={styles.form} noValidate>
            <Input 
              name="email" 
              type="email" 
              label="Email Address" 
              required 
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
            />

            <Input 
              name="password" 
              type="password" 
              label="Password" 
              required 
              showPasswordToggle
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              labelEnd={<Link href="/auth/forgot-password" className={styles.forgotLink}>Forgot password?</Link>}
            />
            
            <Button type="submit" disabled={loginPending}>
              {loginPending ? 'Loading...' : 'Sign in'}
            </Button>
          </form>
        ) : step === 1 ? (
          <form onSubmit={handleNextStep} className={`${styles.form} ${styles.formStep1}`} noValidate>
            <Input 
              name="name" 
              type="text" 
              label="Enter Full Name" 
              required 
              autoFocus
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              error={errors.name}
              hasValue={!!formData.name}
            />
            <Input 
              name="email" 
              type="email" 
              label="Enter Email" 
              required 
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
              hasValue={!!formData.email}
            />
            
            <Button type="submit" style={{ gap: 8 }}>
              Continue
              <svg className={styles.arrowIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/>
                <path d="m12 5 7 7-7 7"/>
              </svg>
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCreateAccount} className={styles.form} noValidate>
            <input type="hidden" name="name" value={formData.name} />
            <input type="hidden" name="email" value={formData.email} />
            
            <Input 
              name="businessName" 
              type="text" 
              label="Business Name" 
              required 
              autoComplete="off"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              onBlur={() => handleBlur('businessName')}
              error={errors.businessName}
              hasValue={!!formData.businessName}
            />
            <Input 
              name="password" 
              type="password" 
              label="Password" 
              required 
              showPasswordToggle
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              error={errors.password}
              hasValue={!!formData.password}
            />
            
            {(() => {
              const requirements = [
                { key: 'upper', label: 'Must contain an uppercase letter', check: (p: string) => /[A-Z]/.test(p) },
                { key: 'lower', label: 'Must contain a lowercase letter', check: (p: string) => /[a-z]/.test(p) },
                { key: 'number', label: 'Must contain a number', check: (p: string) => /[0-9]/.test(p) },
                { key: 'special', label: 'Must contain a special character', check: (p: string) => /[!@#$%^&*()_+\-=\[\]{}';":\\|,.<>\/?]/.test(p) },
                { key: 'length', label: 'Minimum of 8 characters', check: (p: string) => p.length >= 8 },
              ];
              const next = requirements.find(r => !r.check(formData.password));
              if (!formData.password || !next) return null;
              return (
                <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0 0' }}>
                  <li style={{
                    fontFamily: 'var(--typography-label-small-font-family, monospace)',
                    fontSize: 'var(--typography-label-small-font-size, 12px)',
                    color: 'var(--color-error)',
                    marginBottom: 2,
                  }}>
                    {next.label}
                  </li>
                </ul>
              );
            })()}
            
            {signupState?.error && step2Submitted && (
              <div className={styles.error}>{signupState.error}</div>
            )}

            {signupState?.errors && step2Submitted && Object.values(signupState.errors).map((err, i) => (
              <div key={i} className={styles.error}>{err}</div>
            ))}
            
            <div className={styles.buttonGroup}>
              <Button type="submit" disabled={signupPending} className={styles.createAccountBtn}>
                {signupPending ? 'Loading...' : 'Create Account'}
              </Button>

              <button type="button" onClick={handlePrevStep} className={styles.backButton}>
                Back
              </button>
            </div>
          </form>
        )}

        <p className={styles.footer}>
          {isLogin ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => { setIsLogin(false); setStep(1); setFormData({ name: '', email: '', businessName: '', password: '' }); setFormError(''); setErrors({}); }} className={styles.toggleButton}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => { setIsLogin(true); setErrors({}); setFormError(''); }} className={styles.toggleButton}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
