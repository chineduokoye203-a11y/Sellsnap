import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Package } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import styles from './page.module.css';

export default async function ProductsPage() {
  const user = await getSession();

  if (!user) return null;

  const products = await db.product.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Products</h1>
      </div>

      {products.length === 0 ? (
        <div className={styles.empty}>
          <Package size={40} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>You haven't created any products yet.</h3>
          <Link href="/products/new">
            <Button>Create Product</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.header}>
            <h1 className={styles.title}>Your Products</h1>
            <Link href="/products/new">
              <Button>Create Product</Button>
            </Link>
          </div>
          <div className={styles.grid}>
          {products.map(product => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              priceKobo={product.priceKobo}
              imageUrl={product.imageUrl}
              uniqueSlug={product.uniqueSlug}
              isActive={product.isActive}
              createdAt={product.createdAt}
              description={product.description}
            />
          ))}
        </div>
        </>
      )}
    </div>
  );
}
