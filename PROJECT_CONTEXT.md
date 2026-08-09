# WTDGC 2026 — Project Context

Ce document est la référence fonctionnelle, UX et technique du projet **WTDGC 2026 Scout**. Il doit être consulté avant toute évolution significative afin d’éviter de reposer les mêmes questions ou de casser des décisions déjà validées.

## 1. Objectif

Créer une application web de scouting et d’analyse pour les **World Team Disc Golf Championships 2026** à Vilnius / Lituanie, avec un focus particulier sur **l’équipe de France**.

L’application doit permettre de :

- consulter les équipes et joueurs engagés ;
- enrichir les joueurs avec les données PDGA ;
- comparer deux nations d’une même catégorie ;
- simuler des absences et recompositions ;
- analyser les ratings actuels et historiques ;
- préparer à terme les confrontations / rounds WTDGC ;
- servir d’outil opérationnel pour le staff France.

## 2. Stack et infrastructure

- Next.js 15.5.7
- React 19
- TypeScript
- Firebase / Firestore
- Firebase App Hosting
- GitHub + GitHub Actions
- Node 24.x

Repository : `eschilliger/wtdgc-2026`

Branche principale : `main`

Firebase project ID : `wtdgc-2026`

App Hosting : région `europe-west4`, backend `wtdgc-2026`

URL publique : `wtdgc-2026--wtdgc-2026.europe-west4.hosted.app`

Secrets GitHub existants :

- `FIREBASE_SERVICE_ACCOUNT`
- `PDGA_API_USERNAME`
- `PDGA_API_PASSWORD`

Ne jamais demander ni exposer leurs valeurs.

## 3. Workflow de travail

Pour les évolutions significatives :

1. synthétiser la demande et proposer le plan ;
2. attendre validation explicite (`Go`, `OK`, `Vas-y`, etc.) ;
3. créer une branche dédiée ;
4. implémenter ;
5. ouvrir une PR ;
6. attendre `Verify build` au vert ;
7. pour une évolution UI, contrôler le rendu réel autant que possible ;
8. merger seulement après validation technique.

Workflow GitHub Actions permanent : **Verify build**

- `npm ci`
- `npm run typecheck`
- `npm run build`

Règle importante : **un build vert ne suffit pas à valider une évolution UI**. Le rendu doit aussi correspondre à ce qui a été annoncé.

## 4. Modèle de données Firestore

Collections principales :

- `events`
- `teams`
- `players`
- `registrations`
- `syncLogs`
- `pdgaProfiles`

Sous-collections :

- `yearlyStats`
- `ratingHistory`

Future :

- `staffNotes`

Le projet doit conserver l’historique des ratings, pas seulement le rating courant.

## 5. Données WTDGC et PDGA

Source WTDGC publique : dashboard officiel des inscriptions.

Ordre de grandeur actuel :

- 47 équipes ;
- ~399 lignes joueurs dans la source initiale ;
- ~463 registrations / membres ;
- ~398 profils joueur/rôle enrichis PDGA.

Le client PDGA gère notamment :

- profil joueur ;
- statistiques annuelles ;
- rating ;
- historique de rating ;
- statut membership ;
- statut officiel ;
- classification ;
- localisation ;
- genre.

## 6. Genre joueur

Genre normalisé :

- `M`
- `F`

Ordre de résolution :

1. statistiques PDGA annuelles ;
2. page publique PDGA ;
3. fallback `M` si non résolu.

`genderSource` peut prendre :

- `profile`
- `yearly-stats`
- `default-m`

Le fallback masculin est volontaire pour rester compatible avec les divisions ouvertes.

## 7. Rating équipe et six actif

Règle équipe : **4 hommes + 2 féminines**, les mieux classés selon le rating de référence.

Le rating équipe est la moyenne de ces 6 joueurs.

Rating de référence actuel :

`referenceRating ?? rating PDGA`

À terme, les données officielles WTDGC doivent devenir prioritaires :

- `referenceRating`
- `officialRank`
- `ratingSource`

Le staff recevra ultérieurement une date officielle de rating de référence et pourra attribuer un rating capitaine aux joueurs sans rating.

## 8. Simulation de composition

La simulation permet de rendre des joueurs indisponibles.

Règles métier :

- l’ordre visuel de la liste reste fixe ;
- les rangs J1 à J6 sont recalculés ;
- un joueur désactivé reste à sa position visuelle ;
- remplacement strict par genre ;
- homme → homme ;
- féminine → féminine ;
- un remplaçant peut également être désactivé.

Le toggle exprime donc **la disponibilité dans le scénario**, pas le statut titulaire/remplaçant.

## 9. Ordre du comparateur

Ordre validé :

1. sélecteurs d’équipes ;
2. Équipe A / Équipe B et leurs scénarios ;
3. **Simulation de composition** ;
4. **Lecture du six**.

