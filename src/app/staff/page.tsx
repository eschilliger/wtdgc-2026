import Link from "next/link";
import { LogoutButton } from "../../components/auth/LogoutButton";
import styles from "../../components/auth/Auth.module.css";
import { requireStaffAccess, roleFromClaims } from "../../server/auth/session";

export default async function StaffPage() {
  const claims = await requireStaffAccess();
  const role = roleFromClaims(claims);
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
        {role === "admin" ? (
          <section className={styles.placeholder} style={{ marginBottom: 18 }}>
            <strong>Mode administrateur.</strong>
            <p><Link href="/admin">Gérer les utilisateurs et les rôles</Link></p>
          </section>
        ) : null}
        <section className={styles.placeholder}>
          <strong>Accès staff validé.</strong>
          <p>Le prochain écran branchera ici la gestion du Default Match Roster Open, puis les rounds et les notes internes.</p>
        </section>
      </div>
    </main>
  );
}
