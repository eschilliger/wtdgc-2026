import { LogoutButton } from "../../components/auth/LogoutButton";
import styles from "../../components/auth/Auth.module.css";
import { requireRole } from "../../server/auth/session";

export default async function PlayerAreaPage() {
  const claims = await requireRole("player");
  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}>
          <div>
            <h1>Espace Joueur</h1>
            <p>{claims.email ?? "Compte joueur"}</p>
          </div>
          <LogoutButton />
        </header>
        <section className={styles.placeholder}>
          <strong>Accès joueur validé.</strong>
          <p>Les rounds resteront invisibles ici tant qu’ils ne seront pas publiés par le staff. Les notes internes ne seront jamais exposées dans cet espace.</p>
        </section>
      </div>
    </main>
  );
}
