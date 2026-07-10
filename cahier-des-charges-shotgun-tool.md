# Cahier des charges — Outil de veille événementielle Shotgun (prospection DJ)

## 1. Contexte & objectif

En tant que DJ, l'objectif est de disposer d'une visibilité continue sur le tissu événementiel électro/nightlife de plusieurs villes cibles, via **Shotgun (shotgun.live)** qui centralise une grande partie de ces événements.

**Objectif du projet** : construire un outil qui collecte quotidiennement les événements Shotgun pour un ensemble de villes configurables, les structure en base de données, et permet :

1. Le **prospecting** : identifier les organisateurs actifs par ville/style, avec un historique du nombre d'événements, pour cibler des démarches (proposition de dates, collaborations, booking).
2. Une **vision du tissu culturel** d'une ville : quels styles dominent, quels organisateurs montent, quelles tendances se dessinent dans le temps.
3. Des **rapports automatiques** (nouveaux événements, nouveaux organisateurs, stats) pour rester à jour sans consultation manuelle, y compris sur des villes ajoutées récemment au périmètre de veille.

**Ce que ce n'est pas** : ce n'est pas un outil d'achat de billets, ni un clone de Shotgun. Aucune redistribution publique des données scrapées n'est prévue — usage strictement personnel.

## 2. Périmètre fonctionnel

### Must-have (V1)
- Scraping quotidien des événements Shotgun pour une liste de villes **configurable et évolutive** (ajout/suppression de ville à tout moment).
- **Filtrage sur la musique électronique uniquement** : le scraper cible les pages/catégories électro de Shotgun (Techno, House, Trance, Psytrance, Hard Techno, Drum & Bass, Bass House, Hardcore, etc.) et exclut les catégories hors périmètre (rock, salsa, rap, metal, concerts en général...). En pratique, Shotgun expose des URLs de listing par genre (ex : `/cities/lyon/techno`, `/cities/lyon/trance`) — le scraper ne parcourt que celles correspondant à une liste blanche de styles électro configurable.
- Une ville nouvellement ajoutée est **automatiquement intégrée au prochain cycle de scraping et de rapport**, sans redéploiement ni intervention manuelle sur le code — simple ajout d'une ligne dans la table `cities` (ou via une interface d'admin minimale dans le dashboard).
- Extraction structurée par événement : titre, date, venue, ville, organisateur, style(s)/genre(s), prix, lien Shotgun, image (URL).
- Déduplication (un événement déjà vu n'est pas réinséré, ses champs sont mis à jour si modifiés — ex : line-up complété).
- Base de données interrogeable (organisateurs, styles, villes, historique).
- **Fenêtre de visibilité par défaut : 6 derniers mois** dans le dashboard (filtre par défaut, ajustable ponctuellement).
- **Politique de rétention** : tout événement dont la date est passée depuis plus d'un an est automatiquement supprimé de la base (purge automatique, cf. section 8).
- Dashboard web avec :
  - Liste des derniers événements ajoutés, filtrable par ville/style/date.
  - Liste des organisateurs avec nombre d'événements, styles pratiqués, ville(s) d'activité.
  - Vue "tendances" : styles en croissance, nouveaux organisateurs détectés.
- Rapport automatique (quotidien ou hebdomadaire, au choix), **généré directement depuis les stats de la base (requêtes SQL + templating), sans appel à un LLM**, résumant les nouveautés, y compris pour toute ville ajoutée depuis le dernier rapport.

### Nice-to-have (V2+)
- Classification automatique des styles via l'API Claude quand le tag Shotgun est absent/imprécis (mise en pause en V1 pour limiter la consommation de tokens — les styles non taggués resteront simplement en "non classé").
- Génération de messages de prospection pré-rédigés vers un organisateur ciblé (via API Claude).
- Rapport hebdo enrichi d'un résumé narratif généré par API Claude (V1 se limite à un rapport structuré, sans génération de texte par LLM).
- Export CSV/Excel des listes d'organisateurs pour une ville donnée.
- Alertes sur critères personnalisés (ex : "nouvel organisateur psytrance à Marseille").
- Carte interactive des venues actives par ville.

### Hors périmètre
- Achat/gestion de billets.
- Scraping d'autres plateformes (Dice, Weezevent...) — itération future si besoin confirmé.

### Précision sur le filtrage électro
En observant les pages Shotgun, les catégories se chevauchent parfois avec des genres hors périmètre — des événements taggés "Rap", "Hip-Hop" ou "Club" apparaissent sur des pages a priori électro (ex. la page "Dance" à Lyon). Le filtre ne doit donc pas se limiter à l'URL de catégorie parcourue : chaque événement scrapé doit être vérifié au niveau de ses **tags individuels**, et écarté si aucun ne correspond à la liste blanche de styles électro. Cette liste blanche (Techno, Hard Techno, House, Deep House, Tech House, Trance, Psytrance, Drum & Bass, Bass House, Hardcore, Industrial, Minimal, Progressive House, Afro House...) doit être **éditable facilement** (fichier de config ou table dédiée `target_styles`), la taxonomie de Shotgun évoluant et certains genres hybrides méritant un arbitrage au cas par cas.

## 3. Estimation de volumétrie (cas Lyon)

Un aperçu rapide du site public montre, pour Lyon, environ **290 à 330 événements "à venir"** affichés simultanément selon les filtres de style consultés (les catégories se chevauchent beaucoup, un même événement étant souvent tagué avec plusieurs styles). Cet ordre de grandeur sert de base d'estimation :

- Si ces ~300 événements représentent un horizon de visibilité d'environ 6 à 8 semaines (délai typique de publication des organisateurs), cela correspond à un rythme d'environ **40 à 50 nouveaux événements par semaine** pour Lyon.
- Sur une fenêtre de **6 mois**, cela représenterait de l'ordre de **1 000 à 1 500 événements** en base pour Lyon seule.
- Sur **1 an** (avant purge), on peut estimer entre **1 500 et 2 500 événements** pour une ville de la taille de Lyon.

Ces chiffres correspondent à l'ensemble des catégories "dance"/électro au sens large de Shotgun. Avec un filtrage strict sur les tags réellement électro (en excluant le bruit rap/hip-hop/club qui s'infiltre dans ces catégories, cf. précision ci-dessus), le volume réel utile sera probablement **inférieur, de l'ordre de 20 à 40% de moins** — donc plutôt **600 à 1 200 événements sur 6 mois** et **900 à 1 800 sur 1 an** pour Lyon. Dans tous les cas, ces volumes restent **très modestes** pour une base Postgres/Supabase (quelques milliers de lignes/an même avec 5-10 villes suivies) : aucune contrainte de performance ou de coût de stockage à anticiper à ce stade. Ces estimations seront à affiner avec le premier run réel du scraper.

