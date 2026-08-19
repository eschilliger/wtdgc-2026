import { redirect } from "next/navigation";
import { LoginPanel } from "../../components/auth/LoginPanel";
import styles from "../../components/auth/Auth.module.css";
import { getSessionClaims } from "../../server/auth/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const claims = await getSessionClaims();
  if (claims) redirect("/");

  const params = await searchParams;
  const initialMode = params.mode === "signup" ? "signup" : "login";

  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>WTDGC 2026</h1>
          <p>Connecte-toi ou crée ton compte pour accéder aux outils Équipe de France.</p>
        </header>
        <LoginPanel initialMode={initialMode} />
      </div>
    </main>
  );
}
