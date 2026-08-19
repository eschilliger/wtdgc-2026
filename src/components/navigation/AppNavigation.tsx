"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { WtdgcRole } from "../../server/auth/session";
import styles from "./AppNavigation.module.css";

type Props = {
  role: WtdgcRole;
  email: string | null;
};

type NavItem = { href: string; label: string };

function roleLabel(role: WtdgcRole) {
  return role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Joueur";
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ role, email }: Props) {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const items: NavItem[] = [
    { href: "/", label: "Accueil" },
    { href: "/compare", label: "Comparateur" },
    { href: "/player-area", label: "Mes matchs" },
    ...(role === "staff" || role === "admin" ? [{ href: "/staff", label: "Staff" }] : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Administration" }] : []),
  ];

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.assign("/");
  }

  const links = items.map((item) => (
    <Link key={item.href} className={`${styles.link} ${isActive(pathname, item.href) ? styles.active : ""}`} href={item.href}>
      {item.label}
    </Link>
  ));

  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          <strong>WTDGC 2026</strong>
          <span>Équipe de France</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Navigation principale">{links}</nav>

        <div className={styles.account}>
          <div className={styles.accountText}>
            <strong>{email ?? "Compte WTDGC"}</strong>
            <span>{roleLabel(role)}</span>
          </div>
          <button className={styles.logoutButton} type="button" disabled={busy} onClick={logout}>
            {busy ? "…" : "Déconnexion"}
          </button>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Ouvrir le menu">☰</summary>
          <div className={styles.mobilePanel}>
            <div className={styles.mobileIdentity}>
              <strong>{email ?? "Compte WTDGC"}</strong>
              <span>{roleLabel(role)}</span>
            </div>
            <nav aria-label="Navigation mobile">{links}</nav>
            <div className={styles.mobileLogout}>
              <button className={styles.logoutButton} type="button" disabled={busy} onClick={logout}>
                {busy ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
