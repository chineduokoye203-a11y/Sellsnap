'use client';

import { useState, useRef, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/lib/actions/logout';
import styles from './UserMenu.module.css';

export function UserMenu({
  name,
  businessName,
}: {
  name: string;
  businessName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label="User menu"
      >
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.info}>
          <span className={styles.business}>{businessName}</span>
          <span className={styles.userName}>{name}</span>
        </div>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <form action={logout}>
            <button type="submit" className={styles.logoutButton}>
              <LogOut size={16} />
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
