# ChargeTrackPro – Backend

API Express + Drizzle (Neon) prévue pour un déploiement serverless sur Vercel.

## Installation locale

```bash
npm install
# crée un fichier .env à partir de env.example
# DATABASE_URL=...
# SESSION_SECRET=...
# CORS_ORIGIN=http://localhost:5173
npm run db:push
npm run dev
```

L'API écoute sur `http://127.0.0.1:5000` (modifiable via `HOST` / `PORT`).

## Déploiement sur Vercel

1. Versionner ce dossier dans un repo Git dédié (`backend/` est la racine).
2. Importer le repo dans Vercel (framework `Other`).
3. Variables d'environnement à définir :
   - `DATABASE_URL` (Neon, avec `sslmode=require`)
   - `SESSION_SECRET` (chaîne aléatoire)
   - `CORS_ORIGIN` (ex. `https://votre-front.vercel.app,http://localhost:5173`)
4. Commande de build : `npm install`
5. Vercel détecte `api/index.ts` et sert l'API via `/api/*`.

> ⚠️ `memorystore` ne persiste pas entre deux exécutions serverless. Pour la production, envisager un store externe (Redis) ou une authentification stateless.

## Fichiers clés

- `app.ts` : configuration Express (CORS, session, routes, logs)
- `api/index.ts` : handler Vercel
- `env.example` : modèle de variables d'environnement
- `vercel.json` : configuration des routes/functions
- `drizzle.config.ts` : ORM (schema + migrations)
- `tsconfig.json` : compilation TypeScript

