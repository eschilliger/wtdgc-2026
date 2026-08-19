# 2026-08-19 — Round Matchups V1

Staff round preparation now includes a flexible matchup layer without hardcoding an official WTDGC round formula.

- A round can contain an ordered list of matchups.
- Each matchup is either `single` or `double`.
- Staff assigns France players from the selected six and opponent players from the simulated active opponent six.
- Matchups are stored directly on the competition round as `matchups` with `id`, `order`, `format`, `francePlayerIds`, and `opponentPlayerIds`.
- Draft rounds may contain incomplete matchup cards while they are being prepared.
- Ready/published rounds reject partially filled matchup cards. Zero matchup cards remains valid until the official competition formula is finalized.
- The player area exposes only published matchup assignments involving the linked player.
- Substitutes continue to see the published round even when no matchup is assigned to them.
- Staff notes and internal simulation data remain excluded from the player view.
