# Contexte — automatisation mensuelle des ratings PDGA

Date de référence : 12/08/2026.

Ce document complète `PROJECT_CONTEXT.md` avec les décisions et évolutions validées après la PR #47 concernant la synchronisation mensuelle des ratings PDGA.

## Objectif

Automatiser la mise à jour mensuelle des ratings PDGA pour le projet WTDGC 2026, avec détection de la publication réelle, synchronisation Firestore idempotente, recalcul des métriques de scouting et envoi d'un unique mail récapitulatif à `eschilliger@gmail.com`.

## Déclenchement

Workflow GitHub Actions : `Monthly PDGA ratings sync`.

Règles :

- le deuxième mardi du mois ;
- première vérification à 09:00 heure de Paris ;
- nouvelles vérifications horaires tant que la nouvelle `rating_effective_date` n'est pas publiée ;
- une exécution manuelle via `workflow_dispatch` reste possible ;
- une fois le mois totalement traité et le mail envoyé, les exécutions suivantes doivent devenir des no-op.

La détection se fait sur la date effective réellement retournée par la PDGA, pas uniquement sur le calendrier supposé de publication.

## Synchronisation sélective et idempotente

La première version du workflow réimportait tous les profils puis forçait le téléchargement de tout l'historique public. Plusieurs exécutions du 11/08/2026 ont échoué parce que certains joueurs n'avaient pas d'historique public exploitable.

La logique validée depuis la PR #49 est désormais sélective, joueur par joueur :

1. récupérer le profil PDGA courant ;
2. comparer le rating et `rating_effective_date` avec Firestore ;
3. vérifier si `ratingHistory/{effectiveDate}` existe déjà ;
4. si tout est à jour, ne rien réécrire ;
5. si le profil courant est obsolète, le mettre à jour ;
6. si l'entrée mensuelle d'historique manque, la créer directement avec les données de l'API PDGA ;
7. ne pas télécharger la page publique Ratings History pour la mise à jour mensuelle ;
8. ignorer proprement les joueurs sans rating/date applicable ;
9. collecter les vraies erreurs API sans interrompre immédiatement toute la passe.

Conséquence importante : si une exécution échoue au joueur 112, une relance peut repartir de la liste complète, mais les joueurs 1–111 déjà conformes sont seulement contrôlés puis immédiatement sautés. Il n'y a ni duplication d'historique ni réimport lourd inutile.

Un rating identique au mois précédent doit quand même produire une nouvelle entrée d'historique si la `rating_effective_date` du mois est nouvelle.

## Firestore et reprise

Le log mensuel est identifié par `pdga-monthly-YYYY-MM-DD` dans `syncLogs`.

États importants :

- avant finalisation : synchronisation encore à faire ou partielle ;
- `data-synced` : données et rapport prêts, mais email pas encore confirmé ;
- `email-sent` : cycle mensuel terminé.

Si l'envoi du mail échoue après `data-synced`, une nouvelle exécution ne doit pas refaire la synchronisation PDGA ; elle doit reconstruire le rapport si nécessaire et retenter l'email.

## Rapport mensuel

Un seul email récapitulatif est prévu par mise à jour mensuelle.

Le rapport doit contenir au minimum :

- date effective PDGA ;
- nombre de joueurs/profils contrôlés ;
- nombre déjà à jour ;
- profils mis à jour ;
- entrées d'historique créées/réparées ;
- erreurs éventuelles ;
- ratings modifiés / inchangés ;
- hausses / baisses ;
- plus forte hausse / baisse ;
- détail France Open ;
- détail France Masters.

Les vérifications horaires avant publication n'envoient aucun mail.

## Envoi email — état actuel

Resend a été abandonné après des erreurs `422 The domain is invalid` avec `resend.dev`, l'utilisateur ne disposant pas d'un domaine personnalisé.

Depuis la PR #50, l'envoi passe par Gmail SMTP :

- serveur `smtp.gmail.com` ;
- TLS sur le port 465 ;
- expéditeur `eschilliger@gmail.com` ;
- destinataire `eschilliger@gmail.com` ;
- authentification via un mot de passe d'application Google ;
- secret GitHub requis : `GMAIL_APP_PASSWORD`.

Ne jamais demander ni exposer la valeur de ce secret.

`RESEND_API_KEY` et `PDGA_REPORT_FROM` ne sont plus utilisés par le workflow mensuel.

Au moment de cette sauvegarde, la PR #50 est fusionnée sur `main` et le build a été vérifié avec succès. La configuration restante côté utilisateur est la création d'un mot de passe d'application Google et son ajout dans GitHub sous le nom exact `GMAIL_APP_PASSWORD`, puis un nouveau test manuel du workflow.

## PR de référence

- PR #48 — `Automate monthly PDGA ratings sync and email report` : création du workflow mensuel, détection réelle de publication, retries et rapport.
- PR #49 — `Make monthly PDGA sync selective and resumable` : synchronisation sélective/idempotente et suppression du besoin de télécharger l'historique public pendant la mise à jour mensuelle.
- PR #50 — `Send monthly PDGA report through Gmail SMTP` : remplacement de Resend par Gmail SMTP.

Commits de merge connus :

- PR #48 : `e0920341e8ece32751054bbd5354e096f1ec44df`
- PR #49 : `e360f5583d3313c4c38294dbfc3407950a6ac507`
- PR #50 : `b47cf63b268730b74b43dd10cd9f017b86f35679`

## Règles à préserver

- ne jamais refaire un import lourd si Firestore contient déjà la publication mensuelle correcte ;
- privilégier la date effective PDGA comme clé de contrôle ;
- conserver l'historique mensuel même si la valeur du rating ne change pas ;
- rendre toute relance sûre et peu coûteuse ;
- un seul mail récapitulatif par publication mensuelle réussie ;
- ne marquer le cycle `email-sent` qu'après confirmation d'envoi ;
- conserver `Verify build` au vert avant toute fusion future modifiant ce workflow.
