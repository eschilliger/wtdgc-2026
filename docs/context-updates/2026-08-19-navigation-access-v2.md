# 2026-08-19 — Navigation & Access V2

## Capacités cumulées

Les rôles restent `player`, `staff`, `admin`, mais l’UX ne les traite plus comme trois mondes exclusifs.

- `player` : Accueil, Comparateur, Mes matchs ;
- `staff` : tout ce que voit un joueur + Espace Staff ;
- `admin` : tout ce que voit un joueur + Staff + Administration.

Le statut Staff/Admin ne doit donc jamais masquer la vue joueur. Cela permet notamment à un membre du staff qui est aussi joueur de conserver son accès personnel, et à un admin/staff de contrôler ce qui sera affiché aux joueurs.

Des helpers de capacité sont utilisés côté serveur : `canAccessPlayerArea`, `canAccessStaffArea`, `canAccessAdminArea`, ainsi que `requirePlayerAccess` / `requireStaffAccess`.

## Navigation applicative partagée

Une navigation persistante est affichée pour tout utilisateur authentifié et habilité :

- Accueil
- Comparateur
- Mes matchs
- Staff selon droits
- Administration selon droits
- identité du compte et déconnexion

Desktop : barre horizontale.
Tablet/mobile : menu compact accessible par bouton, avec les mêmes destinations et indication de la page active.

La navigation est intégrée au root layout afin qu’elle soit cohérente sur les pages principales et les sous-pages (notamment les rounds Staff), sans recréer des liens de navigation différents dans chaque écran.

## Responsive comme contrainte par défaut

Toute nouvelle évolution doit être conçue dès le départ pour :

1. mobile portrait ;
2. mobile paysage / tablette ;
3. desktop.

Le mobile et la tablette sont des formats principaux pour l’usage terrain. Les vues de confrontation doivent rester côte à côte en paysage/tablette lorsque cela améliore la lecture, conformément aux conventions déjà validées pour le Comparateur.

Les layouts authentifiés ont été élargis et leurs espacements adaptés pour ces trois familles de viewport.

## Vue joueur

`/player-area` devient « Mes matchs » et accepte `player`, `staff`, `admin`. Staff/Admin y voient volontairement le même contenu public/joueur, sans notes internes, afin de contrôler la communication avant/après publication.
