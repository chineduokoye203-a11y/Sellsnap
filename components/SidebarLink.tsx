'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '@/app/(dashboard)/layout.module.css';

export function SidebarLink({ href, icon, children }: { href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>
      {icon && <span className={styles.navIcon}>{icon}</span>}
      {children}
    </Link>
  );
}