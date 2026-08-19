import styles from "../../components/auth/Auth.module.css";
import { requirePlayerAccess, roleFromClaims } from "../../server/auth/session";

export default async function PlayerAreaPage() {
  const claims = await requirePlayerAccess();
  const role = roleFromClaims(claims);
  return (
    <main className={styles.area}>
      <div className={styles.areaInner}>
        <header className={styles.areaHeader}>
          <div>
            <h1>Mes matchs</h1>
            <p>{claims.email ?? "Compte WTDGC"}{role !== "player" ? ` · aperçu joueur en tant que ${role === "admin" ? "Admin" : "Staff"}` : ""}</p>
          </div>
        </header>
        <section className={styles.placeholder}>
          <strong>Vue joueur.</strong>
          <p>Les rounds resteront invisibles ici tant qu’ils ne seront pas publiés par le staff. Les notes internes ne seront jamais exposées dans cet espace. Staff et Admin voient volontairement la même vue afin de pouvoir contrôler ce qui est communiqué aux joueurs.</p>
        </section>
      </div>
    </main>
  );
}
