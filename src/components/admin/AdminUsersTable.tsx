"use client";

import { useState } from "react";
import styles from "./AdminUsers.module.css";

export type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string | null;
  role: "admin" | "staff" | "player" | null;
  providers: string[];
  disabled: boolean;
};

type Props = {
  users: AdminUserRow[];
  currentUid: string;
};

function roleLabel(role: AdminUserRow["role"]) {
  return role === "admin" ? "Admin" : role === "staff" ? "Staff" : role === "player" ? "Joueur" : "Sans rôle";
}

export function AdminUsersTable({ users, currentUid }: Props) {
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
      setRows((current) => current.map((row) => row.uid === uid ? { ...row, role: payload.role ?? role } : row));
      setMessages((current) => ({ ...current, [uid]: { kind: "success", text: "Rôle mis à jour." } }));
    } catch (error) {
      const text = error instanceof Error ? error.message : "Mise à jour impossible.";
      setMessages((current) => ({ ...current, [uid]: { kind: "error", text } }));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <div className={styles.panel}>
      <section className={styles.summary}>
        <h2>Utilisateurs</h2>
        <p>{rows.length} compte{rows.length > 1 ? "s" : ""} Firebase Auth. Les rôles sont appliqués via les custom claims Firebase.</p>
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.users}>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Connexion</th>
              <th>État</th>
              <th>Rôle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const isSelf = user.uid === currentUid;
              const message = messages[user.uid];
              return (
                <tr key={user.uid}>
                  <td>
                    <div className={styles.email}>{user.email}</div>
                    <div className={styles.meta}>{user.displayName || user.uid}</div>
                  </td>
                  <td>
                    <span className={styles.badge}>{user.providers.length ? user.providers.join(" + ") : "email"}</span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${user.disabled ? styles.disabled : ""}`}>
                      {user.disabled ? "Désactivé" : "Actif"}
                    </span>
                  </td>
                  <td>
                    {isSelf ? (
                      <div>
                        <span className={styles.badge}>{roleLabel(user.role)}</span>
                        <div className={styles.self}>Ton propre rôle ne peut pas être modifié ici.</div>
                      </div>
                    ) : (
                      <div>
                        <div className={styles.roleControl}>
                          <select
                            aria-label={`Rôle de ${user.email}`}
                            value={user.role ?? "player"}
                            disabled={busyUid === user.uid}
                            onChange={(event) => updateRole(user.uid, event.target.value as "admin" | "staff" | "player")}
                          >
                            <option value="player">Joueur</option>
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        {user.role === null ? <div className={styles.meta}>Sans rôle actuellement — choisir un rôle l’attribue immédiatement.</div> : null}
                        {message?.text ? <div className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</div> : null}
                      </div>
                    )}
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
