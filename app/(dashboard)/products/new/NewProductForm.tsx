"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UploadCloud, X } from "lucide-react";
import Image from "next/image";
import styles from "./page.module.css";

export default function NewProductForm() {
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const next: Record<string, string> = {};
    if (!((fd.get("name") as string) || "").trim()) next.name = "This field cannot be empty";
    if (!((fd.get("description") as string) || "").trim()) next.description = "This field cannot be empty";
    if (!((fd.get("price") as string) || "").trim()) next.price = "This field cannot be empty";
    if (!preview) next.image = "Please upload a product image";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setServerError(null);
    setPending(true);

    try {
      const res = await fetch("/api/products/create", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (data.success) {
        router.push("/products");
      } else if (data.errors) {
        setErrors(data.errors);
      } else if (data.error) {
        setServerError(data.error);
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formGrid} noValidate>
      <div className={styles.leftColumn}>
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Basic Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              name="name"
              type="text"
              label="Product Name"
              required
              placeholder="E.g Black Hoodie"
              error={errors.name}
            />
            <Input
              name="description"
              type="text"
              label="Description"
              placeholder="Describe your product details, materials, size, etc"
              error={errors.description}
            />
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Pricing</h2>
          <Input
            name="price"
            type="number"
            label="Price (₦)"
            required
            min="100"
            placeholder="E.g 1500"
            error={errors.price}
          />
        </div>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>Product Image</h2>
          <label className={styles.uploadBox}>
            {preview ? (
              <>
                <Image src={preview} alt="Preview" width={0} height={0} className={styles.preview} />
                <button
                  type="button"
                  className={styles.removeImage}
                  onClick={() => {
                    setPreview(null);
                    const input = document.querySelector<HTMLInputElement>('input[name="image"]');
                    if (input) input.value = "";
                  }}
                >
                  <X size={16} />
                  Remove
                </button>
              </>
            ) : (
              <>
                <UploadCloud className={styles.uploadIcon} size={32} />
                <p className={styles.uploadText}>Click or drag file to upload</p>
                <p className={styles.uploadDesc}>Max size 5MB</p>
              </>
            )}
            <input
              type="file"
              name="image"
              accept="image/*"
              className={styles.uploadInput}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPreview(URL.createObjectURL(file));
                }
              }}
            />
          </label>
          {errors.image && (
            <span className={styles.fieldError}>{errors.image}</span>
          )}
        </div>
      </div>

      {serverError && (
        <div className={styles.error} style={{ gridColumn: '1 / -1' }}>{serverError}</div>
      )}

      <div className={styles.actions}>
        <Link href="/products">
          <button
            type="button"
            className={styles.backButton}
          >
            Back
          </button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
