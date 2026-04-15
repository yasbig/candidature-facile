# CandidatureFacile

Service de candidatures spontanées automatisées par IA.

## 🌟 Fonctionnalités

- **Upload CV + LM** — Interface drag & drop
- **Paiement Stripe** — 29€ one-shot
- **Génération automatique** — Emails personnalisés par entreprise
- **Envoi par Resend** — 50 entreprises ciblées
- **Dashboard** — Suivi en temps réel des candidatures
- **Statistiques** — Taux de réponse, réponses positives

## 🚀 Démarrage rapide

### Backend (Node.js)

```bash
cd server
npm install
cp .env.example .env
# Configurer RESEND_API_KEY et STRIPE_SECRET_KEY
npm start
```

### Frontend (déjà inclus)

Le frontend est en fichiers statiques HTML/CSS/JS dans le dossier racine.

## 📁 Structure

```
candidature-facile/
├── index.html          # Landing page
├── checkout.html       # Paiement + upload
├── dashboard.html     # Stats + suivi
├── candidatures.html  # Liste détaillée
├── server/
│   ├── index.js       # API Express
│   └── package.json
└── data/
    └── companies.json # Base entreprises
```

## 🔧 Configuration

Créer un fichier `.env` dans `server/`:

```
RESEND_API_KEY=re_xxx
STRIPE_SECRET_KEY=sk_xxx
PORT=3000
```

## 🔗 API

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/health` | GET | Health check |
| `/api/companies` | GET | Liste entreprises |
| `/api/submit-candidate` | POST | Soumet candidat |
| `/api/campaign/:id` | GET | Status campagne |
| `/api/simulate-reply/:id` | POST | Simule réponse |

## 💰 Prix

- **29€** pour 50 candidatures personnalisées
- Pas d'abonnement

## 📜 License

Propriétaire © 2026 CandidatureFacile
