"use client";

import { useMemo, useState } from "react";
import type { FranceOpenRosterPlayer } from "../../server/repositories/france-roster.repository";
import type { DefaultMatchRosterDoc } from "../../server/repositories/competition.repository";
import styles from "./DefaultOpenRoster.module.css";

const SLOTS = ["MPO1", "MPO2", "MPO3", "MPO4", "FPO1", "FPO2"] as const;
type OpenSlot = typeof SLOTS[number];

type Props = {
  players: FranceOpenRosterPlayer[];
  roster: DefaultMatchRosterDoc | null;
};

function playerLabel(player: FranceOpenRosterPlayer) {
  const rating = player.wtdgcRating ?? "—";
  const pdga = player.pdgaNumber ? ` · PDGA #${player.pdgaNumber}` : "";
  return `${player.firstName} ${player.lastName} · WTDGC ${rating}${pdga}`;
}

export function DefaultOpenRoster({ players, roster }: Props) {
  const initialAssignments = useMemo(() => {
    const source = roster?.slotAssignments ?? {};
    return Object.fromEntries(SLOTS.map((slot) => [slot, source[slot] ?? ""])) as Record<OpenSlot, string>;
  }, [roster]);

  const [assignments, setAssignments] = useState<Record<OpenSlot, string>>(initialAssignments);
  const [confirmed, setConfirmed] = useState(Boolean(roster?.confirmed));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedIds = Object.values(assignments).filter(Boolean);
  const duplicate = new Set(selectedIds).size !== selectedIds.length;
  const complete = SLOTS.every((slot) => Boolean(assignments[slot]));

  function candidatesFor(slot: OpenSlot) {
    return slot.startsWith("FPO") ? players.filter((player) => player.gender === "F") : players;
  }

  async function save(nextConfirmed: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/staff/default-roster/open", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotAssignments: assignments, confirmed: nextConfirmed }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Enregistrement impossible.");
      setConfirmed(nextConfirmed);
      setMessage({ kind: "success", text: nextConfirmed ? "Default Match Roster Open confirmé." : "Brouillon enregistré." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Enregistrement impossible." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Default Match Roster · Open</h2>
          <p>Sélection staff privée. Les slots MPO peuvent recevoir tout joueur Open ; les slots FPO proposent uniquement les joueuses identifiées FPO-éligibles via le genre PDGA connu.</p>
        </div>
        <span className={`${styles.status} ${confirmed ? styles.statusConfirmed : ""}`}>{confirmed ? "Confirmé" : "Brouillon"}</span>
      </div>

      <div className={styles.grid}>
        {SLOTS.map((slot) => (
          <div className={styles.slot} key={slot}>
            <label>
              {slot}
              <select
                value={assignments[slot]}
                disabled={busy}
                onChange={(event) => {
                  setAssignments((current) => ({ ...current, [slot]: event.target.value }));
                  setConfirmed(false);
                }}
              >
                <option value="">Non attribué</option>
                {candidatesFor(slot).map((player) => (
                  <option key={player.id} value={player.id}>{playerLabel(player)}</option>
                ))}
              </select>
              <small>{slot.startsWith("FPO") ? "Slot FPO : joueuse requise." : "Slot MPO : sélection libre parmi le roster Open."}</small>
            </label>
          </div>
        ))}
      </div>

      <p className={styles.legend}>Le rating affiché est le rating WTDGC figé au 11/08/2026. Un même joueur ne peut pas occuper deux slots. La confirmation exige les 6 slots complets ; le brouillon peut rester incomplet.</p>

      <div className={styles.actions}>
        <button className={styles.save} type="button" disabled={busy || duplicate} onClick={() => save(false)}>Enregistrer le brouillon</button>
        <button className={styles.confirm} type="button" disabled={busy || duplicate || !complete} onClick={() => save(true)}>Confirmer le roster</button>
      </div>
      {duplicate ? <p className={`${styles.message} ${styles.error}`}>Un même joueur est sélectionné plusieurs fois.</p> : null}
      {message ? <p className={`${styles.message} ${message.kind === "success" ? styles.success : styles.error}`}>{message.text}</p> : null}
    </section>
  );
}
