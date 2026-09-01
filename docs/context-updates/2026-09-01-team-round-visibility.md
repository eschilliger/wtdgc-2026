# WTDGC 2026 — Team round visibility

Date: 2026-09-01

## Player area

- Every player associated with a division can see all four published team confrontations for that division.
- The connected player's own confrontation is highlighted with `Ma confrontation`.
- Substitutes can also see the complete published team composition.
- Draft rounds remain invisible to players.

## Publication workflow

- The intermediate `ready` state is removed from the application.
- A round is either `draft` or `published`.
- Publishing validates the complete roster, opponent assignments, opponent, and scheduled start.
- Returning a published round to draft immediately removes it from Mes matchs.
- Legacy `ready` values are read as drafts until the round is saved again.
