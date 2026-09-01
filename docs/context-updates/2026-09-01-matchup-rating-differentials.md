# WTDGC 2026 — Matchup rating differentials

Date: 2026-09-01

## Implemented

- Each official Single and Double assignment displays the France rating, opponent rating, and signed France-minus-opponent differential.
- A Single uses the player's event/reference rating.
- A Double uses the arithmetic mean of the two partners' event/reference ratings.
- Missing players or ratings display an unavailable differential instead of inventing a value.
- The draft action is explicitly labelled, and short explanations distinguish Draft, Ready, and Published.

## Publication workflow

- Draft saves incomplete work and remains hidden from players.
- Ready requires complete rosters and matchups and remains an internal Staff state.
- Published also requires a scheduled start and becomes visible in Mes matchs.
