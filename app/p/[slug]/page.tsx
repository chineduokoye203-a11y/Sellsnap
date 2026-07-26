import { db } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ProductCheckoutForm } from './ProductCheckoutForm';
import styles from './page.module.css';

export default async function ProductCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { uniqueSlug: slug },
    include: { user: true }
  });

  if (!product || !product.isActive) {
    notFound();
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.left}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className={styles.image} />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
        </div>
        <div className={styles.right}>
          <div className={styles.sellerInfo}>
            Sold by <strong>{product.user.businessName}</strong>
          </div>
          <h1 className={styles.title}>{product.name}</h1>
          <p className={styles.price}>₦{(Number(product.priceKobo) / 100).toLocaleString()}</p>

          <div className={styles.divider} />

          <div className={styles.descSection}>
            <h2 className={styles.descLabel}>Description</h2>
            <p className={styles.descText}>{product.description || 'No description provided.'}</p>
          </div>

          <ProductCheckoutForm productId={product.id} />
        </div>
      </div>
    </div>
  );
}
