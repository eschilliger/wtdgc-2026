# 2026-08-18 — Admin access foundation

This note complements `PROJECT_CONTEXT.md` with the authentication/authorization decisions implemented after the staff/player foundation.

## Application roles

The app now uses three Firebase Auth custom-claim roles:

- `admin`: user/access administration plus staff-level competition access;
- `staff`: roster preparation, internal notes and round publication workflows;
- `player`: read-only player experience for published match information.

An admin inherits staff access for competition data. Players never inherit staff access.

## Admin V1

The protected `/admin` route is server-authorized and lists Firebase Auth users. It shows email, display name/UID, providers, enabled/disabled state and current WTDGC role.

An admin can assign `admin`, `staff` or `player` to another account. The route that mutates roles is protected by the server Firebase session and checks the `admin` custom claim; it does not rely on client-side hiding. Admins cannot change their own role from the Admin UI, to reduce accidental lockout risk.

Role changes preserve unrelated existing custom claims, update the `appUsers/{uid}` audit document, and revoke the target user's refresh tokens so the user must sign in again before using the new role.

## Bootstrap / recovery

The GitHub Actions workflow `Manage WTDGC user role` remains available as an administrative bootstrap/recovery mechanism and now supports `admin`, `staff` and `player`. It also revokes existing sessions after changing a role.

The first administrator therefore must still be bootstrapped with this workflow. After that, routine role administration should use `/admin`.

## Login routing

After Firebase login and creation of the secure server session:

- `admin` -> `/admin`
- `staff` -> `/staff`
- `player` -> `/player-area`
- no role -> `/login?status=role-required`

The server session remains an `httpOnly` Firebase Admin session cookie. Protected server routes validate it with revocation checking.

## Firestore security

Firestore rules treat `admin` as having staff-level access to competition preparation data (`competitionRounds`, round rosters, `staffNotes`, and `defaultMatchRosters`). Player access remains restricted to published round data and excludes staff notes/default roster preparation data.

The Admin UI itself uses Firebase Admin SDK server-side and is therefore also protected by explicit Next.js server-role checks, since Admin SDK bypasses Firestore Security Rules.
