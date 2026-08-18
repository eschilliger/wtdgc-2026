import { LogoutButton } from "../../components/auth/LogoutButton";
import styles from "../../components/auth/Auth.module.css";
import { requireRole } from "../../server/auth/session";

export default async function StaffPage() {
  const claims = await requireRole("staff");
  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}>
          <div>
            <h1>Espace Staff</h1>
            <p>{claims.email ?? "Compte staff"}</p>
          </div>
          <LogoutButton />
        </header>
        <section className={styles.placeholder}>
          <strong>Accès staff validé.</strong>
          <p>Le prochain écran branchera ici la gestion du Default Match Roster Open, puis les rounds et les notes internes.</p>
        </section>
      </div>
    </main>
  );
}
