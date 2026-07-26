import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import styles from './layout.module.css';
import { SidebarLink } from '@/components/SidebarLink';
import { UserMenu } from '@/components/UserMenu';
import { MobileSidebar } from '@/components/MobileSidebar';
import { LayoutDashboard, Package, ShoppingBag } from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) {
    redirect('/auth');
  }

  if (!user.onboardingComplete) {
    redirect('/onboarding');
  }

  return (
    <div className={styles.container}>
      <MobileSidebar name={user.name ?? ''} businessName={user.businessName ?? ''} />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarContent}>
          <div className={styles.logo}>SellSnap</div>
          <nav className={styles.nav}>
            <SidebarLink href="/dashboard" icon={<LayoutDashboard size={20} />}>Dashboard</SidebarLink>
            <SidebarLink href="/products" icon={<Package size={20} />}>Products</SidebarLink>
            <SidebarLink href="/orders" icon={<ShoppingBag size={20} />}>Orders</SidebarLink>
          </nav>
        </div>
        <div className={styles.userMenuWrapper}>
          <UserMenu name={user.name ?? ''} businessName={user.businessName ?? ''} />
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
