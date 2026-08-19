# 2026-08-19 — Home, signup et Comparateur authentifié

Ce lot clarifie la séparation entre l’outil d’analyse et les fonctions opérationnelles Staff.

## Nomenclature

Le terme utilisateur **Scouting** est remplacé par **Comparateur d’équipes**.

Le comparateur est un terrain d’analyse et de simulation : comparaison de deux équipes, indisponibilités, compositions et lecture des écarts. La préparation des rounds reste l’outil opérationnel Staff.

Route : `/compare`.

## Accès

Le Comparateur n’est plus public. Il exige une session Firebase valide et un rôle WTDGC actif :

- `player` ;
- `staff` ;
- `admin`.

Un compte créé mais encore sans rôle ne peut pas accéder au Comparateur.

## Home `/`

La racine devient une vraie page d’accueil applicative.

Sans session :

- présentation WTDGC 2026 ;
- bouton `Se connecter` ;
- bouton `Créer un compte`.

Avec session sans rôle :

- écran `Habilitation requise` ;
- demande de vérification de l’e-mail pour un signup e-mail ;
- lien mail vers `eschilliger@gmail.com` ;
- demande d’indiquer nom, prénom et numéro PDGA.

Avec rôle :

- tous les rôles : `Comparateur d’équipes` ;
- `player` : `Mes matchs` ;
- `staff` et `admin` : `Espace Staff` ;
- `admin` : `Administration`.

## Signup / login

`/login` propose deux modes :

- `Se connecter` ;
- `Créer un compte`.

Les deux modes permettent Google. Le signup e-mail utilise Firebase Auth email/mot de passe avec confirmation du mot de passe et déclenche l’envoi d’un e-mail de vérification. Le login e-mail propose aussi `Mot de passe oublié ?` via Firebase Auth.

Après authentification, la session client est échangée contre le cookie serveur Firebase existant, puis l’utilisateur revient sur `/` afin que la home applique son rôle.

## Habilitation

À chaque création/connexion, `appUsers/{uid}` est mis à jour côté serveur avec notamment :

- `email` ;
- `emailVerified` ;
- `authorizationStatus` (`pending` sans rôle, `active` avec rôle) ;
- `role` ;
- `lastLoginAt` ;
- `signInProvider`.

L’attribution d’un rôle depuis l’Admin ou le workflow de bootstrap positionne `authorizationStatus: active` et continue de révoquer les sessions existantes pour forcer une reconnexion propre.

## Suite fonctionnelle

Le prochain chantier prévu reste la simulation de composition adverse dans la préparation des rounds Staff, en réutilisant le même moteur de scénario que le Comparateur, puis la liaison compte Firebase ↔ joueur WTDGC pour filtrer `Mes matchs`.
