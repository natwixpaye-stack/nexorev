# 🚀 Déployer NexoRév sur Render.com (gratuit, permanent)

## Pourquoi Render ?
- 100% gratuit pour commencer (pas de CB)
- HTTPS automatique
- URL permanente du type `https://nexorev.onrender.com`
- Supporte Node.js + Express + base de données
- Ne s'éteint pas quand tu fermes ton ordi (contrairement au tunnel Cloudflare)

## Étapes (3 minutes)

### 1. Prépare ton code sur GitHub (1 min)

**Option A : Via GitHub web (le plus simple)**
1. Va sur https://github.com/new
2. Nom du repo : `nexorev`
3. Coche "Public"
4. Clique "Create repository"
5. Clique "uploading an existing file" → glisse-dépose TOUS les fichiers de `/home/user` :
   - `index.html`
   - `style.css`
   - `data.js`
   - `app.js`
   - `server/` (dossier complet)
   - `render.yaml`
   - `Dockerfile`
   - `package.json` (si tu en as à la racine, sinon pas besoin)
6. Commit

**Option B : Via ce workspace (si tu as un token GitHub)**
```bash
cd /home/user
git init
git add .
git commit -m "NexoRév initial"
# Crée repo sur GitHub puis :
git remote add origin https://github.com/TON_PSEUDO/nexorev.git
git push -u origin main
```

### 2. Déploie sur Render (1 min)

1. Va sur https://dashboard.render.com/
2. Clique **New +** → **Web Service**
3. Connecte ton compte GitHub → sélectionne le repo `nexorev`
4. Render détecte automatiquement `render.yaml` :
   - **Name** : `nexorev`
   - **Build Command** : `cd server && npm install`
   - **Start Command** : `cd server && node server.js`
   - **Plan** : Free
5. Dans **Environment** → ajoute :
   - `JWT_SECRET` → clique "Generate" (ou mets un secret long)
   - `NODE_ENV` = `production`
6. Clique **Create Web Service**
7. Attends 2-3 minutes → Render te donne une URL : `https://nexorev-xxxx.onrender.com`

### 3. Teste (30 sec)

Ouvre `https://nexorev-xxxx.onrender.com`
- Tu dois voir "Bienvenue sur NexoRév"
- Crée un compte → ça doit marcher (bug corrigé)
- Vérifie `/api/health` → `{"ok":true,"users":1}`

### 4. Pour une persistance VRAIMENT permanente (recommandé)

Le plan Free de Render **n'a pas de disque persistant** → le fichier `nexorev-database.json` sera perdu à chaque redéploiement.

**Solution gratuite : ajoute une DB externe gratuite**

**Option Neon.tech (PostgreSQL gratuit, le plus simple) :**
1. Va sur https://neon.tech → Sign up gratuit
2. Create Project → copie la `DATABASE_URL` (genre `postgresql://user:pass@ep-xxx.neon.tech/neondb`)
3. Dans Render → ton service → Environment → ajoute `DATABASE_URL` = ta URL Neon
4. Je peux adapter `server.js` pour utiliser PostgreSQL au lieu de JSON si tu me donnes la DATABASE_URL

**Option Supabase (aussi gratuit) :**
1. https://supabase.com → New Project
2. Settings → Database → Connection String → copie
3. Ajoute `DATABASE_URL` dans Render

**En attendant, le JSON marche** : les données restent tant que tu ne redéploies pas. Pour backup, utilise le bouton "Exporter mes données" dans le profil.

### 5. Domaine custom .fr/.com (optionnel)

Une fois déployé sur Render :
1. Achète domaine sur OVH/Cloudflare/Namecheap (ex: `nexorev.fr` ~10€/an)
2. Dans Render → Settings → Custom Domains → Add `www.nexorev.fr`
3. Render te donne des DNS à mettre chez ton registrar
4. HTTPS auto

---

## 📦 Fichiers inclus pour Render

- `server/server.js` : backend Express + API + auth + DB JSON
- `server/package.json` : dépendances
- `render.yaml` : blueprint Render
- `Dockerfile` : pour deploy Docker si besoin
- `index.html`, `style.css`, `data.js`, `app.js` : frontend
- `nexorev-database.json` : DB (sera recréé sur Render)

## 🆘 Si tu bloques

Envoie-moi :
1. L'URL GitHub de ton repo
2. L'URL Render générée
3. Le log d'erreur si ça plante

Je corrige directement.

---

## 🔗 URLs actuelles (temporaires)

- **Nouveau tunnel Cloudflare (fix erreur 1033)** : `https://seeds-navy-declare-friend.trycloudflare.com`
- **E2B Preview** : onglet "NexoRév - Backend Persistant" dans Arena

Le tunnel Cloudflare est temporaire (quelques heures). Render sera permanent.
