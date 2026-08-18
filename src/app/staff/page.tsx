import Link from "next/link";
import { LogoutButton } from "../../components/auth/LogoutButton";
import { DefaultOpenRoster } from "../../components/staff/DefaultOpenRoster";
import styles from "../../components/auth/Auth.module.css";
import { requireStaffAccess, roleFromClaims } from "../../server/auth/session";
import { loadFranceOpenRosterData } from "../../server/repositories/france-roster.repository";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const claims = await requireStaffAccess();
  const role = roleFromClaims(claims);
  const { players, roster } = await loadFranceOpenRosterData();

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
          <strong>Préparation WTDGC privée.</strong>
          <p>Le Default Match Roster Open est visible uniquement par le Staff/Admin. Sa confirmation ne publie encore aucun round côté joueurs.</p>
        </section>
        <DefaultOpenRoster players={players} roster={roster} />
      </div>
    </main>
  );
}
