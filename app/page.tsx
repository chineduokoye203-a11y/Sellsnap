import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default async function Home() {
  const user = await getSession();

  return (
    <main className={styles.main}>
      <div className={styles.gradient} />
      
      <header className={styles.header}>
        <span className={styles.logo}>SellSnap</span>
      </header>

      <div className={styles.content}>
        <h1 className={styles.title}>
          Sell anything in seconds <br />
          using <span className={styles.accent}>just a link</span>
        </h1>
        
        <p className={styles.subtitle}>
          Sell instantly. Share anywhere
        </p>
        
        <div className={styles.cta}>
          <Link href="/auth" className={styles.link}>
            <Button className={styles.getStarted}>
              Get Started
            </Button>
          </Link>
        </div>
      </div>


    </main>
  );
}