# WTDGC 2026 — Competition rounds & Default Match Roster foundation

Date: 2026-08-18

## Source fonctionnelle

Le document `WTDGC 2026 - Competition Format Basics` confirme notamment :

- 8 rounds par division ;
- rounds 1 à 6 en système suisse ;
- Round 1 déterminé par le seeding initial ;
- rounds suivants principalement déterminés par les résultats ;
- chaque match contient 4 games : 2 Singles + 2 Doubles en modified alternate-shot ;
- scoring game : victoire 2, nul 1, défaite 0 ;
- scoring match : victoire 2, nul 1, défaite 0 ;
- chaque équipe soumet un Default Match Roster avant le championnat ;
- avant chaque match, le capitaine confirme ce roster ou soumet un roster spécifique ;
- deadline roster : 60 minutes avant le début du round.

## Limite importante Masters

Nous ne savons pas encore quels joueurs des équipes Masters sont éligibles MP40 / MP50 / FP40.

Règle impérative :

- ne jamais déduire automatiquement MP40 ou MP50 depuis le rating, le genre ou le rang ;
- conserver ces éligibilités comme inconnues jusqu'à une source officielle ou une saisie capitaine fiable ;
- ne pas activer un moteur de roster Masters complet avant résolution de ces éligibilités.

## Modèle Firestore préparé

Sous `events/wtdgc-2026` :

- `competitionRounds/{division}-r{1..8}` : 16 documents, 8 Open + 8 Masters ;
- `defaultMatchRosters/open` ;
- `defaultMatchRosters/masters`.

Les documents de round contiennent uniquement les informations déjà fiables : stage, mode de pairing, nombre/type de games, scoring, délai de roster. Les champs adversaire, horaire, course, starting hole et roster restent `null` tant qu'ils ne sont pas officiels.

Les Default Match Rosters sont créés comme placeholders vides en statut `draft`. Le script de seed ne remplace jamais un Default Match Roster existant afin de protéger une future sélection du staff.

## Workflow

Workflow manuel : `Seed WTDGC competition structure`.

Il est idempotent :

- les 16 documents de round sont synchronisés avec `merge: true` ;
- les Default Match Rosters existants sont préservés ;
- aucun joueur n'est sélectionné automatiquement.

## Suite prévue

1. Exécuter le workflow de seed une fois.
2. Vérifier les sous-collections dans Firestore.
3. Construire ensuite l'interface de Default Match Roster, d'abord avec les informations sûres.
4. Open pourra être avancé plus tôt ; Masters restera bloqué sur les positions MP40/MP50 tant que les éligibilités ne sont pas connues.
5. Ajouter les formules Singles/Doubles round par round uniquement après publication du Participant Guide.
