"use client";

import { useState } from "react";
import styles from "./Auth.module.css";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.assign("/login");
  }

  return (
    <button className={styles.logout} type="button" disabled={busy} onClick={logout}>
      {busy ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
