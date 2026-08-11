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

1. enrichissement de tous les profils PDGA par lots de 100 ;
2. import forcé de l'historique rating par lots de 50 ;
3. recalcul des `scoutingMetrics` ;
4. construction d'un rapport statistique ;
5. écriture d'un log `syncLogs/pdga-monthly-YYYY-MM-DD` ;
6. envoi du rapport par email ;
7. passage du log au statut `email-sent`.

Le statut intermédiaire `data-synced` évite de refaire toute la synchronisation si seul l'envoi d'email échoue : les exécutions suivantes retentent uniquement le rapport/email.

## Rapport email

Le rapport contient :

- date effective PDGA ;
- nombre total de profils ;
- nombre de profils ayant la nouvelle date ;
- nombre de ratings modifiés / inchangés ;
- nombre de hausses / baisses ;
- plus forte hausse / baisse ;
- détail France Open ;
- détail France Masters.

## Configuration email

L'envoi utilise Resend afin de ne jamais stocker un mot de passe Gmail dans le repository.

Secret GitHub requis :

- `RESEND_API_KEY`

Variable GitHub optionnelle :

- `PDGA_REPORT_FROM` — expéditeur vérifié chez Resend.

Si la variable n'est pas définie, le script utilise `WTDGC Scout <onboarding@resend.dev>` ; selon les restrictions du compte Resend, un domaine/expéditeur vérifié peut être nécessaire pour envoyer vers une adresse externe.

Le destinataire est configuré comme `eschilliger@gmail.com`.
