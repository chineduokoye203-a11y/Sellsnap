'use client'

import { useState } from 'react';
import { completeOnboarding } from './actions';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

const options = [
  { id: 'digital', label: 'Digital Products', desc: 'E-books, courses, templates, software', icon: '💻' },
  { id: 'physical', label: 'Physical Products', desc: 'Clothing, accessories, home goods', icon: '📦' },
  { id: 'services', label: 'Services', desc: 'Consulting, coaching, freelance work', icon: '✨' },
  { id: 'multiple', label: 'Multiple Categories', desc: 'A mix of everything', icon: '🎯' },
];

const steps = [
  {
    title: 'Welcome to SellSnap!',
    description: 'You\'ve taken the first step toward selling online with ease. We\'ll help you get your store set up in no time.',
  },
  {
    title: 'What do you sell?',
    description: 'Pick the category that best describes your products. This helps us tailor your experience.',
  },
  {
    title: 'You are now a SellSnaper!',
    description: 'Your store is ready to go. Start creating products and accepting payments instantly.',
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.steps}>
          {steps.map((_, i) => (
            <div
              key={i}
              className={`${styles.stepDot} ${i === step ? styles.stepDotActive : ''} ${i < step ? styles.stepDotCompleted : ''}`}
            />
          ))}
        </div>

        <div className={styles.content}>
          {step === 0 && (
            <>
              <div className={styles.icon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h1 className={styles.title}>{steps[0].title}</h1>
              <p className={styles.description}>{steps[0].description}</p>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className={styles.title}>{steps[1].title}</h1>
              <p className={styles.description}>{steps[1].description}</p>
              <div className={styles.options}>
                {options.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`${styles.option} ${selected === opt.id ? styles.optionSelected : ''}`}
                    onClick={() => setSelected(opt.id)}
                  >
                    <div className={`${styles.optionIcon} ${selected === opt.id ? styles.optionIconSelected : styles.optionIconDefault}`}>
                      {opt.icon}
                    </div>
                    <div>
                      <div className={styles.optionLabel}>{opt.label}</div>
                      <div className={styles.optionDesc}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.icon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 className={styles.title}>{steps[2].title}</h1>
              <p className={styles.description}>{steps[2].description}</p>
              <ul className={styles.checklist}>
                <li>
                  <span className={styles.checkIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  Create your first product
                </li>
                <li>
                  <span className={styles.checkIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  Share your payment link
                </li>
                <li>
                  <span className={styles.checkIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  Start accepting payments
                </li>
              </ul>
            </>
          )}

          {step === 2 && (
            <form action={completeOnboarding} className={styles.actions}>
              <Button type="submit">
                Go to Dashboard
              </Button>
            </form>
          )}

          {step < 2 && (
            <div className={styles.actions}>
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !selected}
                className={styles.continueBtn}
              >
                {step === 0 ? 'Get Started' : 'Continue'}
              </Button>
              {step === 1 && (
                <div className={styles.navRow}>
                  <button
                    type="button"
                    className={styles.backLink}
                    onClick={() => setStep(0)}
                  >
                    Back
                  </button>
                  <form action={completeOnboarding}>
                    <button type="submit" className={styles.skipLink}>
                      Skip
                    </button>
                  </form>
                </div>
              )}
              {step === 0 && (
                <form action={completeOnboarding} className={styles.skipForm}>
                  <button type="submit" className={styles.skipLink}>
                    Skip Onboarding
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
