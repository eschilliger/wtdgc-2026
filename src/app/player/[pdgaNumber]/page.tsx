import Link from "next/link";
import { notFound } from "next/navigation";
import RatingHistoryChart, { type RatingHistoryPoint } from "@/components/RatingHistoryChart";
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
  roundsUsed?: number | null;
};

type YearlyStatsDoc = {
  year?: number;
  gender?: "M" | "F" | null;
  payload?: unknown;
  syncedAt?: string;
};

type CuratedStat = {
  label: string;
  value: string;
  hint?: string;
};

function parseFlexibleDate(value?: string | null) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value?: string | null) {
  const date = parseFlexibleDate(value);
  if (!date) return value || "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function translateClassification(value?: string | null) {
  if (!value) return "—";
  const normalized = value.trim().toUpperCase();
  if (normalized === "P") return "Professionnel";
  if (normalized === "A") return "Amateur";
  return value;
}

function translateMembership(value?: string | null) {
  if (!value) return "—";
  const normalized = value.trim().toLowerCase();
  if (["current", "active", "yes"].includes(normalized)) return "Active";
  if (["expired", "inactive", "no"].includes(normalized)) return "Inactive";
  return value;
}

function translateDivision(value?: string | null) {
  if (!value) return "—";
  const map: Record<string, string> = {
    "Mixed Pro Open": "Open mixte professionnel",
    "Female Pro Open": "Open femmes professionnel",
    MPO: "MPO",
    FPO: "FPO",
  };
  return map[value] ?? value;
}

function primitiveEntries(value: unknown, prefix = "", depth = 0): Array<[string, unknown]> {
  if (depth > 5 || value == null) return [];
  if (["string", "number", "boolean"].includes(typeof value)) return [[prefix, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => primitiveEntries(item, `${prefix}.${index + 1}`, depth + 1));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, item]) => primitiveEntries(item, prefix ? `${prefix}.${key}` : key, depth + 1));
  }
  return [];
}

function findStat(payload: unknown, candidates: string[]) {
  const entries = primitiveEntries(payload);
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const [key, value] of entries) {
    const leaf = key.split(".").at(-1)?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    if (normalizedCandidates.includes(leaf)) return value;
  }
  return null;
}

function asDisplay(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value);
  return String(value);
}

function curatedStats(payload: unknown): CuratedStat[] {
  const tournaments = asDisplay(findStat(payload, ["tournaments", "tournament_count"]));
  const rounds = asDisplay(findStat(payload, ["rating_rounds_used", "rounds_used"]));
  const points = asDisplay(findStat(payload, ["points"]));
  const prize = asDisplay(findStat(payload, ["prize", "prize_money"]));
  const divisionName = asDisplay(findStat(payload, ["division_name"]));
  const divisionCode = asDisplay(findStat(payload, ["division_code"]));
  const country = asDisplay(findStat(payload, ["country"]));
  const lastModifiedRaw = asDisplay(findStat(payload, ["last_modified", "lastmodified"]));

  return [
    tournaments ? { label: "Tournois", value: tournaments, hint: "saison 2026" } : null,
    rounds ? { label: "Rounds pris en compte", value: rounds, hint: "pour le rating" } : null,
    points ? { label: "Points PDGA", value: points } : null,
    prize ? { label: "Gains", value: `${prize} $` } : null,
    divisionCode || divisionName ? { label: "Division", value: divisionCode ?? "—", hint: translateDivision(divisionName) } : null,
    country ? { label: "Pays", value: country } : null,
    lastModifiedRaw ? { label: "Dernière mise à jour PDGA", value: formatDate(lastModifiedRaw) } : null,
  ].filter((item): item is CuratedStat => item !== null);
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
  const ratingHistory: RatingHistoryPoint[] = history
    .filter((item): item is RatingHistoryDoc & { rating: number; effectiveDate: string } => Number.isFinite(item.rating) && Boolean(item.effectiveDate))
    .map((item) => ({ rating: item.rating, effectiveDate: item.effectiveDate, roundsUsed: item.roundsUsed ?? null }));
  const stats = (statsSnapshot.data() ?? {}) as YearlyStatsDoc;

  const registrationsSnapshot = await db.collection("registrations").where("personId", "==", `pdga-${pdgaNumber}`).get();
  const registration = registrationsSnapshot.docs.map((doc) => doc.data() as RegistrationDoc).find((item) => item.role === "player");
  const teamSnapshot = registration?.teamId ? await db.collection("teams").doc(registration.teamId).get() : null;
  const team = (teamSnapshot?.data() ?? {}) as TeamDoc;

  const fullName = player.fullName || [profile.firstName ?? player.firstName, profile.lastName ?? player.lastName].filter(Boolean).join(" ") || `PDGA #${pdgaNumber}`;
  const statsToShow = curatedStats(stats.payload);

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
            <div><dt>Statut joueur</dt><dd>{translateClassification(profile.classification)}</dd></div>
            <div><dt>Adhésion PDGA</dt><dd>{translateMembership(profile.membershipStatus)}</dd></div>
            <div><dt>Localisation</dt><dd>{[profile.city, profile.stateProv, profile.country].filter(Boolean).join(", ") || "—"}</dd></div>
            <div><dt>Dernière synchro</dt><dd>{formatDate(profile.syncedAt)}</dd></div>
          </dl>
          <a className="pdga-link" href={`https://www.pdga.com/player/${pdgaNumber}`} target="_blank" rel="noreferrer">Voir le profil sur PDGA.com ↗</a>
        </article>

        <article className="detail-card detail-card--history">
          <div className="detail-card__heading">
            <div><p className="eyebrow">Évolution</p><h2>Historique du rating</h2></div>
            <strong>{ratingHistory.length} relevé{ratingHistory.length > 1 ? "s" : ""}</strong>
          </div>
          <RatingHistoryChart history={ratingHistory} currentRating={profile.currentRating} />
        </article>
      </section>

      <section className="detail-card player-stats player-stats--curated">
        <div className="detail-card__heading">
          <div><p className="eyebrow">PDGA</p><h2>Saison 2026</h2></div>
          <span>{stats.syncedAt ? `Synchronisée le ${formatDate(stats.syncedAt)}` : ""}</span>
        </div>
        {statsToShow.length ? (
          <div className="stats-grid stats-grid--curated">
            {statsToShow.map((stat) => (
              <div className="stat-tile stat-tile--curated" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.hint ? <small>{stat.hint}</small> : null}
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
