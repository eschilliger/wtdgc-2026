import { AdminUsersTable, type AdminPlayerOption, type AdminUserRow } from "../../components/admin/AdminUsersTable";
import authStyles from "../../components/auth/Auth.module.css";
import { requireRole } from "../../server/auth/session";
import { auth, db } from "../../server/firebase/admin";
import { loadScoutingTeams } from "../../server/repositories/scouting.repository";

function normalizeRole(value: unknown): AdminUserRow["role"] {
  return value === "admin" || value === "staff" || value === "player" ? value : null;
}

function providerLabel(providerId: string) {
  return providerId === "google.com" ? "Google" : providerId === "password" ? "Email" : providerId;
}

export default async function AdminPage() {
  const claims = await requireRole("admin");
  const [result, appUsersSnapshot, openTeams, mastersTeams] = await Promise.all([
    auth.listUsers(1000),
    db.collection("appUsers").get(),
    loadScoutingTeams("open"),
    loadScoutingTeams("masters"),
  ]);

  const appUsersByUid = new Map(appUsersSnapshot.docs.map((doc) => [doc.id, doc.data()] as const));
  const franceTeams = [...openTeams, ...mastersTeams].filter((team) => team.countryCode === "FR" || team.country.trim().toLowerCase() === "france");
  const players: AdminPlayerOption[] = franceTeams
    .flatMap((team) => team.players.map((player) => ({
      personId: player.id,
      pdgaNumber: player.pdgaNumber,
      division: team.division,
      label: `${player.firstName} ${player.lastName}`,
    })))
    .sort((a, b) => a.division.localeCompare(b.division) || a.label.localeCompare(b.label, "fr"));

  const users: AdminUserRow[] = result.users
    .map((user) => {
      const profile = appUsersByUid.get(user.uid);
      return {
        uid: user.uid,
        email: user.email ?? "Sans e-mail",
        displayName: user.displayName ?? null,
        role: normalizeRole(user.customClaims?.role),
        providers: user.providerData.map((provider) => providerLabel(provider.providerId)),
        disabled: user.disabled,
        authorizationStatus: profile?.authorizationStatus === "active" ? "active" : "pending",
        playerPersonId: typeof profile?.personId === "string" ? profile.personId : null,
      } satisfies AdminUserRow;
    })
    .sort((a, b) => a.email.localeCompare(b.email, "fr"));

  return (
    <main className={authStyles.area}>
      <div className={authStyles.areaInner}>
        <header className={authStyles.areaHeader}>
          <div>
            <h1>Administration</h1>
            <p>{claims.email ?? "Compte administrateur"}</p>
          </div>
        </header>
        <AdminUsersTable users={users} players={players} currentUid={claims.uid} />
      </div>
    </main>
  );
}
