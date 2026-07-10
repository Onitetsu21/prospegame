-- ============================================================================
-- ProspeGame — Row Level Security
--
-- Outil à usage strictement personnel (mono-utilisateur, cf. §1 du cahier).
-- Le dashboard utilise la clé "anon" publishable. On autorise :
--   • lecture   (select) sur toutes les tables/vues nécessaires au dashboard ;
--   • écriture  (insert/update) sur `cities` et `target_styles` uniquement,
--     pour la gestion des villes et de la liste blanche depuis l'UI (§6.5).
-- Le scraper et les jobs utilisent la clé service_role, qui contourne la RLS.
--
-- ⚠️  Si l'outil devenait multi-utilisateur ou exposé publiquement, remplacer
--     ces policies par une auth Supabase (voir README, section "Sécurité").
-- ============================================================================

alter table cities         enable row level security;
alter table organizers     enable row level security;
alter table styles         enable row level security;
alter table target_styles  enable row level security;
alter table events         enable row level security;
alter table event_styles   enable row level security;
alter table scrape_runs    enable row level security;
alter table report_runs    enable row level security;

-- Lecture publique (anon + authenticated)
do $$
declare t text;
begin
  foreach t in array array[
    'cities','organizers','styles','target_styles',
    'events','event_styles','scrape_runs','report_runs'
  ]
  loop
    execute format(
      'drop policy if exists "read_%1$s" on %1$s; '
      'create policy "read_%1$s" on %1$s for select using (true);', t);
  end loop;
end $$;

-- Gestion des villes depuis le dashboard
drop policy if exists "write_cities" on cities;
create policy "write_cities" on cities
  for all using (true) with check (true);

-- Gestion de la liste blanche de styles depuis le dashboard
drop policy if exists "write_target_styles" on target_styles;
create policy "write_target_styles" on target_styles
  for all using (true) with check (true);