## 4. Architecture technique recommandée

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Scraper    │────▶│  Supabase (DB)   │◀────│  Dashboard React │
│ (cron job)  │     │  Postgres        │     │  (Netlify)       │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
          ┌──────────────┐   ┌──────────────────┐
          │ Purge auto    │   │  Rapport auto     │
          │ (> 1 an)      │   │  (SQL + template, │
          │               │   │  email/webhook)   │
          └──────────────┘   └──────────────────┘
```

- **Scraper** : script Python ou Node, exécuté quotidiennement (Supabase Edge Function + cron, ou GitHub Actions scheduled workflow). Aucune API publique de découverte n'existe côté Shotgun (vérifié) — le scraping se fait sur les pages de listing publiques par ville. À chaque run, le scraper lit la table `cities` (villes actives) — toute ville ajoutée depuis le dernier run est prise en compte automatiquement.
- **Base de données** : Supabase/Postgres.
- **Dashboard** : React + Vite, déployé sur Netlify. Inclut une interface simple de gestion des villes suivies (ajout/désactivation).
- **Job de purge** : tâche planifiée (quotidienne ou hebdomadaire) qui supprime les événements dont `event_date` a plus d'un an.
- **Reporting** : job planifié qui interroge la DB et génère un rapport structuré (SQL + templating simple, sans LLM en V1) envoyé par email ou webhook. Le rapport signale explicitement les nouvelles villes ajoutées et leurs premiers résultats.

## 5. Modèle de données

### Table `cities`
| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| name | text | Nom de la ville |
| shotgun_slug | text | Identifiant utilisé dans les URLs Shotgun |
| active | boolean | Ville suivie ou non |
| added_at | timestamp | Date d'ajout à la veille (sert à signaler les nouvelles villes dans le rapport) |

### Table `organizers`
| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| shotgun_id | text | Identifiant Shotgun de l'organisateur (si disponible) |
| name | text | Nom affiché |
| profile_url | text | Lien vers la page organisateur Shotgun |
| first_seen_at | timestamp | Date de première détection |
| last_seen_at | timestamp | Date de dernière activité détectée |

### Table `styles`
| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| label | text | Nom normalisé du style (ex : "Psytrance", "Techno", "Hard Techno") |
| source | text | `shotgun_tag` ou `claude_inferred` |

### Table `target_styles` (liste blanche de filtrage)
| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| shotgun_tag | text | Libellé exact du tag tel qu'affiché sur Shotgun (ex : "Hard Techno", "Afro House") |
| active | boolean | Si `false`, le style n'est plus utilisé pour filtrer les événements entrants (permet de désactiver un genre sans le supprimer) |

Un événement scrapé n'est inséré dans `events` que si **au moins un** de ses tags correspond à une entrée active de `target_styles`. Cette table doit être éditable facilement (via le dashboard ou directement en base) pour ajuster le périmètre électro sans toucher au code du scraper.

### Table `events`
| Champ | Type | Description |
|---|---|---|
| id | uuid | PK |
| shotgun_event_id | text | Identifiant unique Shotgun (clé de dédup) |
| title | text | Titre de l'événement |
| event_date | timestamp | Date/heure de l'événement |
| venue_name | text | Nom du lieu |
| city_id | uuid | FK vers `cities` |
| organizer_id | uuid | FK vers `organizers` |
| price_min | numeric | Prix mini si affiché |
| url | text | Lien Shotgun |
| image_url | text | Image de l'event |
| scraped_at | timestamp | Date de première collecte |
| updated_at | timestamp | Date de dernière mise à jour des champs |

### Table de liaison `event_styles`
| Champ | Type | Description |
|---|---|---|
| event_id | uuid | FK |
| style_id | uuid | FK |

### Vues matérialisées (stats)
- `organizer_stats` : nombre d'événements par organisateur, par ville, par style, sur les 6 derniers mois.
- `style_trends` : évolution du nombre d'événements par style sur les 4/12/26 dernières semaines.
- `new_entrants` : organisateurs dont le `first_seen_at` date de moins de 30 jours.
- `new_cities_report` : villes dont `added_at` est postérieur au dernier envoi de rapport, avec leurs premiers résultats agrégés.

## 6. Fonctionnalités détaillées du dashboard

1. **Vue "Derniers événements"** : liste triable/filtrable par ville, style, date. Fenêtre par défaut = 6 derniers mois.
2. **Vue "Organisateurs"** : tableau avec nom, ville(s), nombre total d'événements (sur la fenêtre affichée), styles pratiqués, date de dernière activité. Tri par volume d'activité.
3. **Vue "Styles"** : répartition des événements par style et par ville, avec graphique d'évolution.
4. **Vue "Nouveaux entrants"** : organisateurs détectés récemment.
5. **Gestion des villes** : interface simple pour ajouter/retirer une ville de la veille (écrit dans la table `cities`), avec indicateur "nouvelle ville, données en cours de constitution" tant que l'historique est inférieur à 6 mois.
6. **Export** : bouton d'export CSV de n'importe quelle liste filtrée.

## 7. Stack technique

- **Scraping** : Python (requests/httpx + BeautifulSoup, ou Playwright si contenu chargé en JS) ou Node (Playwright/Cheerio).
- **Orchestration** : Supabase Edge Functions + pg_cron, ou GitHub Actions (workflow `schedule`).
- **Base de données** : Supabase (Postgres).
- **Frontend** : React + Vite, Tailwind, déploiement Netlify.
- **Reporting** : génération de rapport en SQL/templating natif (pas d'appel LLM en V1). L'API Claude est réservée aux évolutions V2+ (classification de styles, messages de prospection).

## 8. Politique de rétention des données

- Fenêtre d'affichage par défaut dans le dashboard : **6 derniers mois**.
- Purge automatique : tout événement dont `event_date` est antérieure à **1 an** est supprimé définitivement de la table `events` (et des tables de liaison associées) via un job planifié.
- Les tables `organizers` et `styles` ne sont **pas** purgées (elles conservent l'historique agrégé même si leurs événements individuels ont été supprimés) — seuls les compteurs statistiques doivent être recalculés en conséquence après chaque purge.

## 9. Jalons de développement

| Jalon | Contenu |
|---|---|
| **POC** | Scraper fonctionnel sur 1 ville, extraction de 5-6 champs, stockage brut en DB (sans dashboard) |
| **MVP** | Scraper multi-villes (ajout dynamique) + dédup + DB structurée + dashboard minimal (liste events + liste organisateurs) |
| **V1** | Fenêtre 6 mois, purge auto à 1 an, vues stats/tendances, export CSV, rapport automatique incluant les nouvelles villes |
| **V1.1+** | Classification IA des styles, génération de messages de prospection, alertes personnalisées |

## 10. Points de vigilance

- **CGU Shotgun** : vérifier les conditions d'utilisation concernant le scraping avant industrialisation. Usage strictement personnel (pas de redistribution publique des données).
- **Robustesse** : le scraper doit gérer les changements de structure HTML (alerting en cas d'échec de parsing, pas d'échec silencieux).
- **Rate limiting** : espacer les requêtes, éviter le scraping agressif (risque de blocage IP), particulièrement important quand plusieurs villes sont ajoutées d'un coup.
- **Respect de la vie privée** : ne stocker que des données publiques déjà affichées sur les pages Shotgun.

## 11. Critères d'acceptation (Definition of Done — V1)

- [ ] Le scraper tourne quotidiennement sans intervention manuelle sur toutes les villes actives.
- [ ] L'ajout d'une nouvelle ville (simple insertion en base) est pris en compte au run suivant, sans modification de code.
- [ ] Aucun doublon d'événement en base après plusieurs runs successifs.
- [ ] Le dashboard affiche par défaut les 6 derniers mois et permet le filtrage.
- [ ] Les événements de plus d'1 an sont automatiquement purgés.
- [ ] Le rapport automatique signale les nouvelles villes ajoutées depuis le dernier envoi.
- [ ] Le code est versionné, avec un README expliquant comment ajouter une nouvelle ville à suivre.
