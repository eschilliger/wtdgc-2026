# 2026-08-18 — Open round preparation

This update adds the first staff workflow for preparing WTDGC Open rounds from the confirmed/default roster foundation.

## Staff workflow

The Staff area now lists Open rounds 1–8 with their publication status (`draft`, `ready`, `published`). Each round opens a dedicated protected page.

A round editor can manage:

- opponent team;
- scheduled start, entered as Vilnius local time;
- course/location;
- starting hole;
- six Open roster slots (`MPO1..MPO4`, `FPO1..FPO2`);
- one private internal Staff note.

When a round has no specific roster yet, the editor is initialized from the current Default Match Roster Open. Staff can also explicitly reset the editor to the default roster.

## Validation

Server-side validation is authoritative:

- only Admin/Staff sessions may save;
- only France Open registered players may be assigned;
- FPO slots require a player whose PDGA gender is known as F;
- duplicate player assignments are rejected;
- `ready` requires opponent + all six roster slots;
- `published` requires the same plus a scheduled start.

Course and starting hole remain optional while those details are not official.

## Publication

A round can move through:

`draft -> ready -> published`

Publishing records `publishedAt` and `publishedBy`. Reverting to draft or ready clears publication metadata so the round is no longer considered published.

The embedded round roster is part of the publicable round document. Internal notes remain in `competitionRounds/{roundId}/staffNotes/france`, which stays Staff/Admin-only under Firestore rules.

## Player visibility dependency

This update deliberately does not expose all published Open rounds in `/player-area`, because the product requirement is that a player should only see information relevant to their own match. The next access-control step must bind a Firebase Auth player account to a WTDGC `personId`/division before rendering published match data in the player area.
