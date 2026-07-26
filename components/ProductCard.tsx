'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { WhatsappLogo } from '@phosphor-icons/react';
import { toggleProductActive, deleteProduct } from '@/lib/actions/products';
import Image from 'next/image';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  id: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
  uniqueSlug: string;
  isActive: boolean;
  createdAt: Date;
  description: string | null;
}

export function ProductCard(product: ProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProductUrl(`${window.location.origin}/p/${product.uniqueSlug}`);
  }, [product.uniqueSlug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(`Check out this product: ${product.name} - ${productUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  }

  async function handleToggleActive() {
    await toggleProductActive(product.id);
    setMenuOpen(false);
  }

  async function handleDelete() {
    if (!window.confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    setDeleting(true);
    await deleteProduct(product.id);
  }

  const shareIcon = <WhatsappLogo size={16} />;

  return (
    <div className={`${styles.card} ${!product.isActive ? styles.inactive : ''}`}>
      <div className={styles.imageWrapper}>
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className={styles.image} sizes="(max-width: 768px) 100vw, 300px" />
        ) : (
          <div className={styles.placeholder} />
        )}
        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            className={styles.menuTrigger}
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
            aria-label="Product menu"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropdownItem} type="button">
                Edit
              </button>
              <button className={styles.dropdownItem} type="button" onClick={handleToggleActive}>
                {product.isActive ? 'Make Inactive' : 'Make Active'}
              </button>
              <button className={`${styles.dropdownItem} ${styles.danger}`} type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
        {!product.isActive && (
          <span className={styles.badge}>Inactive</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{product.name}</h3>
          <span className={styles.price}>₦{(product.priceKobo / 100).toLocaleString()}</span>
        </div>
        <p className={styles.date}>Added {new Date(product.createdAt).toLocaleDateString()} at {new Date(product.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>

        <div className={styles.actions}>
          <button className={styles.copyBtn} onClick={handleCopy} type="button">
            {copied ? 'Copied' : 'Copy Link'}
          </button>
          <button className={styles.whatsappBtn} onClick={handleWhatsApp} type="button">
            {shareIcon}
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
