# 2026-09-01 - Role-based round simulation

The Staff round editor now uses the same availability scenario on both sides of the matchup.

## Composition behavior

- France and the opponent both use `Désactiver` / `Réactiver` behavior.
- When an active player is disabled, the next eligible player by event rating enters automatically.
- France Masters always keeps Mehdi Boukarabila (PDGA 69452) as the required MP50.
- The saved France roster remains the calculated active six; the UI no longer requires a separate remove-then-select workflow.

## WTDGC positions

- Generic J1-J6 labels and the disconnected player-by-player table are removed.
- Open active players are labeled MPO1-MPO4 and FPO1-FPO2.
- France Masters active players are labeled MP40-1 to MP40-3, MP50 and FP40-1 to FP40-2.
- An opponent Masters roster shows `MP40 / MP50` until Staff identifies the selected MP50.

## Official assignments

- The simulated active six now feeds the official Singles 1, Singles 2, Doubles 1 and Doubles 2 assignments for both teams.
- Per-Game opponent dropdowns are removed.
- Open opponent slots are derived automatically from gender and event rating.
- Masters requires Staff to choose the opponent MP50 among the four active men once known. Drafts may keep it undefined; Ready and Published require it.
- The opponent MP50 choice is stored in `opponentScenario.mp50PlayerId`.
