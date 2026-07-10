# ProspeGame — Veille événementielle Shotgun (prospection DJ)

Outil de veille personnel qui collecte quotidiennement les événements **électro / nightlife**
publiés sur [Shotgun](https://shotgun.live) pour un ensemble de villes configurables, les
structure dans une base Postgres (Supabase), et les expose dans un **dashboard** dédié à la
prospection : organisateurs actifs, styles dominants, tendances, nouveaux entrants.

> Implémentation du cahier des charges `cahier-des-charges-shotgun-tool.md` (V1).
> Usage strictement personnel — aucune redistribution des données scrapées.

## Aperçu du dashboard

Dark mode, couleur principale turquoise. Six vues :
**Aperçu** · **Événements** · **Organisateurs** · **Styles & tendances** ·
**Nouveaux entrants** · **Villes & filtres** (gestion des villes suivies + liste blanche électro).

Le dashboard fonctionne en **mode démonstration** (jeu de données factice) tant que les
variables Supabase ne sont pas renseignées — pratique pour visualiser l'interface immédiatement.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Scraper    │────▶│  Supabase (DB)   │◀────│  Dashboard React │
│ (GH Action) │     │  Postgres        │     │  (Netlify)       │
└─────────────┘     └──────────────────┘     └──────────────────┘
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
          ┌──────────────┐   ┌──────────────────┐
          │ Purge > 1 an │   │ Rapport auto      │
          │ (GH Action)  │   │ (SQL + template)  │
          └──────────────┘   └──────────────────┘
```

| Dossier | Rôle |
|---|---|
| `supabase/migrations/` | Schéma, vues de stats, RPC (`upsert_event`, `purge_old_events`), RLS, données de départ |
| `scraper/` | Scraper Node + jobs `report` et `purge` (exécutables en local ou via GitHub Actions) |
| `dashboard/` | Dashboard React + Vite + Tailwind (déploiement Netlify) |
| `.github/workflows/` | Planification quotidienne du scrape et de la purge, hebdo du rapport |

## Stack

- **DB** : Supabase (Postgres) — schéma versionné en SQL.
- **Scraper / jobs** : Node 20+ (ESM), `@supabase/supabase-js`, `cheerio`.
- **Dashboard** : React 18, Vite, TypeScript, Tailwind, Recharts.
- **Orchestration** : GitHub Actions (`schedule`). Alternative possible : Supabase Edge Functions + `pg_cron`.

---

## Mise en route

### 1. Base de données (Supabase)

Créez un projet Supabase, puis appliquez les migrations **dans l'ordre** (SQL Editor du dashboard
Supabase, ou CLI `supabase db push`) :

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_functions_views.sql
supabase/migrations/0003_rls.sql
supabase/migrations/0004_seed.sql   # liste blanche électro + 3 villes de départ
```

Récupérez ensuite :
- `Project URL` → `SUPABASE_URL` (jobs) et `VITE_SUPABASE_URL` (dashboard)
- clé **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (jobs uniquement, **jamais** côté frontend)
- clé **anon / publishable** → `VITE_SUPABASE_ANON_KEY` (dashboard)

### 2. Dashboard

```bash
cd dashboard
cp .env.example .env        # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npm run dev                 # http://localhost:5173
```

Sans `.env`, le dashboard démarre en **mode démonstration**.

Déploiement **Netlify** : le fichier `dashboard/netlify.toml` configure le build
(`base = dashboard`, `publish = dist`). Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
dans les variables d'environnement du site Netlify.

### 3. Scraper & jobs (en local)

```bash
cd scraper
cp ../.env.example .env     # renseigner SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
npm install
npx playwright install chromium   # navigateur headless requis (voir ci-dessous)
# charger les variables puis lancer :
node --env-file=.env src/scrape.js     # scrape toutes les villes actives
node --env-file=.env src/report.js     # génère le rapport (stdout / webhook)
node --env-file=.env src/purge.js      # purge les événements > 1 an
node --env-file=.env src/seed-demo.js  # (optionnel) données de démo en base
```

> **Pourquoi un navigateur ?** Shotgun est protégé par le *Vercel Security Checkpoint*
> (challenge JavaScript anti-bot) : une requête HTTP simple renvoie `429` + une page de
> challenge. Le scraper utilise donc **Chromium via Playwright** pour exécuter le JS, franchir
> le challenge et récupérer le HTML rendu. En CI, l'installation du navigateur est faite
> automatiquement par le workflow (`npx playwright install --with-deps chromium`).
>
> `SCRAPE_HORIZON_MONTHS` (défaut **3**) limite la collecte aux événements des N prochains mois
> (Shotgun ne liste que l'à-venir). En cas de page vide, relancer le workflow *Scrape* avec
> l'option **debug_dump** : le HTML rendu est publié en artefact pour ajuster les sélecteurs de
> `scraper/src/lib/shotgun.js` (seul fichier couplé à la structure du site).

### 4. Planification (GitHub Actions)

Ajoutez ces **secrets** au dépôt (`Settings → Secrets and variables → Actions`) :
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, et optionnellement `REPORT_WEBHOOK_URL`.

Les workflows tournent alors automatiquement :
- `scrape.yml` — tous les jours à 05h30 UTC
- `purge.yml` — tous les jours à 04h00 UTC
- `report.yml` — tous les lundis à 08h00 UTC

Chaque workflow est aussi déclenchable manuellement (`workflow_dispatch`).

---

## ➕ Ajouter une nouvelle ville à suivre

Trois options, **toutes prises en compte au prochain cycle de scraping sans redéploiement ni
modification de code** (cf. cahier des charges §2 & §11) :

1. **Depuis le dashboard** : vue **« Villes & filtres »** → formulaire *Nom + Slug Shotgun* → *Ajouter*.
2. **En SQL** :
   ```sql
   insert into cities (name, shotgun_slug, active) values ('Bordeaux', 'bordeaux', true);
   ```
3. **Table `cities` de Supabase** : insérer une ligne à la main.

Le **slug** doit correspondre à l'URL Shotgun : `https://shotgun.live/cities/<slug>`.
Une ville ajoutée depuis moins de 6 mois est signalée *« données en constitution »* dans l'UI,
et apparaît dans le prochain rapport automatique (vue `new_cities_report`).

Pour **arrêter** de suivre une ville sans perdre son historique : basculez son interrupteur sur
inactif (ou `active = false`).

## 🎚️ Ajuster le filtre électro (liste blanche de styles)

Le scraper n'insère un événement que si **au moins un de ses tags** figure — actif — dans la table
`target_styles` (le filtrage se fait côté SQL dans la RPC `upsert_event`, jamais dans le code du
scraper). Éditez cette liste :

- **Dashboard** : vue **« Villes & filtres »** → panneau *Liste blanche des styles électro*
  (ajouter un tag, ou cliquer un style pour l'activer/désactiver).
- **SQL** : `insert into target_styles (shotgun_tag, active) values ('Melodic Techno', true);`

---

## Modèle de données (résumé)

`cities` · `organizers` · `styles` · `target_styles` (liste blanche) · `events` ·
`event_styles` (liaison) · `scrape_runs` / `report_runs` (journaux).

Vues de stats : `events_enriched`, `organizer_stats`, `style_trends`, `style_by_city`,
`new_entrants`, `new_cities_report`. Détail complet dans le cahier des charges (§5) et les
migrations.

## Rétention (cf. §8)

- Fenêtre d'affichage par défaut : **6 derniers mois** (ajustable dans le dashboard).
- Purge automatique des événements dont `event_date` a plus d'**1 an** (`purge_old_events`).
- `organizers` et `styles` ne sont **jamais** purgés (historique agrégé conservé).

## Robustesse du scraping (cf. §10)

- Rendu des pages via **Chromium/Playwright** (`scraper/src/lib/browser.js`) pour franchir le
  challenge anti-bot Vercel, avec attente active de résolution du challenge + scroll (lazy-load).
- Tout le couplage à la structure HTML de Shotgun est **isolé dans `scraper/src/lib/shotgun.js`**
  (3 stratégies d'extraction sur le HTML rendu : JSON-LD → `__NEXT_DATA__` → fallback DOM).
- Une page ville sans aucun événement parsé est **journalisée** dans `scrape_runs.errors`
  (pas d'échec silencieux) et le run est marqué `partial` (code de sortie ≠ 0).
- Rate limiting configurable via `SCRAPE_DELAY_MS` (défaut 1500 ms entre requêtes).
- ⚠️ Selon l'évolution du HTML/API de Shotgun, les sélecteurs de `shotgun.js` peuvent devoir être
  ajustés après le premier run réel — c'est le seul fichier à toucher.

## Sécurité / RLS

Outil mono-utilisateur : la RLS autorise la lecture publique et l'écriture sur `cities` /
`target_styles` avec la clé anon (pour la gestion depuis le dashboard). Le scraper utilise la clé
service_role (côté serveur uniquement). **Avant tout usage multi-utilisateur ou exposition
publique**, remplacer ces policies par une authentification Supabase (voir `0003_rls.sql`).

## Vérifier les CGU

Vérifiez les conditions d'utilisation de Shotgun concernant le scraping avant toute
industrialisation. Ne stockez que des données publiques, pour un usage strictement personnel.

## Périmètre

V1 conforme au cahier des charges. Fonctionnalités V2+ non incluses (classification IA des styles,
génération de messages de prospection via l'API Claude, alertes personnalisées, carte des venues).
