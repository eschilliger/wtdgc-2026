"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OPEN_ROSTER_SLOTS, type OpenRosterSlot, type WtdgcRoundPublicationStatus } from "../../domain/wtdgc/competition";
import type { OpenRoundManagementData } from "../../server/repositories/round-management.repository";
import styles from "./OpenRoundEditor.module.css";

type Props = {
  data: OpenRoundManagementData;
};

function statusLabel(status: WtdgcRoundPublicationStatus) {
  return status === "published" ? "Publié" : status === "ready" ? "Prêt" : "Brouillon";
}

function statusClass(status: WtdgcRoundPublicationStatus) {
  return status === "published" ? styles.published : status === "ready" ? styles.ready : styles.draft;
}

function playerLabel(player: OpenRoundManagementData["players"][number]) {
  const rating = player.wtdgcRating ?? "—";
  return `${player.firstName} ${player.lastName} · WTDGC ${rating}${player.pdgaNumber ? ` · #${player.pdgaNumber}` : ""}`;
}

function completeAssignments(source: Partial<Record<OpenRosterSlot, string>>) {
  return Object.fromEntries(OPEN_ROSTER_SLOTS.map((slot) => [slot, source[slot] ?? ""])) as Record<OpenRosterSlot, string>;
}

export function OpenRoundEditor({ data }: Props) {
  const initialAssignments = useMemo(
    () => completeAssignments(data.roster?.slotAssignments ?? data.defaultSlotAssignments),
    [data.roster, data.defaultSlotAssignments],
  );

  const [assignments, setAssignments] = useState<Record<OpenRosterSlot, string>>(initialAssignments);
  const [opponentTeamId, setOpponentTeamId] = useState(data.opponentTeamId ?? "");
  const [scheduledStart, setScheduledStart] = useState(data.scheduledStart ?? "");
  const [course, setCourse] = useState(data.course ?? "");
  const [startingHole, setStartingHole] = useState(data.startingHole ?? "");
  const [internalNote, setInternalNote] = useState(data.internalNote);
  const [status, setStatus] = useState<WtdgcRoundPublicationStatus>(data.publicationStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedIds = Object.values(assignments).filter(Boolean);
  const duplicate = new Set(selectedIds).size !== selectedIds.length;
  const complete = OPEN_ROSTER_SLOTS.every((slot) => Boolean(assignments[slot]));
  const canReady = complete && Boolean(opponentTeamId) && !duplicate;
  const canPublish = canReady && Boolean(scheduledStart);

  function candidatesFor(slot: OpenRosterSlot) {
    return slot.startsWith("FPO") ? data.players.filter((player) => player.gender === "F") : data.players;
  }

  function useDefaultRoster() {
    setAssignments(completeAssignments(data.defaultSlotAssignments));
    setMessage(null);
  }

  async function save(nextStatus: WtdgcRoundPublicationStatus) {
    if (nextStatus === "published") {
      const ok = window.confirm("Publier ce round ? Les joueurs autorisés pourront alors voir les informations de match publiées.");
      if (!ok) return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/staff/rounds/open/${data.roundNumber}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicationStatus: nextStatus,
          opponentTeamId: opponentTeamId || null,
          scheduledStart: scheduledStart || null,
          course: course || null,
          startingHole: startingHole || null,
          slotAssignments: assignments,
          internalNote,
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setStatus(nextStatus);
      setMessage({
        kind: "success",
        text: nextStatus === "published" ? "Round publié." : nextStatus === "ready" ? "Round marqué prêt." : "Brouillon enregistré.",
      });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.back} href="/staff">← Retour à l’espace Staff</Link>
        <nav className={styles.roundNav} aria-label="Rounds Open">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((round) => (
            <Link key={round} href={`/staff/rounds/open/${round}`} aria-current={round === data.roundNumber ? "page" : undefined}>R{round}</Link>
          ))}
        </nav>
      </div>

      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2>Open · Round {data.roundNumber}</h2>
            <p>Préparation privée Staff. Le round ne devient visible côté joueur qu’après publication.</p>
          </div>
          <span className={`${styles.status} ${statusClass(status)}`}>{statusLabel(status)}</span>
        </div>

        <div className={styles.metaGrid}>
          <label className={styles.field}>
            Adversaire
            <select value={opponentTeamId} disabled={busy} onChange={(event) => setOpponentTeamId(event.target.value)}>
              <option value="">Non défini</option>
              {data.teams.map((team) => <option key={team.id} value={team.id}>{team.country}</option>)}
            </select>
            <small>Obligatoire pour passer le round en « Prêt ».</small>
          </label>

          <label className={styles.field}>
            Départ · heure locale Vilnius
            <input type="datetime-local" value={scheduledStart} disabled={busy} onChange={(event) => setScheduledStart(event.target.value)} />
            <small>Obligatoire avant publication aux joueurs.</small>
          </label>

          <label className={styles.field}>
            Parcours / lieu
            <input value={course} disabled={busy} onChange={(event) => setCourse(event.target.value)} placeholder="À renseigner quand officiel" />
          </label>

          <label className={styles.field}>
            Trou de départ
            <input value={startingHole} disabled={busy} onChange={(event) => setStartingHole(event.target.value)} placeholder="Ex. 1, 7A…" />
          </label>
        </div>

        <h3 className={styles.sectionTitle}>Roster du round</h3>
        <div className={styles.rosterActions}>
          <button className={styles.secondary} type="button" disabled={busy} onClick={useDefaultRoster}>Reprendre le Default Match Roster</button>
        </div>

        <div className={styles.rosterGrid}>
          {OPEN_ROSTER_SLOTS.map((slot) => (
            <div className={styles.slot} key={slot}>
              <label>
                {slot}
                <select
                  value={assignments[slot]}
                  disabled={busy}
                  onChange={(event) => setAssignments((current) => ({ ...current, [slot]: event.target.value }))}
                >
                  <option value="">Non attribué</option>
                  {candidatesFor(slot).map((player) => <option key={player.id} value={player.id}>{playerLabel(player)}</option>)}
                </select>
                <small>{slot.startsWith("FPO") ? "Joueuse requise." : "Sélection Open."}</small>
              </label>
            </div>
          ))}
        </div>

        <label className={`${styles.field} ${styles.full}`} style={{ marginTop: 20 }}>
          Notes internes Staff
          <textarea value={internalNote} disabled={busy} onChange={(event) => setInternalNote(event.target.value)} placeholder="Stratégie, points d’attention, informations internes…" />
          <small>Ces notes sont stockées séparément dans `staffNotes` et ne sont jamais exposées aux joueurs.</small>
        </label>

        <p className={styles.notice}>Le statut « Prêt » exige un adversaire et les 6 slots complets. La publication exige en plus une heure de départ. Parcours et trou de départ restent facultatifs tant qu’ils ne sont pas officiels.</p>
        <p className={`${styles.notice} ${styles.publishNotice}`}>Publier est une action de communication : les informations publiques du round deviennent éligibles à l’affichage joueur. Les notes internes restent privées.</p>

        <div className={styles.actions}>
          <button className={styles.save} type="button" disabled={busy || duplicate} onClick={() => save("draft")}>{status === "published" ? "Repasser en brouillon" : "Enregistrer le brouillon"}</button>
          <button className={styles.readyButton} type="button" disabled={busy || !canReady} onClick={() => save("ready")}>Marquer prêt</button>
          <button className={styles.publishButton} type="button" disabled={busy || !canPublish} onClick={() => save("published")}>Publier le round</button>
        </div>
        {duplicate ? <p className={`${styles.message} ${styles.error}`}>Un même joueur ne peut pas occuper plusieurs slots.</p> : null}
        {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
      </section>
    </div>
  );
}