La simulation doit résumer les conséquences après modification des deux scénarios, pas avant.

## 10. Bandeau d’état équipe

Un seul emplacement d’état doit être utilisé pour éviter les sauts de layout :

- état normal → jaune `Six actif` ;
- scénario modifié → bleu `Scénario modifié` ;
- composition impossible → rouge / erreur ;
- reset → retour à `Six actif`.

Le slot reste stable, seul son contenu et sa couleur changent.

## 11. Statuts joueurs

Desktop :

- `Titulaire`
- `Remplaçant`
- `Indisponible`

Mobile :

- `Titulaire`
- `Remplaçant`
- `Indispo`

Toujours avec une seule majuscule initiale, jamais tout en capitales.

Palette retenue :

### Titulaire
- fond `#CDEEDC`
- texte `#0B5F3A`
- bordure `#7FCDA5`

### Remplaçant
- fond `#DCE5EE`
- texte `#40556B`
- bordure `#AEBDCC`

### Indispo
- fond `#F4D6D9`
- texte `#8F2630`
- bordure `#DF9FA6`

Le statut ne doit jamais reposer uniquement sur la couleur.

## 12. Genre dans les cards mobiles

Les pictogrammes silhouettes ont été abandonnés.

Choix validé :

- homme : `H` dans un carré arrondi ;
- féminine : `F` dans un cercle.

La différence doit être perceptible par la **forme**, pas uniquement par la couleur, pour rester accessible aux utilisateurs daltoniens.

Le marqueur H/F est placé en bas de la colonne de rang, en opposition avec J1 / réf. #1.

## 13. Cards joueur mobile / paysage

Structure cible :

- colonne gauche : rang, référence, H/F ;
- zone principale : nom ;
- statut + toggle regroupés ;
- Rating ;
- Évolution 12 mois.

Le rating doit être visuellement dominant.

Le bouton `Infos` a été supprimé.

Le toggle n’a pas de label `Actif`.

Le groupe `statut + toggle` doit rester aligné horizontalement avec un vrai gap visible.

## 14. Responsive

Trois régimes :

### Mobile portrait

- cartes mobiles ;
- équipes empilées ;
- indication sous les sélecteurs :
  `↻ Astuce : tournez votre téléphone en paysage pour comparer les deux équipes côte à côte.`

### Mobile paysage / tablette compacte

- traité comme un **desktop compact / hybride** ;
- deux équipes côte à côte ;
- structure joueur inspirée du mobile ;
- pas de bouton `Désactiver`, utiliser le toggle ;
- ne pas afficher `Homme · PDGA #...` dans les mini-cards si cela surcharge ;
- conserver nom, rang, statut, rating et évolution.

### Desktop

- comparaison complète en deux colonnes ;
- lignes joueur plus horizontales.

Le mode paysage/tablette est actuellement ciblé principalement entre 600 et 1024 px.

## 15. Simulation de composition — présentation

Le bloc doit être placé après les deux équipes et avant `Lecture du six`.

Espacement vertical autour du bloc :

- desktop : 20 px ;
- tablette / paysage compact : 18 px ;
- mobile portrait : 16 px.

Éviter tout cumul parasite avec `margin-top` de `Lecture du six`.

Les 5 KPI doivent rester **sur une seule ligne en tablette / paysage** :

- Écart scénario
- Écart référence
- Écart hommes
- Écart féminines
- Dynamique 12 mois

Sur les plus petites largeurs tablette, réduire padding / typo secondaire plutôt que casser en plusieurs lignes.

## 16. Aide de simulation

Le bouton `i` ouvre un vrai popover interactif.

Contenu :

- Écart scénario : différence avec les absences actuellement simulées ;
- Écart référence : différence sans aucune absence ;
- Écart hommes : comparaison des moyennes des 4 hommes retenus ;
- Écart féminines : comparaison des moyennes des 2 féminines retenues ;
- Dynamique 12 mois : différence entre les évolutions moyennes récentes.

Le popover :

- s’ouvre au clic ;
- se ferme via `×` ou clic extérieur ;
- ne doit jamais être clippé par la card ;
- doit passer au-dessus des autres éléments ;
- doit rester dans le viewport ;
- peut scroller en interne si nécessaire.

La correction de clipping a été faite dans la PR #46.

## 17. Lecture du six

Le bloc compare J1 vs J1, J2 vs J2, etc. sur le six actif recalculé.

Affiche :

- joueur ;
- rating ;
- évolution ;
- écart de rating.

Les écarts doivent être très lisibles :

- avantage équipe A → vert soutenu `#15803d`, texte blanc ;
- avantage équipe B → rouge soutenu `#be123c`, texte blanc ;
- signe `+` / `-` toujours présent pour ne pas dépendre uniquement de la couleur.

