import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hasError?: boolean;
  hasValue?: boolean;
  labelEnd?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hasError, hasValue, labelEnd, showPasswordToggle, ...props }, ref) => {
    const [passwordVisible, setPasswordVisible] = React.useState(false);
    const isPassword = props.type === 'password';

    return (
      <div className={`${styles.wrapper} ${className || ''}`}>
        {label && (
          <div className={styles.labelRow}>
            <label className={styles.label}>{label}</label>
            {labelEnd}
          </div>
        )}
        <div className={styles.inputWrap}>
          <input
            ref={ref}
            {...props}
            type={isPassword && showPasswordToggle && passwordVisible ? 'text' : props.type}
            className={`${styles.input} ${(error || hasError) ? styles.inputError : ''} ${hasValue ? styles.inputFilled : ''} ${isPassword && showPasswordToggle ? styles.inputWithToggle : ''}`}
          />
          {isPassword && showPasswordToggle && props.value && (
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setPasswordVisible(!passwordVisible)}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            >
              {passwordVisible ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              )}
            </button>
          )}
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
