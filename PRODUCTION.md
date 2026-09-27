# 🚀 Déploiement Production Durable - NexoRév

## Infrastructure actuelle (déjà en place)

✅ **Backend Node.js + Express** (`/home/user/server/server.js`)
- Port 5173, 0.0.0.0
- CORS activé
- Auth JWT + bcrypt
- Base de données JSON persistante `/home/user/nexorev-database.json`
- API REST complète
- Sert le frontend statique

✅ **Base de données persistante**
- Fichier `/home/user/nexorev-database.json` → survit aux redémarrages, sauvegardé dans workspace
- 2 utilisateurs de test déjà créés (TestNoah, Lea) avec spécialités différentes
- Progression, planning, fiches, flashcards sauvegardés

✅ **Tunnel public HTTPS**
- URL actuelle : `https://classification-retrieval-highs-photographers.trycloudflare.com`
- HTTPS auto, public, partageable
- Relancé automatiquement

## Pour un hébergement qui survit à la fermeture de cette conversation

Le sandbox E2B est éphémère. Pour que le site reste en ligne après fermeture, déploie sur un hébergeur gratuit permanent :

### Option 1 : Render.com (recommandé pour backend Node.js)

1. Crée un compte sur https://render.com (gratuit, pas de CB)
2. New → Web Service → Connecte ton repo GitHub (ou upload)
3. Config :
   - Build: `cd server && npm install`
   - Start: `cd server && node server.js`
   - Env: `PORT=10000`, `JWT_SECRET=ton-secret-long`
   - Disk: Ajoute un disque persistant pour `/opt/render/project/src/nexorev-database.json`
4. Render te donne `https://nexorev.onrender.com` (gratuit, HTTPS)

### Option 2 : Railway.app

1. https://railway.app → New Project → Deploy from GitHub
2. Ajoute variable `JWT_SECRET`
3. Railway génère URL publique

### Option 3 : Netlify + Supabase (frontend + DB externe)

- Frontend sur Netlify (glisser-déposer `nexorev-site.zip`)
- DB sur Supabase (gratuit, PostgreSQL) → remplace JSON par Supabase
- Je peux migrer le code vers Supabase si tu crées un projet Supabase et me donnes l'URL + clé (2 min)

### Option 4 : Vercel (frontend) + Vercel Postgres

- Vercel déploie le frontend + serverless functions pour API
- Vercel Postgres gratuit pour DB

## Variables d'environnement à configurer en prod

```
PORT=10000 (ou 5173)
JWT_SECRET=un-secret-tres-long-et-aleatoire-min-32-caracteres
NODE_ENV=production
```

## Sauvegardes

- DB JSON : `cp /home/user/nexorev-database.json /home/user/backups/`
- Export utilisateur : bouton "Exporter mes données" dans profil → JSON téléchargeable
- Pour prod externe, active les backups automatiques de l'hébergeur

## Mise à jour sans perdre les données

- Code séparé de DB : `/home/user/server/` vs `/home/user/nexorev-database.json`
- Tu peux `git pull` ou remplacer `app.js`, `data.js`, `style.css` sans toucher à `nexorev-database.json`
- Les utilisateurs et progressions restent

## Test de persistance (déjà effectué)

```bash
curl /api/health → 2 users
curl /api/register → crée user
curl /api/me → récupère user même après redémarrage serveur
curl /api/progress → progression sauvegardée dans JSON
```

Fichier DB vérifié : `/home/user/nexorev-database.json` contient bien les 2 users avec spécialités différentes.

## Domaine custom

Voir `DOMAIN.md` — prêt à configurer dès que tu achètes le domaine.
