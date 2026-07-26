import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${className || ''}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <span className={styles.loader}>Loading...</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
