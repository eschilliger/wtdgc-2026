"use client";

import { FormEvent, useState } from "react";
import {
  GoogleAuthProvider,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase/client";
import styles from "./Auth.module.css";

type LoginRole = "admin" | "staff" | "player" | null;

async function establishServerSession() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Aucun utilisateur Firebase connecté.");
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const payload = await response.json().catch(() => ({})) as { role?: LoginRole; error?: string };
  if (!response.ok) throw new Error(payload.error || "Impossible de créer la session.");
  await signOut(firebaseAuth);
  return payload.role ?? null;
}

function destinationForRole(role: LoginRole) {
  return role === "admin" ? "/admin" : role === "staff" ? "/staff" : role === "player" ? "/player-area" : "/login?status=role-required";
}

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finishLogin(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await setPersistence(firebaseAuth, browserSessionPersistence);
      await action();
      const role = await establishServerSession();
      window.location.assign(destinationForRole(role));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion impossible.";
      setError(message);
      setBusy(false);
    }
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await finishLogin(() => signInWithPopup(firebaseAuth, provider));
  }

  async function loginWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await finishLogin(() => signInWithEmailAndPassword(firebaseAuth, email.trim(), password));
  }

  return (
    <div className={styles.card}>
      <button className={styles.google} type="button" disabled={busy} onClick={loginWithGoogle}>
        Continuer avec Google
      </button>
      <div className={styles.separator}><span>ou</span></div>
      <form onSubmit={loginWithEmail} className={styles.form}>
        <label>
          Adresse e-mail
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className={styles.submit} type="submit" disabled={busy}>Se connecter</button>
      </form>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <p className={styles.help}>L’accès Admin, Staff et Joueur dépend du rôle attribué au compte Firebase.</p>
    </div>
  );
}
