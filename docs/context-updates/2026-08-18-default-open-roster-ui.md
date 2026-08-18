# 2026-08-18 — Default Match Roster Open staff UI

## Scope

First staff-facing competition preparation screen. Open only; Masters remains intentionally blocked from automatic composition until MP40/MP50/FP40 eligibility is known from a reliable source.

## Access

- `/staff` requires Staff or Admin server session.
- Default Match Roster data remains private preparation data.
- Confirming the default roster does **not** publish any round to players.
- Saves go through a protected same-origin Next.js server route using Firebase Admin SDK after role verification.

## Open roster editor

Slots:

- MPO1
- MPO2
- MPO3
- MPO4
- FPO1
- FPO2

The editor loads the current France Open WTDGC player registration and the existing `events/wtdgc-2026/defaultMatchRosters/open` document.

Players are displayed with the frozen WTDGC reference rating when available. MPO slots can select any registered France Open player. FPO slots only offer players currently identified as female from the persisted PDGA profile data. This is a practical Open-only guard and does not create or infer any Masters MP40/MP50 eligibility.

Validation:

- no duplicate player across slots;
- draft may be incomplete;
- confirmation requires all six slots;
- server validates that every selected ID belongs to the France Open player roster;
- server validates FPO slots against persisted female gender data.

## Persistence

Uses the existing `upsertDefaultMatchRoster("open", ...)` repository function. The document records selected IDs, slot assignments, status/confirmation timestamps and additionally `updatedBy` / `updatedByEmail` for staff audit.

## Next logical step

Build round preparation from the confirmed default roster: choose round, copy/adjust roster, enter opponent/time/course when known, keep staff notes private, then move through `draft -> ready -> published` so players only see a staff-published round.
