'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Spinner } from '@phosphor-icons/react';
import styles from '../page.module.css';

interface OrderStatus {
  status: string;
  productName: string;
  amountNaira: number;
  paidAt: string | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');
  const [data, setData] = useState<OrderStatus | null>(null);
  const [error, setError] = useState('');
  const attemptsRef = useRef(0);
  const [verified, setVerified] = useState(false);

  const verifyPayment = useCallback(async () => {
    if (!txRef || !transactionId || verified) return;
    setVerified(true);
    try {
      await fetch('/api/orders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: transactionId, tx_ref: txRef }),
      });
    } catch {
      // fallback to polling
    }
  }, [txRef, transactionId, verified]);

  const checkStatus = useCallback(async () => {
    if (!txRef) {
      setError('No transaction reference found');
      return;
    }
    try {
      const res = await fetch(`/api/orders/status?tx_ref=${encodeURIComponent(txRef)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
        setError('');
        attemptsRef.current = 0;
        if (json.data.status === 'paid') {
          return;
        }
      } else {
        attemptsRef.current++;
        if (attemptsRef.current >= 6) {
          setError(json.error || 'Could not verify payment');
        }
      }
    } catch {
      attemptsRef.current++;
      if (attemptsRef.current >= 6) {
        setError('Network error checking payment status');
      }
    }
  }, [txRef]);

  useEffect(() => {
    verifyPayment();
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus, verifyPayment]);

  if (!txRef) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.statusCard}>
            <XCircle size={48} className={styles.iconError} />
            <h1 className={styles.statusTitle}>Invalid Link</h1>
            <p className={styles.statusText}>No transaction reference was provided.</p>
          </div>
        </div>
      </div>
    );
  }

  if (data?.status === 'paid') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.statusCard}>
            <CheckCircle size={64} className={styles.iconSuccess} />
            <h1 className={styles.statusTitle}>Payment Successful</h1>
            <p className={styles.statusText}>
              Your payment for <strong>{data.productName}</strong> has been received. The seller has been notified and will contact you shortly.
            </p>
            <div className={styles.statusDetails}>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Amount Paid</span>
                <span className={styles.statusValue}>₦{data.amountNaira.toLocaleString()}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Transaction Reference</span>
                <span className={styles.statusValue} style={{ fontSize: '13px' }}>sellsnap_order_{txRef.replace('sellsnap_order_', '').replace(/-/g, '').slice(0, 10)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.statusCard}>
          <Spinner size={48} className={styles.iconPending} />
          <h1 className={styles.statusTitle}>
            {error ? 'Verifying Payment...' : 'Checking Payment Status...'}
          </h1>
          <p className={styles.statusText}>
            {error
              ? 'We are still confirming your payment. This page will update automatically.'
              : 'We are confirming your transaction. Please wait...'}
          </p>
          <p className={styles.statusRef}>Reference: {txRef}</p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.statusCard}>
            <Spinner size={48} className={styles.iconPending} />
            <h1 className={styles.statusTitle}>Loading...</h1>
          </div>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
