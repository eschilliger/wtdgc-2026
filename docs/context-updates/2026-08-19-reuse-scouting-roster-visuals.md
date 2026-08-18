# 2026-08-19 — Staff roster UX aligned with scouting

## Decision

The select-based player pickers introduced for the Default Match Roster and Open round preparation are replaced by the same visual language used by the scouting comparator.

The goal is to avoid a parallel Staff UI for information that is already represented clearly in scouting.

## Shared foundations

- Scouting team loading is extracted to `src/server/repositories/scouting.repository.ts` and reused by both the public comparator and Staff round preparation.
- `ScoutingRosterPanel` renders team/player rows with the established scouting class names and responsive behavior.
- Staff selection is made directly on player rows using Select/Remove on desktop and the established switch interaction on mobile.
- J1..J6 and the displayed WTDGC team rating update from the selected six.

## Default Match Roster Open

- No player dropdowns.
- Staff directly selects 4 men and 2 women in the France scouting roster.
- The remaining player is visually a substitute.
- Firestore slot assignments remain MPO1..MPO4/FPO1..FPO2; they are derived from the selected players sorted by WTDGC/reference rating.
- Draft/confirmed persistence and server validation remain unchanged.

## Open round preparation

- Metadata fields remain above the confrontation (opponent, local start time, course, starting hole).
- France is shown on the left as an editable scouting roster.
- The selected opponent is shown on the right with its real scouting team/player data in read-only mode.
- Selecting an opponent updates the visible opposing team immediately.
- Default Match Roster can still be restored with one action.
- Staff notes remain private and separate from public round data.
- `draft -> ready -> published` behavior is unchanged.

## Masters

No MP40/MP50 inference or Masters roster UI is introduced by this change.
