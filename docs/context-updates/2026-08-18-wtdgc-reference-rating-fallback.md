# WTDGC 2026 — fallback du rating de référence

Décision validée le 18/08/2026.

Le rating WTDGC reste figé sur la date de référence du 11/08/2026. Si un joueur possède une entrée `ratingHistory/2026-08-11`, cette valeur est utilisée.

Si aucune entrée n'existe exactement au 11/08/2026, mais qu'un historique PDGA antérieur est disponible, le snapshot doit utiliser le **dernier rating connu à une date inférieure ou égale au 11/08/2026**.

Il ne faut jamais utiliser un rating postérieur au 11/08/2026 pour calculer le rating WTDGC de référence.

Le profil conserve désormais deux dates distinctes :

- `wtdgcReferenceRatingDate`: la date de référence officielle WTDGC (`2026-08-11`) ;
- `wtdgcReferenceRatingObservedDate`: la date réelle du rating PDGA retenu.

La source permet également de distinguer :

- `pdga-august-2026` pour une entrée exactement au 11/08/2026 ;
- `pdga-history-before-reference-date` pour le dernier rating antérieur utilisé en fallback.

Le workflow de snapshot reste relançable. Les joueurs déjà snapshotés avec un `wtdgcReferenceRatingObservedDate` sont ignorés ; les anciens snapshots sans ce champ sont enrichis lors de la prochaine exécution.

Cette règle répond notamment au cas d'un joueur qui n'a pas reçu de nouvelle ligne de rating lors de la publication d'août mais qui possédait déjà un rating officiel avant la date de référence.
