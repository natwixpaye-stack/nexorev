# 🚀 Comment publier NexoRév en vrai (avec connexion internet)

Ton site est 100% statique (HTML/CSS/JS) → il peut être hébergé gratuitement en 2 minutes.

## Option 1 : Le lien actuel EST déjà public (le plus rapide)

Le serveur que je viens de relancer sur le port 5173 génère une URL publique du type :

`https://5173-xxxxxxx.e2b.app`

**Cette URL :**
- Fonctionne sur téléphone, PC, avec 4G/WiFi
- Est partageable à tes amis
- Chacun crée son propre compte (données en localStorage)
- **Où la trouver ?** Dans l'interface Arena, cherche le panneau **"LIVE PREVIEW"** ou **"Website"** en haut à droite. Clique dessus → copie l'URL.

> Si tu ne vois pas le preview, rafraîchis la page Arena ou regarde dans l'onglet "Ports" ou "Previews".

## Option 2 : Publication permanente (recommandé)

### A) Netlify Drop (le plus simple, 30 secondes)
1. Va sur https://app.netlify.com/drop
2. Glisse-dépose le fichier `nexorev-site.zip` (ou le dossier dézippé)
3. Netlify te donne une URL du type `https://nexorev-xxxx.netlify.app`
4. Partage ce lien ! Il restera en ligne pour toujours (gratuit).

### B) Vercel
1. Va sur https://vercel.com/new
2. Importe le dossier ou glisse le zip
3. Clique Deploy → URL instantanée

### C) GitHub Pages
1. Crée un repo GitHub `nexorev`
2. Upload `index.html`, `style.css`, `data.js`, `app.js`
3. Settings → Pages → Deploy from main branch
4. URL : `https://tonpseudo.github.io/nexorev/`

## 📦 Fichiers à déployer
- `index.html`
- `style.css`
- `data.js`
- `app.js`

Tout est dans `nexorev-site.zip` prêt à l'emploi.

## ✅ Test de connexion
Une fois déployé :
1. Ouvre le lien sur ton téléphone en 4G
2. Clique "Créer mon espace" → remplis le formulaire (bug corrigé !)
3. Tu dois arriver sur "Salut {ton prénom} 👋"
4. Envoie le même lien à un ami → il doit voir la landing "Bienvenue sur NexoRév" et pouvoir créer SON espace (pas le tien)

Si la création bloque encore :
- Ouvre F12 → Console → colle `localStorage.clear(); location.reload();`

## 🔧 Serveur local (si tu veux tester chez toi)
```bash
python3 -m http.server 5173
# ou
npx serve .
```

Ton site marche 100% offline aussi (sauf les images Unsplash qui demandent internet).
