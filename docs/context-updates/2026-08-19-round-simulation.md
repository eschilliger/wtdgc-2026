# 2026-08-19 — Round preparation parity with Comparator

The Staff round editor now treats the Comparator as the shared analysis engine rather than a separate UI.

- Open and Masters rounds are accessible from Staff, with R1–R8 navigation for each division.
- France uses an explicit six-player selection (4 men + 2 women) for the operational round roster.
- The opponent uses the Comparator-style availability simulation: staff can disable/reactivate opposing players and the active six is recalculated automatically.
- The opponent scenario is persisted on the round as `opponentScenario.disabledPlayerIds`.
- The round displays the same composition summary and player-by-player six comparison as the Comparator.
- The local logout button was removed from round pages; logout belongs only to the global authenticated navigation.
- The H/F marker is rendered by CSS pseudo-content only; the React component no longer duplicates the H/F text in its DOM.
- Masters selection intentionally remains at the six-player scenario level (4 men + 2 women). MP40/MP50 eligibility assignments are not inferred because they are not yet reliably known.
