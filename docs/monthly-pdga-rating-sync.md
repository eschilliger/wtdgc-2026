# Monthly PDGA Ratings Sync

## Objectif

Automatiser la mise à jour des ratings PDGA à partir du deuxième mardi du mois, avec démarrage à 09:00 heure de Paris, retries horaires tant que la publication PDGA n'est pas détectée, puis confirmation par email à `eschilliger@gmail.com`.

## Workflow

GitHub Actions : `.github/workflows/monthly-pdga-ratings.yml`

Le cron tourne chaque mardi entre 07:00 et 20:00 UTC. Le script de détection applique ensuite les règles Europe/Paris :

- uniquement le deuxième mardi (jour 8 à 14) ;
- pas avant 09:00 heure locale ;
- détection réelle de la nouvelle `rating_effective_date` via plusieurs joueurs sonde ;
- retry horaire si la publication n'est pas encore disponible ;
- arrêt immédiat si le mois a déjà été traité et l'email envoyé.

Une exécution manuelle via `workflow_dispatch` est également possible.

## Chaîne de traitement

Quand la nouvelle date effective est détectée :

1. contrôle joueur par joueur de l'état Firestore ;
2. mise à jour sélective du profil PDGA uniquement si nécessaire ;
3. création/réparation de `ratingHistory/{effectiveDate}` uniquement si l'entrée mensuelle manque ;
4. recalcul des `scoutingMetrics` ;
5. construction d'un rapport statistique ;
6. écriture d'un log `syncLogs/pdga-monthly-YYYY-MM-DD` ;
7. envoi du rapport par email ;
8. passage du log au statut `email-sent`.

Le statut intermédiaire `data-synced` évite de refaire toute la synchronisation si seul l'envoi d'email échoue : les exécutions suivantes retentent uniquement le rapport/email.

La synchro est idempotente : les joueurs déjà à jour sont contrôlés puis ignorés, sans réimport inutile de l'historique public PDGA.

## Rapport email

Le rapport contient notamment :

- date effective PDGA ;
- nombre total de profils ;
- nombre de profils ayant la nouvelle date ;
- nombre de ratings modifiés / inchangés ;
- nombre de hausses / baisses ;
- plus forte hausse / baisse ;
- statistiques de synchro sélective ;
- détail France Open ;
- détail France Masters.

## Configuration email

L'envoi utilise Gmail SMTP (`smtp.gmail.com`, port 465, TLS) avec l'adresse `eschilliger@gmail.com` comme expéditeur et destinataire.

Le mot de passe normal du compte Google ne doit jamais être utilisé. Il faut créer un **mot de passe d'application Google** dédié au workflow et le stocker dans GitHub Actions.

Secret GitHub requis :

- `GMAIL_APP_PASSWORD` — mot de passe d'application Google à 16 caractères/chiffres généré depuis le compte Google.

La validation en deux étapes doit être activée sur le compte Google pour pouvoir créer un mot de passe d'application.

Le script n'ajoute aucune dépendance npm spécifique : la connexion SMTP TLS est réalisée avec les modules Node.js natifs.

Les anciennes valeurs Resend (`RESEND_API_KEY`, `PDGA_REPORT_FROM`) ne sont plus utilisées par ce workflow et peuvent être supprimées une fois l'envoi Gmail validé.
