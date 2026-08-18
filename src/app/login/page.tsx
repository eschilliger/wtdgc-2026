import { redirect } from "next/navigation";
import { LoginPanel } from "../../components/auth/LoginPanel";
import styles from "../../components/auth/Auth.module.css";
import { getSessionClaims, roleFromClaims } from "../../server/auth/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);
  if (role === "admin") redirect("/admin");
  if (role === "staff") redirect("/staff");
  if (role === "player") redirect("/player-area");

  const params = await searchParams;
  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>WTDGC 2026</h1>
          <p>Connexion à l’espace Équipe de France.</p>
        </header>
        {params.status === "role-required" ? (
          <p className={styles.notice}>Ton compte est bien créé, mais aucun rôle WTDGC ne lui est encore attribué. Un administrateur doit lui attribuer le rôle Admin, Staff ou Joueur.</p>
        ) : null}
        <LoginPanel />
      </div>
    </main>
  );
}
