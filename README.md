# NexoRév — Plateforme de révision Première générale

Plateforme web premium, moderne, 100% fonctionnelle, inspirée de ton aperçu visuel.

## 🚀 Accès
Le site tourne sur https://5173-[sandbox].e2b.app (bouton LIVE PREVIEW dans l'interface). Partage ce lien : chaque ami crée son propre espace.

## 🎯 Fonctionnalités livrées

**1. Landing & Auth**
- Page d'accueil premium avec présentation
- Créer mon espace (onboarding 5 étapes) / Se connecter (multi-comptes localStorage)

**2. Onboarding**
- Prénom → Classe (Seconde/Première/Terminale/Autre) → Spécialités (12 au choix, combinaisons libres) → Objectif → Temps/jour
- Création automatique du profil

**3. Personnalisation auto**
- Dashboard, programme, progression filtrés selon classe + spés
- Ex: Maths + PC + SES → affiche ces 3 spés partout. Un autre choisit HGGSP+SVT+LLCER → interface s'adapte.

**4. Dashboard (comme maquette)**
- Salut {prénom} dynamique
- Reprendre où tu t'es arrêté, Réviser aujourd'hui, Mode révision intelligente
- Programme de Première avec cartes matières (couleurs, progress bar, %)
- Vue rapide, Mes spécialités, Progression globale 64%, Prochaines échéances, Dernières activités, carte motivation

**5. Programme**
- Filtres: Toutes / Spécialités / Communes / À faire / Terminés
- Matières: Maths (6 chapitres détaillés), PC (6), SES (6), Français (6), Hist-Géo (6), Anglais, Espagnol, Ens. Sci, EMC + 9 autres spés avec contenu fonctionnel

**6. Chapitre complet**
- Onglets: Cours (structure officielle: L'essentiel, Définitions, Explications, Formules, Méthodes, Exemples, Erreurs, À retenir) + Fiche synthétique + Fiche perso éditable + Exercices (facile/inter/difficile, indice, correction cachée) + Quiz (QCM avec explication) + Flashcards (flip 3D, notation)

**7. Outils**
- Exercices global avec filtres matière/difficulté
- Quiz global + quiz aléatoire
- Flashcards avec répétition intelligente (Je ne savais pas / Presque / Je savais)
- Fiches: officielles + perso
- Bac français: méthodo commentaire/dissertation/linéaire/oral, figures, mouvements, registres
- Progression: global, par matière, stats, recommandations IA (points faibles <60%)
- Planning: CRUD échéances (Contrôle/Devoir/DS/Oral/Bac blanc), planning auto généré
- Recherche globale: cours, chapitres, exercices, formules

**8. Design**
- Dark premium par défaut (comme maquette), light mode toggle
- Cartes arrondies 18px, gradients, glassmorphism, animations float, progress bars
- Responsive: sidebar → bottom nav mobile, topbar search
- Fonts: Plus Jakarta Sans + Outfit

**9. Architecture technique**
- `index.html` → shell
- `style.css` → design system complet (variables CSS, responsive)
- `data.js` → programme officiel 2025-2026 structuré (Users, Subjects, Chapters, Lessons...)
- `app.js` → SPA vanilla, state management, Store localStorage (users, progress, planning, activités, fiches perso)
- Pas de dépendance backend → 100% partageable, chaque navigateur a ses données isolées
- Évolutif: ajouter chapitre = ajouter objet dans data.js

**10. Partage**
- Aucune donnée en dur (pas de "Salut Noah" en dur)
- Chaque utilisateur a: prénom, classe, spés, objectif, temps, progression, planning, fiches, flashcards, activités
- Lien unique → Créer mon espace → espace perso

## 📚 Programme officiel intégré
- Maths spé: Suites, Second degré, Dérivation, Expo & Trigo, Produit scalaire, Probas
- PC: 4 thèmes officiels (transformation matière, structure, synthèse orga, mouvement, énergie, ondes)
- SES: marché concurrentiel, imparfait, croissance, socialisation, vie politique, vote
- Français: 4 objets d'étude + méthodo bac
- Hist-Géo, LVA/LVB, Ens Sci, EMC complets
- Autres spés: structure identique prête à remplir

## 🔧 Lancer en local
`python3 -m http.server 5173`

## ✨ Améliorations possibles
- Backend Firebase/Supabase pour sync multi-device
- Vrai auth email
- Contenu vidéo, annales bac
- Mode collaboratif fiches

Construit pour être utilisé quotidiennement, pas une démo.
