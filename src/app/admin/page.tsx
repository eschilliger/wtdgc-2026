import Link from "next/link";
import { LogoutButton } from "../../components/auth/LogoutButton";
import { AdminUsersTable, type AdminUserRow } from "../../components/admin/AdminUsersTable";
import authStyles from "../../components/auth/Auth.module.css";
import { requireRole } from "../../server/auth/session";
import { auth } from "../../server/firebase/admin";

function normalizeRole(value: unknown): AdminUserRow["role"] {
  return value === "admin" || value === "staff" || value === "player" ? value : null;
}

function providerLabel(providerId: string) {
  return providerId === "google.com" ? "Google" : providerId === "password" ? "Email" : providerId;
}

export default async function AdminPage() {
  const claims = await requireRole("admin");
  const result = await auth.listUsers(1000);
  const users: AdminUserRow[] = result.users
    .map((user) => ({
      uid: user.uid,
      email: user.email ?? "Sans e-mail",
      displayName: user.displayName ?? null,
      role: normalizeRole(user.customClaims?.role),
      providers: user.providerData.map((provider) => providerLabel(provider.providerId)),
      disabled: user.disabled,
    }))
    .sort((a, b) => a.email.localeCompare(b.email, "fr"));

  return (
    <main className={authStyles.area}>
      <div className={authStyles.areaInner}>
        <header className={authStyles.areaHeader}>
          <div>
            <h1>Administration</h1>
            <p>{claims.email ?? "Compte administrateur"} · gestion des accès WTDGC</p>
          </div>
          <LogoutButton />
        </header>
        <section className={authStyles.placeholder} style={{ marginBottom: 18 }}>
          <strong>Accès administrateur validé.</strong>
          <p>Attribue les rôles Joueur, Staff ou Admin. Un changement de rôle prend effet lors du prochain renouvellement de session de l’utilisateur.</p>
          <p><Link href="/staff">Accéder à l’espace Staff</Link></p>
        </section>
        <AdminUsersTable users={users} currentUid={claims.uid} />
      </div>
    </main>
  );
}
