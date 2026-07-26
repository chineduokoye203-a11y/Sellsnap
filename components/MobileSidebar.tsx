'use client';

import { useState } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { LayoutDashboard, Package, ShoppingBag } from 'lucide-react';
import { logout } from '@/lib/actions/logout';
import styles from './MobileSidebar.module.css';

interface MobileSidebarProps {
  name: string;
  businessName: string;
}

export function MobileSidebar({ name, businessName }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const initials = (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className={styles.topBar}>
        <button
          className={styles.hamburger}
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        <div className={styles.avatarWrapper}>
          <button
            className={styles.mobileAvatar}
            onClick={() => setShowLogout((v) => !v)}
            aria-label="User menu"
          >
            {initials}
          </button>

          {showLogout && (
            <>
              <div className={styles.avatarOverlay} onClick={() => setShowLogout(false)} />
              <div className={styles.avatarDropdown}>
                <span className={styles.avatarName}>{name}</span>
                <form action={logout}>
                  <button type="submit" className={styles.logoutBtn}>
                    <LogOut size={16} />
                    Logout
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)} />
      )}

      <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <span className={styles.drawerLogo}>SellSnap</span>
          <button
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={24} />
          </button>
        </div>

        <nav className={styles.drawerNav}>
          <a href="/dashboard" className={styles.drawerLink}>
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <a href="/products" className={styles.drawerLink}>
            <Package size={20} />
            Products
          </a>
          <a href="/orders" className={styles.drawerLink}>
            <ShoppingBag size={20} />
            Orders
          </a>
        </nav>
      </div>
    </>
  );
}
