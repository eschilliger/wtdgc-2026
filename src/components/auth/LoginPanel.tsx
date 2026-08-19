"use client";

import { FormEvent, useState } from "react";
import {
  GoogleAuthProvider,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { firebaseAuth } from "../../lib/firebase/client";
import styles from "./Auth.module.css";

type AuthMode = "login" | "signup";
type LoginRole = "admin" | "staff" | "player" | null;

type Props = {
  initialMode?: AuthMode;
};

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

export function LoginPanel({ initialMode = "login" }: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function finishLogin(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await setPersistence(firebaseAuth, browserSessionPersistence);
      await action();
      await establishServerSession();
      window.location.assign("/");
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

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (mode === "signup") {
      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("Les deux mots de passe ne correspondent pas.");
        return;
      }
      await finishLogin(async () => {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        try {
          await sendEmailVerification(credential.user);
        } catch {
          // Account creation must remain usable even if the verification e-mail provider is temporarily unavailable.
        }
      });
      return;
    }

    await finishLogin(() => signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password));
  }

  async function resetPassword() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Renseigne d’abord ton adresse e-mail.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
      setInfo("Un e-mail de réinitialisation du mot de passe a été envoyé si cette adresse possède un compte.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’envoyer l’e-mail de réinitialisation.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setInfo(null);
    setPassword("");
    setPasswordConfirm("");
  }

  return (
    <div className={styles.card}>
      <div className={styles.modeSwitch} role="tablist" aria-label="Mode d’authentification">
        <button type="button" className={mode === "login" ? styles.modeActive : ""} onClick={() => changeMode("login")}>Se connecter</button>
        <button type="button" className={mode === "signup" ? styles.modeActive : ""} onClick={() => changeMode("signup")}>Créer un compte</button>
      </div>

      <button className={styles.google} type="button" disabled={busy} onClick={loginWithGoogle}>
        {mode === "signup" ? "Créer avec Google" : "Continuer avec Google"}
      </button>

      <div className={styles.separator}><span>ou</span></div>

      <form onSubmit={submitEmail} className={styles.form}>
        <label>
          Adresse e-mail
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Mot de passe
          <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {mode === "signup" ? (
          <label>
            Confirmer le mot de passe
            <input type="password" autoComplete="new-password" required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} />
          </label>
        ) : null}
        <button className={styles.submit} type="submit" disabled={busy}>
          {mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      {mode === "login" ? (
        <button className={styles.linkButton} type="button" disabled={busy} onClick={resetPassword}>Mot de passe oublié ?</button>
      ) : null}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {info ? <p className={styles.success} role="status">{info}</p> : null}
      <p className={styles.help}>
        {mode === "signup"
          ? "Après création, vérifie ton e-mail puis contacte l’administrateur pour obtenir ton habilitation."
          : "L’accès aux outils dépend de l’habilitation attribuée à ton compte."}
      </p>
    </div>
  );
}
