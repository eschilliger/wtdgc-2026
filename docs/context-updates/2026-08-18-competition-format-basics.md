# WTDGC 2026 — Competition Format Basics — decisions du 18/08/2026

Source : document organisation `WFDF 2026 World Team Disc Golf Championships — Competition Format Basics`.

## Décisions désormais sûres

- Le rating de référence pour l'Internal Team Player Ranking est le rating PDGA officiel issu de la mise à jour d'août 2026.
- Dans le projet, la date de référence utilisée pour ce snapshot est `2026-08-11`.
- Ce rating WTDGC doit rester figé même quand le rating PDGA courant évoluera ensuite.
- En cas d'égalité de rating, l'ordre relatif doit être déterminé par le Team Captain puis rester fixe pendant le championnat.
- Les équipes peuvent choisir n'importe quels six joueurs éligibles pour un match ; une fois les six choisis, leurs positions suivent l'Internal Team Player Ranking.
- Open : positions `MPO1`, `MPO2`, `MPO3`, `MPO4`, `FPO1`, `FPO2`.
- Masters : positions `MP40-1`, `MP40-2`, `MP40-3`, `FP40-1`, `FP40-2`, `MP50`.
- Le projet ne connaît pas encore de manière fiable l'éligibilité individuelle MP40 / MP50 des joueurs Masters. **Ne pas la déduire automatiquement** à partir du rating, du rang, du genre ou d'une hypothèse d'âge tant qu'une source fiable n'est pas intégrée.
- Chaque division joue 8 rounds. Les rounds 1 à 6 utilisent le système suisse. Après R6, la route dépend du classement : top 4 vers medal play-offs ; autres équipes vers R7 supplémentaire puis matches de classement R8.
- Les combinaisons exactes Singles / Doubles de chaque round ne sont pas encore connues. Ne pas les inventer.
- Un Default Match Roster est prévu, avec possibilité de roster spécifique par round ; deadline annoncée : 60 minutes avant le départ du round.

## Implémentation V1 lancée

- Nouveau modèle de domaine : `src/domain/wtdgc/competition.ts`.
- Constante `WTDGC_REFERENCE_RATING_DATE = "2026-08-11"`.
- Types d'éligibilité explicites `MPO`, `FPO`, `MP40`, `FP40`, `MP50`, avec source pouvant rester `unknown`.
- Slots Open et Masters modélisés sans moteur automatique Masters tant que MP40/MP50 n'est pas fiable.
- Modèle des 8 rounds créé sans formules Singles/Doubles prématurées.
- Modèles préparatoires `WtdgcMatchRoster` et `WtdgcRoundMatch` ajoutés.
- L'écran de comparaison peut utiliser un rating WTDGC figé stocké sur `pdgaProfiles` ; pendant la transition, le rating courant est accepté seulement si sa `ratingEffectiveDate` vaut encore `2026-08-11`.
- Script one-shot `scripts/snapshot-wtdgc-reference-ratings.ts` pour copier `ratingHistory/2026-08-11` vers le profil :
  - `wtdgcReferenceRating`
  - `wtdgcReferenceRatingDate`
  - `wtdgcReferenceRatingSource`
  - `wtdgcReferenceRatingSnapshottedAt`
- Workflow manuel `Snapshot WTDGC reference ratings` ajouté pour exécuter ce snapshot avec le service account Firebase existant.

## À attendre avant moteur complet de roster

- règle/source officielle d'éligibilité individuelle MP40/MP50 ;
- éventuel traitement officiel des joueurs sans rating ;
- tie-break capitaine pour ratings identiques ;
- combinaisons exactes Singles / Doubles pour chacun des 8 rounds ;
- procédures détaillées de Swiss Manager / tie-breaks ;
- course, starting hole et publication officielle des pairings.
