"use client";

import { useState } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import styles from "./page.module.css";

declare global {
  interface Window {
    FlutterwaveCheckout: (config: {
      public_key: string;
      tx_ref: string;
      amount: number;
      currency: string;
      redirect_url: string;
      customer: { email: string; name: string };
      customizations: { title: string; description: string };
      callback?: (response: { status: string; transaction_id: number; tx_ref: string }) => void;
      onclose?: () => void;
    }) => void;
  }
}

interface ProductCheckoutFormProps {
  productId: string;
}

const FW_PUBLIC_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY || '';

export function ProductCheckoutForm({ productId }: ProductCheckoutFormProps) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });

      const data = await res.json();
      if (data.ok && data.url) {
        loadFlutterwaveCheckout(data);
      } else {
        setError(data.error || "Failed to initiate payment");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  function loadFlutterwaveCheckout(data: {
    url: string;
    tx_ref: string;
    verifyToken: string;
    amount: number;
    customer: { email: string; name: string };
    redirect_url: string;
    customizations: { title: string; description: string };
  }) {
    if (typeof window.FlutterwaveCheckout === "function") {
      openModal(data);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.onload = () => {
      setLoading(false);
      openModal(data);
    };
    script.onerror = () => {
      window.location.href = data.url;
    };
    document.body.appendChild(script);
  }

  function openModal(data: {
    tx_ref: string;
    verifyToken: string;
    amount: number;
    customer: { email: string; name: string };
    redirect_url: string;
    customizations: { title: string; description: string };
  }) {
    window.FlutterwaveCheckout({
      public_key: FW_PUBLIC_KEY,
      tx_ref: data.tx_ref,
      amount: data.amount,
      currency: "NGN",
      redirect_url: data.redirect_url,
      customer: data.customer,
      customizations: data.customizations,
      callback: async (response) => {
        if (response.status === "success") {
          await fetch("/api/orders/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transaction_id: response.transaction_id,
              tx_ref: response.tx_ref,
              verifyToken: data.verifyToken,
            }),
          });
          window.location.href = data.redirect_url;
        }
      },
      onclose: () => {
        setLoading(false);
      },
    });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input type="hidden" name="productId" value={productId} />
      <Input 
        name="email" 
        type="email" 
        label="Your Email" 
        required 
        placeholder="For your receipt"
      />
      <Input 
        name="name" 
        type="text" 
        label="Your Name" 
        required 
        placeholder="Enter your name here"
      />
      {error && <div className={styles.error}>{error}</div>}
      <Button type="submit" className={styles.payButton} disabled={loading}>
        {loading ? "Processing..." : "Pay Now"}
      </Button>
      <div className={styles.secureBadge}>
        <ShieldCheck size={14} weight="fill" />
        Secured by Flutterwave
      </div>
    </form>
  );
}
