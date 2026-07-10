-- ============================================================================
-- ProspeGame — Schéma de base (cf. §5 du cahier des charges)
-- Veille événementielle Shotgun pour la prospection DJ (électro / nightlife)
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";        -- recherche floue (organisateurs, titres)

-- ─────────────────────────────────────────────────────────────────────────
-- cities : villes suivies. Ajouter une ligne suffit à intégrer une ville au
-- prochain cycle de scraping (aucun redéploiement — cf. §2 & §11).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists cities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  shotgun_slug  text not null unique,           -- ex : "lyon", "paris", "marseille"
  active        boolean not null default true,
  added_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- organizers : organisateurs détectés. Jamais purgés (cf. §8).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists organizers (
  id            uuid primary key default gen_random_uuid(),
  shotgun_id    text unique,                     -- identifiant Shotgun si disponible
  name          text not null,
  profile_url   text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists organizers_name_trgm on organizers using gin (name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────
-- styles : styles normalisés. Jamais purgés (cf. §8).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists styles (
  id     uuid primary key default gen_random_uuid(),
  label  text not null unique,                   -- ex : "Techno", "Hard Techno"
  source text not null default 'shotgun_tag'     -- 'shotgun_tag' | 'claude_inferred'
);

-- ─────────────────────────────────────────────────────────────────────────
-- target_styles : liste blanche de filtrage électro (cf. §2 & §5).
-- Un événement n'est inséré que si AU MOINS un de ses tags matche une entrée
-- active de cette table. Éditable via le dashboard, sans toucher au scraper.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists target_styles (
  id           uuid primary key default gen_random_uuid(),
  shotgun_tag  text not null unique,             -- libellé exact du tag Shotgun
  active       boolean not null default true
);

-- ─────────────────────────────────────────────────────────────────────────
-- events : événements collectés. Purge > 1 an (cf. §8).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists events (
  id                uuid primary key default gen_random_uuid(),
  shotgun_event_id  text not null unique,        -- clé de déduplication
  title             text not null,
  event_date        timestamptz,
  venue_name        text,
  city_id           uuid references cities(id) on delete set null,
  organizer_id      uuid references organizers(id) on delete set null,
  price_min         numeric,
  url               text,
  image_url         text,
  scraped_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists events_city_date   on events (city_id, event_date desc);
create index if not exists events_organizer   on events (organizer_id);
create index if not exists events_event_date  on events (event_date desc);
create index if not exists events_scraped_at  on events (scraped_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- event_styles : liaison N-N événement <-> style
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists event_styles (
  event_id uuid not null references events(id) on delete cascade,
  style_id uuid not null references styles(id) on delete cascade,
  primary key (event_id, style_id)
);
create index if not exists event_styles_style on event_styles (style_id);

-- ─────────────────────────────────────────────────────────────────────────
-- report_runs : trace des envois de rapport, pour détecter les villes ajoutées
-- depuis le dernier rapport (cf. vue new_cities_report, §5).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists report_runs (
  id       uuid primary key default gen_random_uuid(),
  sent_at  timestamptz not null default now(),
  summary  jsonb
);

-- ─────────────────────────────────────────────────────────────────────────
-- scrape_runs : journal des runs du scraper (robustesse / alerting, cf. §10).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists scrape_runs (
  id             uuid primary key default gen_random_uuid(),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running',  -- running | success | partial | failed
  events_seen    integer not null default 0,
  events_created integer not null default 0,
  events_updated integer not null default 0,
  errors         jsonb not null default '[]'::jsonb
);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at auto sur events
-- ─────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();
