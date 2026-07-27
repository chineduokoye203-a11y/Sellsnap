import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Package } from 'lucide-react';
import styles from './page.module.css';

export default async function DashboardPage() {
  const user = await getSession();

  if (!user) {
    redirect('/auth');
  }

  // Fetch stats
  const products = await db.product.findMany({
    where: { userId: user.id },
    include: {
      orders: {
        where: { status: 'paid' }
      }
    }
  });

  const activeProducts = products.filter((p: typeof products[number]) => p.isActive).length;
  const inactiveProducts = products.length - activeProducts;
  
  let totalRevenueKobo = 0;
  let totalOrders = 0;

  let allOrders: Array<{
    id: string;
    amountKobo: number;
    buyerEmail: string;
    createdAt: Date;
    productName: string;
  }> = [];

  products.forEach((product: typeof products[number]) => {
    product.orders.forEach((order: typeof product.orders[number]) => {
      totalRevenueKobo += order.amountKobo;
      totalOrders += 1;
      allOrders.push({
        id: order.id,
        amountKobo: order.amountKobo,
        buyerEmail: order.buyerEmail,
        createdAt: order.createdAt,
        productName: product.name,
      });
    });
  });

  const recentOrders = allOrders
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  const totalRevenue = totalRevenueKobo / 100;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back, {user.name}</p>
        </div>
        <Link href="/products/new">
          <Button>Create Product</Button>
        </Link>
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Revenue</span>
          <span className={styles.statValue}>₦{totalRevenue.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Orders</span>
          <span className={styles.statValue}>{totalOrders}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Products</span>
          <span className={styles.statValue}>{activeProducts}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Inactive Products</span>
          <span className={styles.statValue}>{inactiveProducts}</span>
        </div>
      </div>

      <div className={styles.recentOrders}>
        <h2 className={styles.recentOrdersTitle}>Recent Orders</h2>
        {recentOrders.length > 0 ? (
          <div className={styles.orderList}>
            {recentOrders.map(order => (
              <div key={order.id} className={styles.orderItem}>
                <div>
                  <div className={styles.orderProduct}>{order.productName}</div>
                  <div className={styles.orderCustomer}>{order.buyerEmail}</div>
                </div>
                <div className={styles.orderAmount}>
                  ₦{(order.amountKobo / 100).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Package size={40} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No orders yet</h3>
            <p className={styles.emptyDesc}>Share your products to start receiving orders</p>
          </div>
        )}
      </div>
    </div>
  );
}