## 18. Système typographique

Tokens sémantiques retenus :

```css
--text-primary: #123968;
--text-body: #17202a;
--text-secondary: #748193;
--text-muted: #8995a3;
--text-link: #1d4f8c;
--text-positive: #166534;
--text-negative: #9f1239;
--text-warning: #7e581c;
```

Usage :

- `text-primary` : rang, prénom/nom, rating, valeurs fortes ;
- `text-secondary` : genre, PDGA #, labels, dates ;
- `text-muted` : informations de troisième niveau ;
- vert/rouge : uniquement quand la couleur porte une information fonctionnelle.

Règle : **J1, prénom/nom et rating doivent partager la même teinte principale**.

## 19. Tendances rating

Dans les cards joueurs :

- `+16 ↗`
- `-19 ↘`
- `+2 →`

Ne pas ajouter `stable`, `en hausse`, `en baisse` dans les cards joueurs.

## 20. Profondeur du banc

Rester factuel.

Exemples :

- `Hommes −11` / `4e → 5e`
- `Aucun remplaçant` / `pas de 3e féminine`

Éviter les qualificatifs subjectifs.

## 21. Player Detail

Route : `/player/[pdgaNumber]`

Contenu :

- identité ;
- genre ;
- classification ;
- adhésion PDGA ;
- statut officiel ;
- ancienneté observée ;
- localisation ;
- dernière synchro ;
- historique rating ;
- statistiques saison.

`Ancienneté PDGA observée` est basée sur le plus ancien historique disponible, sans prétendre connaître la vraie date d’inscription.

## 22. Profil PDGA et historique rating

Les valeurs fortes du profil PDGA utilisent la couleur principale.

En paysage/tablette :

- réduire la taille des valeurs et labels par rapport au desktop ;
- privilégier la place du graphe sans surdimensionner le graphique ;
- les 5 KPI d’évolution doivent rester sur une ligne si la largeur le permet ;
- le graphe doit rester compact, autour de ~155 px dans le mode paysage actuel.

Périodes du graphe :

- 6 mois
- 1 an
- 3 ans
- Tout

## 23. Scouting metrics pré-calculées

Dans `pdgaProfiles` :

- latestRating
- rating3MonthsAgo
- rating6MonthsAgo
- rating12MonthsAgo
- trends

Workflow : `Compute PDGA scouting metrics`.

## 24. Futurs rounds WTDGC

Pas encore à construire tant que les détails officiels ne sont pas disponibles.

L’architecture doit rester compatible avec des rounds comprenant potentiellement :

- numéro du round ;
- formule de matchup ;
- tee-off ;
- course ;
- tee ;
- lieu.

Exemples de formules envisagées : J1+J6, J3+J4, J2 single, J5 single.

## 25. Vocabulaire UI

Utiliser :

- `hommes`
- `féminines`
- `rating WTDGC`

Éviter :

- `masculins`
- `référence WTDGC`

## 26. Principes UX

L’interface doit rester :

- aérée ;
- rapide à scanner ;
- lisible sur mobile ;
- adaptée au paysage/tablette ;
- sans doublons ;
- sans pictogrammes ambigus ;
- accessible aux utilisateurs daltoniens.

Une information importante doit être visible sans effort.

Une couleur ne doit jamais être le seul vecteur d’information.

## 27. Dette CSS connue

Le projet possède encore plusieurs feuilles CSS versionnées / historiques (`v32`, `v41`, `v42`, `v45`, `v49`, `v410`, `v411`, paysage, etc.).

Le principal risque est la **cascade CSS** : plusieurs bugs visuels récents venaient de règles correctes mais écrasées ensuite par des imports plus tardifs.

Avant toute correction UI :

1. rechercher toutes les règles concernées ;
2. vérifier l’ordre des imports ;
3. identifier la règle réellement gagnante ;
4. éviter d’empiler des overrides sans compréhension ;
5. contrôler le rendu final.

Une consolidation CSS future serait utile.

## 28. Sécurité / maintenance

Next.js 15.5.7 et `npm ci` ont déjà remonté des vulnérabilités. Ce chantier n’a pas encore été traité.

À planifier séparément, sans le mélanger avec les évolutions UX.

## 29. Référence actuelle

Ce fichier doit être maintenu à jour à chaque décision fonctionnelle ou UX structurante.

Dernières évolutions notables au moment de sa création :

- mode paysage/tablette dédié ;
- header / cards paysage hybrides ;
- simulation déplacée après les deux scénarios ;
- bandeau d’état unique ;
- espacements homogènes autour de la simulation ;
- astuce d’orientation mobile ;
- 5 KPI de simulation sur une ligne en tablette ;
- écarts de rating plus contrastés ;
- correction du clipping de l’aide simulation (PR #46).
