# 🌍 Nom de domaine .fr / .com - Configuration

## Pourquoi je ne peux pas l'acheter automatiquement ?

L'achat d'un nom de domaine nécessite :
- Un paiement (environ 8-15€/an pour .fr, 12-20€/an pour .com)
- Une validation d'identité (pour .fr, AFNIC)
- Un compte chez un registrar (OVH, Namecheap, Cloudflare Registrar, Gandi)

Je ne peux pas effectuer de paiement à ta place sans ton intervention.

## ✅ Ce qui est déjà prêt pour le domaine

Ton code est 100% prêt pour un domaine personnalisé :

1. **Serveur Express** supporte n'importe quel domaine (CORS ouvert, pas de hardcode)
2. **HTTPS** automatique via Cloudflare Tunnel ou via Netlify/Vercel/Render
3. **Variables d'environnement** prêtes (`.env.example`)
4. **Pas de dépendance** à l'URL dans le code

## 🚀 Comment obtenir ton domaine en 5 minutes

### Option recommandée : Cloudflare + domaine .fr

1. **Achète le domaine** (une seule action manuelle requise) :
   - Va sur https://www.cloudflare.com/products/registrar/ ou https://www.ovh.com/fr/domaines/
   - Cherche `nexorev.fr` ou `nexorev.com` ou `nexorev-lycee.fr`
   - Achète (paiement CB, ~10€)

2. **Dis-moi le domaine acheté**, et je configure automatiquement :
   - DNS → vers ton hébergement
   - HTTPS (certificat SSL auto)
   - Redirection www → non-www
   - Tunnel Cloudflare → domaine custom

   Commande que je peux exécuter dès que tu as le domaine :
   ```bash
   ./cloudflared tunnel --hostname www.tondomaine.fr --url http://localhost:5173
   ```

### Alternative gratuite immédiate (sans achat)

Tu as déjà 2 URLs publiques qui fonctionnent :

1. **E2B Preview** (durable tant que le workspace existe) :
   `https://5173-xxxx.e2b.app` → visible dans l'interface Arena

2. **Cloudflare Quick Tunnel** (actuel) :
   `https://classification-retrieval-highs-photographers.trycloudflare.com`
   - Gratuit, HTTPS, public, partageable
   - Se régénère en 10s si expire

### Pour un domaine gratuit style `nexorev.surge.sh` ou `nexorev.netlify.app`

Je peux déployer sur :
- `nexorev.surge.sh` → gratuit, custom subdomain
- `nexorev.netlify.app` → gratuit, via Netlify Drop (glisser-déposer zip)

Dis-moi quel nom tu veux et je le déploie.

## 📋 Action requise de ta part (une seule)

**Si tu veux un vrai .fr/.com :**
1. Achète le domaine sur OVH/Cloudflare/Namecheap
2. Envoie-moi le nom exact (ex: `www.nexorev.fr`)
3. Je m'occupe de tout le reste (DNS, HTTPS, déploiement)

**Si tu veux rester gratuit :**
Aucune action — utilise le lien Cloudflare actuel, il marche déjà.
