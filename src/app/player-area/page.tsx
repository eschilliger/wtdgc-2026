import styles from "../../components/auth/Auth.module.css";
import { requirePlayerAccess } from "../../server/auth/session";

export default async function PlayerAreaPage() {
  const claims = await requirePlayerAccess();
  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}>
          <div>
            <h1>Mes matchs</h1>
            <p>{claims.email ?? "Compte WTDGC"}</p>
          </div>
        </header>
        <section className={styles.placeholder}>
          <strong>Aucun match publié pour le moment.</strong>
          <p>Les prochains matchs apparaîtront ici dès qu’ils seront disponibles.</p>
        </section>
      </div>
    </main>
  );
}
