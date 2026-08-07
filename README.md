# WTDGC 2026 Scout

Application responsive de consultation et de comparaison des équipes engagées aux WTDGC 2026, avec un focus sur les besoins du staff France.

## Lot 1 — socle

Le dépôt contient :

- Next.js + TypeScript ;
- structure Firebase / Firestore ;
- types métier pour équipes, joueurs et inscriptions ;
- client serveur PDGA conforme à l'authentification documentée (session + cookie) ;
- variables d'environnement documentées sans secrets.

## Sources externes

- Dashboard WTDGC : https://www.wtdgc.sport/teams-online-resigration-dashboard/
- PDGA API auth : https://www.pdga.com/dev/api/rest/v1/auth
- PDGA API services : https://www.pdga.com/dev/api/rest/v1/services

## Configuration locale

```bash
cp .env.example .env.local
npm install
npm run dev
```

Renseigner les identifiants PDGA uniquement dans `.env.local`. Ne jamais les committer.

## Prochaine étape

Analyser et importer un premier snapshot WTDGC (France Open / Masters), puis valider la récupération PDGA à partir des numéros joueurs avant le chargement de toutes les équipes.
