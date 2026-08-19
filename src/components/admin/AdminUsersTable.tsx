"use client";

import { useState } from "react";
import styles from "./AdminUsers.module.css";

export type AdminPlayerOption = {
  personId: string;
  pdgaNumber: number | null;
  division: "open" | "masters";
  label: string;
};

export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string | null;
  role: "admin" | "staff" | "player" | null;
  providers: string[];
  disabled: boolean;
  authorizationStatus: "active" | "pending";
  playerPersonId: string | null;
};

type Props = {
  users: AdminUserRow[];
  players: AdminPlayerOption[];
  currentUid: string;
};

function roleLabel(role: AdminUserRow["role"]) {
  return role === "admin" ? "Admin" : role === "staff" ? "Staff" : role === "player" ? "Joueur" : "Sans rôle";
}

export function AdminUsersTable({ users, players, currentUid }: Props) {
  const [rows, setRows] = useState(users);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { kind: "success" | "error"; text: string }>>({});

  async function updateRole(uid: string, role: "admin" | "staff" | "player") {
    setBusyUid(uid);
    setMessages((current) => ({ ...current, [uid]: { kind: "success", text: "" } }));
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json().catch(() => ({})) as { role?: AdminUserRow["role"]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Mise à jour impossible.");
      setRows((current) => current.map((row) => row.uid === uid ? { ...row, role: payload.role ?? role, authorizationStatus: "active" } : row));
      setMessages((current) => ({ ...current, [uid]: { kind: "success", text: "Rôle mis à jour." } }));
    } catch (error) {
      setMessages((current) => ({ ...current, [uid]: { kind: "error", text: error instanceof Error ? error.message : "Mise à jour impossible." } }));
    } finally {
      setBusyUid(null);
    }
  }

  async function updatePlayer(uid: string, personId: string | null) {
    setBusyUid(uid);
    setMessages((current) => ({ ...current, [uid]: { kind: "success", text: "" } }));
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/player`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId }),
      });
      const payload = await response.json().catch(() => ({})) as { personId?: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error || "Association impossible.");
      setRows((current) => current.map((row) => row.uid === uid ? { ...row, playerPersonId: payload.personId ?? null } : row));
      setMessages((current) => ({ ...current, [uid]: { kind: "success", text: personId ? "Joueur associé." : "Association retirée." } }));
    } catch (error) {
      setMessages((current) => ({ ...current, [uid]: { kind: "error", text: error instanceof Error ? error.message : "Association impossible." } }));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div className={styles.panel}>
      <section className={styles.summary}>
        <h2>Utilisateurs</h2>
        <p>{rows.length} compte{rows.length > 1 ? "s" : ""}. Attribue un rôle et, si nécessaire, associe le compte à un joueur France.</p>
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.users}>
          <thead><tr><th>Utilisateur</th><th>État</th><th>Rôle</th><th>Joueur associé</th></tr></thead>
          <tbody>
            {rows.map((user) => {
              const isSelf = user.uid === currentUid;
              const message = messages[user.uid];
              return (
                <tr key={user.uid}>
                  <td><div className={styles.email}>{user.email}</div><div className={styles.meta}>{user.displayName || user.providers.join(" + ") || user.uid}</div></td>
                  <td><span className={`${styles.badge} ${user.disabled ? styles.disabled : ""}`}>{user.disabled ? "Désactivé" : user.authorizationStatus === "active" ? "Habilité" : "En attente"}</span></td>
                  <td>
                    {isSelf ? <div><span className={styles.badge}>{roleLabel(user.role)}</span><div className={styles.self}>Rôle du compte courant.</div></div> : (
                      <div className={styles.roleControl}><select aria-label={`Rôle de ${user.email}`} value={user.role ?? ""} disabled={busyUid === user.uid} onChange={(event) => { const role = event.target.value; if (role === "admin" || role === "staff" || role === "player") updateRole(user.uid, role); }}><option value="" disabled>Sans rôle</option><option value="player">Joueur</option><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                    )}
                  </td>
                  <td>
                    <div className={styles.playerControl}>
                      <select aria-label={`Joueur associé à ${user.email}`} value={user.playerPersonId ?? ""} disabled={busyUid === user.uid} onChange={(event) => updatePlayer(user.uid, event.target.value || null)}>
                        <option value="">Aucun joueur</option>
                        <optgroup label="Open">{players.filter((player) => player.division === "open").map((player) => <option key={`open-${player.personId}`} value={player.personId}>{player.label}{player.pdgaNumber ? ` · #${player.pdgaNumber}` : ""}</option>)}</optgroup>
                        <optgroup label="Masters">{players.filter((player) => player.division === "masters").map((player) => <option key={`masters-${player.personId}`} value={player.personId}>{player.label}{player.pdgaNumber ? ` · #${player.pdgaNumber}` : ""}</option>)}</optgroup>
                      </select>
                    </div>
                    {message?.text ? <div className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
