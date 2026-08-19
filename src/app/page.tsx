import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSessionClaims, roleFromClaims } from "@/server/auth/session";
import styles from "./Home.module.css";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "eschilliger@gmail.com";

export default async function HomePage() {
  const claims = await getSessionClaims();
  const role = roleFromClaims(claims);

  if (!claims) {
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>WTDGC 2026 · Équipe de France</p>
              <h1>Préparation, comparaison et matchs</h1>
              <p>Connecte-toi pour accéder aux outils WTDGC. Tu peux aussi créer immédiatement ton compte avec Google ou avec une adresse e-mail.</p>
            </div>
          </header>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/login">Se connecter</Link>
            <Link className={styles.secondary} href="/login?mode=signup">Créer un compte</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!role) {
    const subject = encodeURIComponent("WTDGC 2026 - demande d’habilitation");
    const body = encodeURIComponent(`Bonjour,\n\nMon compte WTDGC 2026 est créé avec l’adresse ${claims.email ?? "[mon adresse]"}.\n\nNom / prénom :\nNuméro PDGA :\n\nMerci de m’attribuer mon habilitation.\n`);
    return (
      <main className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>WTDGC 2026 · Compte créé</p>
              <h1>Habilitation requise</h1>
              <p>{claims.email ?? "Ton compte"} est bien reconnu, mais aucun rôle ne lui est encore attribué.</p>
            </div>
            <LogoutButton />
          </header>
          <section className={styles.notice}>
            <strong>Dernière étape : contacter l’administrateur.</strong>
            <p>Vérifie ton adresse e-mail si tu as créé le compte par e-mail, puis envoie une demande à <a href={`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`}>{ADMIN_EMAIL}</a> en indiquant ton nom, ton prénom et ton numéro PDGA. Tu pourras accéder à l’application après attribution de ton habilitation.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>WTDGC 2026 · Équipe de France</p>
            <h1>Accueil</h1>
            <p>{claims.email ?? "Compte WTDGC"} · rôle {role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Joueur"}</p>
          </div>
        </header>

        <div className={styles.grid}>
          <Link className={styles.card} href="/compare">
            <h2>Comparateur d’équipes</h2>
            <p>Compare deux nations, teste des compositions et analyse les ratings, tendances et écarts.</p>
            <span>Ouvrir le comparateur →</span>
          </Link>

          <Link className={styles.card} href="/player-area">
            <h2>Mes matchs</h2>
            <p>Consulte les rounds publiés et les informations joueur. Les Staff et Admin peuvent aussi contrôler cette vue.</p>
            <span>Voir la vue joueur →</span>
          </Link>

          {(role === "staff" || role === "admin") ? (
            <Link className={styles.card} href="/staff">
              <h2>Espace Staff</h2>
              <p>Prépare les rosters, les rounds, les scénarios adverses et les informations à publier.</p>
              <span>Préparer les rounds →</span>
            </Link>
          ) : null}

          {role === "admin" ? (
            <Link className={styles.card} href="/admin">
              <h2>Administration</h2>
              <p>Gère les comptes, les habilitations et les rôles d’accès à l’application.</p>
              <span>Gérer les accès →</span>
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
