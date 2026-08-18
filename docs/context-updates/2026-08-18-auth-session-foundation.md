# Authentification et sessions WTDGC — fondation

Date: 2026-08-18

## Objectif

Permettre aux utilisateurs de se connecter avec Google ou email/mot de passe, puis appliquer les rôles Firebase Auth `staff` et `player` côté serveur avant d'exposer les écrans sensibles.

## Architecture retenue

- Firebase Auth côté client pour effectuer l'authentification Google ou email/mot de passe.
- Échange immédiat de l'ID token Firebase contre un cookie de session Firebase Admin `httpOnly` côté Next.js.
- Durée de session actuelle : 5 jours.
- Vérification des cookies avec `verifySessionCookie(..., true)` côté serveur.
- Les custom claims `role: staff|player` pilotent les accès applicatifs.
- `/staff` exige `staff` côté serveur.
- `/player-area` exige `player` côté serveur.
- Un compte sans rôle revient sur `/login?status=role-required`.
- La déconnexion détruit le cookie serveur.

## Sécurité

Les règles Firestore déjà déployées restent une seconde barrière. Les pages Next.js qui utilisent Firebase Admin doivent toujours vérifier la session et le rôle car Admin SDK contourne les Firestore Security Rules.

Le endpoint de création de session :
- vérifie l'ID token ;
- exige une authentification récente (moins de 5 minutes) ;
- vérifie l'origine pour les requêtes navigateur ;
- crée un cookie `httpOnly`, `sameSite=lax`, `secure` en production.

## Providers

La page `/login` propose :
- Google via popup ;
- email + mot de passe.

Ces deux fournisseurs peuvent coexister dans Firebase Auth. Le linking de plusieurs providers sur un même UID sera traité explicitement lorsqu'on ajoutera la gestion de compte ; pour la première validation, Google et email peuvent être testés avec deux comptes différents.

## Première utilisation Staff

1. Se connecter une première fois avec Google sur `/login` pour créer l'utilisateur Firebase Auth.
2. Le compte sans rôle affiche l'état `role-required`.
3. Lancer GitHub Actions `Manage WTDGC user role` avec l'email et `staff`.
4. Se reconnecter pour obtenir un nouveau token contenant le custom claim.
5. L'utilisateur est redirigé vers `/staff`.

Même principe pour un joueur avec le rôle `player` et `/player-area`.
