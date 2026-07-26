import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ShoppingBag } from 'lucide-react';
import styles from './page.module.css';

export default async function OrdersPage() {
  const user = await getSession();
  
  if (!user) return null;

  const orders = await db.order.findMany({
    where: { product: { userId: user.id } },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Your Orders</h1>
      
      {orders.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingBag size={40} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>You haven't received any orders yet.</h3>
          <p className={styles.emptyDesc}>Share your product link to start receiving orders</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Buyer Name</th>
                <th>Buyer Email</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.product.name}</td>
                  <td>{order.buyerName || '—'}</td>
                  <td>{order.buyerEmail}</td>
                  <td>₦{(Number(order.amountKobo) / 100).toLocaleString()}</td>
                  <td>
                    <span className={`${styles.status} ${styles[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
