# Staff / player access and round publication foundation — 2026-08-18

## Product decision

Sensitive competition data must be separated from player-facing data.

Roles:
- `staff`: authenticated, can prepare and edit rosters, rounds and internal notes;
- `player`: authenticated, read-only access to player-facing round information after staff publication.

Round lifecycle:
- `draft`: staff work in progress, invisible to players;
- `ready`: composition/information prepared but not yet communicated, invisible to players;
- `published`: validated by staff and player-readable.

Publishing must later record `publishedAt` and `publishedBy`.

## Firestore structure

Public/player-facing round data:
`events/wtdgc-2026/competitionRounds/{roundId}`

Round-specific rosters:
`events/wtdgc-2026/competitionRounds/{roundId}/rosters/{rosterId}`

Private staff notes:
`events/wtdgc-2026/competitionRounds/{roundId}/staffNotes/{noteId}`

Default rosters remain staff preparation data:
`events/wtdgc-2026/defaultMatchRosters/{division}`

## Security rules

`firestore.rules` introduces Firebase Auth custom-claim checks:
- `role=staff`: access to unpublished rounds, rosters and staff notes, with writes allowed;
- `role=player`: only published rounds and their round-specific rosters, read-only;
- `staffNotes`: never readable by players;
- default rosters: staff-only.

Existing scouting collections (`teams`, `players`, `registrations`, `pdgaProfiles` and public rating/stat subcollections) stay client-readable and client-write-blocked.

All unlisted client access is denied.

## Critical server-side security note

The application currently reads Firestore server-side using the Firebase Admin SDK. Admin SDK access bypasses Firestore Security Rules.

Therefore Firestore rules alone are NOT sufficient for future staff/player pages implemented through Next.js server code. Any server route/page/API that reads sensitive data must verify the Firebase ID token and role before calling Admin SDK repositories, and player-facing server reads must explicitly enforce `publicationStatus == published` and never load `staffNotes`.

No sensitive UI should be implemented until this server-side authorization layer is wired into the authenticated routes.

## Role management

Workflow: `Manage WTDGC user role`.

It accepts an existing Firebase Auth user's email and assigns custom claim `role=staff` or `role=player`. It also mirrors the role to `appUsers/{uid}` for audit/administration. The claim remains the authorization source of truth.

After a role change, the user must refresh/re-authenticate so Firebase issues a token containing the new custom claim.

## Operational workflows

- `Deploy Firestore rules`: deploys `firestore.rules` to project `wtdgc-2026` using `FIREBASE_SERVICE_ACCOUNT`.
- `Initialize round publication status`: adds `publicationStatus=draft`, `publishedAt=null`, `publishedBy=null` to existing round documents that do not already have a valid status.
- `Manage WTDGC user role`: assigns staff/player claims to existing Firebase Auth accounts.

## Deliberately not implemented yet

- login/sign-up UI;
- server session/cookie handling;
- staff roster editor;
- player match screen;
- publish button and publication audit action;
- automatic player-to-person/PDGA linkage;
- per-player filtering of published match details;
- MP40/MP50 inference.

Those belong to the next authenticated UI/server authorization lot.
