import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/firebase/admin";

export const dynamic = "force-dynamic";

type ProfileDoc = {
  pdgaNumber: number;
  firstName?: string;
  lastName?: string;
  currentRating?: number | null;
  ratingEffectiveDate?: string | null;
  gender?: "M" | "F" | null;
  classification?: string | null;
  city?: string | null;
  stateProv?: string | null;
  country?: string | null;
  membershipStatus?: string | null;
  syncedAt?: string | null;
};

type PlayerDoc = {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  pdgaNumber?: number | null;
};

type RegistrationDoc = {
  teamId: string;
  personId: string;
  role: "player" | "nptm" | "npts";
  jerseyNumber?: number | null;
};

type TeamDoc = {
  country?: string;
  countryCode?: string;
  division?: "open" | "masters";
};

type RatingHistoryDoc = {
  rating?: number;
  effectiveDate?: string | null;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

type YearlyStatsDoc = {
  year?: number;
  gender?: "M" | "F" | null;
  payload?: unknown;
  syncedAt?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function statPairs(value: unknown, prefix = "", depth = 0): Array<[string, string]> {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return [[prefix || "valeur", String(value)]];
  }
  if (Array.isArray(value)) {
    return value.slice(0, 4).flatMap((item, index) => statPairs(item, prefix ? `${prefix}.${index + 1}` : String(index + 1), depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => statPairs(item, prefix ? `${prefix}.${key}` : key, depth + 1));
  }
  return [];
}

function labelForStat(key: string) {
  return key
    .replace(/[_\.]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ratingPolyline(history: RatingHistoryDoc[]) {
  const values = history.filter((item): item is RatingHistoryDoc & { rating: number } => Number.isFinite(item.rating));
  if (values.length < 2) return null;
  const ratings = values.map((item) => item.rating);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(1, max - min);
  return values
    .map((item, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 92 - ((item.rating - min) / span) * 76;
      return `${x},${y}`;
    })
    .join(" ");
}

export default async function PlayerPage({ params }: { params: Promise<{ pdgaNumber: string }> }) {
  const { pdgaNumber: rawPdgaNumber } = await params;
  const pdgaNumber = Number.parseInt(rawPdgaNumber, 10);
  if (!Number.isFinite(pdgaNumber)) notFound();

  const profileRef = db.collection("pdgaProfiles").doc(String(pdgaNumber));
  const [profileSnapshot, playerSnapshot, historySnapshot, statsSnapshot] = await Promise.all([
    profileRef.get(),
    db.collection("players").doc(`pdga-${pdgaNumber}`).get(),
    profileRef.collection("ratingHistory").orderBy("effectiveDate", "asc").get(),
    profileRef.collection("yearlyStats").doc("2026").get(),
  ]);

  if (!profileSnapshot.exists && !playerSnapshot.exists) notFound();

  const profile = (profileSnapshot.data() ?? {}) as ProfileDoc;
  const player = (playerSnapshot.data() ?? {}) as PlayerDoc;
  const history = historySnapshot.docs.map((doc) => doc.data() as RatingHistoryDoc);
  const stats = (statsSnapshot.data() ?? {}) as YearlyStatsDoc;

  const registrationsSnapshot = await db.collection("registrations").where("personId", "==", `pdga-${pdgaNumber}`).get();
  const registration = registrationsSnapshot.docs.map((doc) => doc.data() as RegistrationDoc).find((item) => item.role === "player");
  const teamSnapshot = registration?.teamId ? await db.collection("teams").doc(registration.teamId).get() : null;
  const team = (teamSnapshot?.data() ?? {}) as TeamDoc;

  const fullName = player.fullName || [profile.firstName ?? player.firstName, profile.lastName ?? player.lastName].filter(Boolean).join(" ") || `PDGA #${pdgaNumber}`;
  const chartPoints = ratingPolyline(history);
  const statsToShow = statPairs(stats.payload)
    .filter(([key]) => !/first.?name|last.?name|pdga.?number/i.test(key))
    .slice(0, 12);

  return (
    <main className="shell player-detail">
      <Link className="back-link" href="/">← Retour au comparateur</Link>

      <header className="player-hero">
        <div>
          <p className="eyebrow">{team.country ? `${team.country} · ${team.division === "masters" ? "Masters" : "Open"}` : "Profil joueur"}</p>
          <h1>{fullName}</h1>
          <p className="player-meta">PDGA #{pdgaNumber}{registration?.jerseyNumber ? ` · maillot #${registration.jerseyNumber}` : ""}</p>
        </div>
        <div className="player-rating-block">
          <strong>{profile.currentRating ?? "—"}</strong>
          <span>rating actuel</span>
          <small>{profile.ratingEffectiveDate ? `depuis le ${formatDate(profile.ratingEffectiveDate)}` : ""}</small>
        </div>
      </header>

      <section className="player-detail-grid">
        <article className="detail-card">
          <p className="eyebrow">Profil PDGA</p>
          <dl className="profile-facts">
            <div><dt>Genre</dt><dd>{profile.gender === "M" ? "Homme" : profile.gender === "F" ? "Femme" : "—"}</dd></div>
            <div><dt>Classification</dt><dd>{profile.classification ?? "—"}</dd></div>
            <div><dt>Adhésion</dt><dd>{profile.membershipStatus ?? "—"}</dd></div>
            <div><dt>Localisation</dt><dd>{[profile.city, profile.stateProv, profile.country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Dernière synchro</dt><dd>{formatDate(profile.syncedAt)}</dd></div>
          </dl>
          <a className="pdga-link" href={`https://www.pdga.com/player/${pdgaNumber}`} target="_blank" rel="noreferrer">Voir le profil sur PDGA.com ↗</a>
        </article>

        <article className="detail-card detail-card--history">
          <div className="detail-card__heading">
            <div>
              <p className="eyebrow">Évolution</p>
              <h2>Historique du rating</h2>
            </div>
            <strong>{history.length} relevé{history.length > 1 ? "s" : ""}</strong>
          </div>

          {chartPoints ? (
            <svg className="rating-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Courbe d'évolution du rating">
              <line x1="0" y1="92" x2="100" y2="92" />
              <polyline points={chartPoints} />
            </svg>
          ) : (
            <p className="empty-state">Il faut au moins deux ratings historisés pour tracer une tendance.</p>
          )}

          <div className="rating-history-list">
            {[...history].reverse().slice(0, 8).map((item, index) => (
              <div key={`${item.effectiveDate ?? "rating"}-${index}`}>
                <span>{formatDate(item.effectiveDate)}</span>
                <strong>{item.rating ?? "—"}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="detail-card player-stats">
        <div className="detail-card__heading">
          <div>
            <p className="eyebrow">PDGA</p>
            <h2>Statistiques 2026</h2>
          </div>
          <span>{stats.syncedAt ? `Synchronisées le ${formatDate(stats.syncedAt)}` : ""}</span>
        </div>
        {statsToShow.length ? (
          <div className="stats-grid">
            {statsToShow.map(([key, value]) => (
              <div className="stat-tile" key={key}>
                <span>{labelForStat(key)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Aucune statistique 2026 exploitable n'est encore disponible pour ce joueur.</p>
        )}
      </section>

      <footer className="pdga-attribution">Données joueurs et statistiques : Professional Disc Golf Association (PDGA).</footer>
    </main>
  );
}
