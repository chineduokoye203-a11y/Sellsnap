import NewProductForm from "./NewProductForm";
import styles from "./page.module.css";

export default function NewProductPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Create New Product</h1>
      </div>

      <div>
        <NewProductForm />
      </div>
    </div>
  );
}
