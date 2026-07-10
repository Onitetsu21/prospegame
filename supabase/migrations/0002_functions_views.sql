-- ============================================================================
-- ProspeGame — Vues de stats, RPC d'upsert atomique, et purge (cf. §5 & §8)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Vue : événements enrichis (jointures fréquentes côté dashboard)
-- ─────────────────────────────────────────────────────────────────────────
create or replace view events_enriched as
select
  e.id,
  e.shotgun_event_id,
  e.title,
  e.event_date,
  e.venue_name,
  e.price_min,
  e.url,
  e.image_url,
  e.scraped_at,
  e.updated_at,
  c.id   as city_id,
  c.name as city_name,
  c.shotgun_slug as city_slug,
  o.id   as organizer_id,
  o.name as organizer_name,
  o.profile_url as organizer_url,
  coalesce(
    (select array_agg(s.label order by s.label)
       from event_styles es join styles s on s.id = es.style_id
      where es.event_id = e.id),
    '{}'::text[]
  ) as styles
from events e
left join cities c     on c.id = e.city_id
left join organizers o on o.id = e.organizer_id;

-- ─────────────────────────────────────────────────────────────────────────
-- organizer_stats : nb d'événements par organisateur sur 6 mois (cf. §5)
-- ─────────────────────────────────────────────────────────────────────────
create or replace view organizer_stats as
select
  o.id            as organizer_id,
  o.name          as organizer_name,
  o.profile_url,
  o.first_seen_at,
  o.last_seen_at,
  count(e.id)                                        as events_total,
  count(e.id) filter (
    where e.event_date >= now() - interval '6 months'
  )                                                  as events_6m,
  count(e.id) filter (
    where e.event_date >= now() - interval '30 days'
  )                                                  as events_30d,
  array_agg(distinct c.name)   filter (where c.name  is not null) as cities,
  (select array_agg(distinct s.label)
     from event_styles es
     join styles s on s.id = es.style_id
     join events e2 on e2.id = es.event_id
    where e2.organizer_id = o.id)                    as styles,
  max(e.event_date)                                  as last_event_date
from organizers o
left join events e on e.organizer_id = o.id
left join cities c on c.id = e.city_id
group by o.id, o.name, o.profile_url, o.first_seen_at, o.last_seen_at;

-- ─────────────────────────────────────────────────────────────────────────
-- style_trends : nb d'événements par style sur 4 / 12 / 26 dernières semaines
-- (fenêtres glissantes basées sur event_date)
-- ─────────────────────────────────────────────────────────────────────────
create or replace view style_trends as
select
  s.id    as style_id,
  s.label as style_label,
  count(e.id) filter (where e.event_date >= now() - interval '4 weeks')  as events_4w,
  count(e.id) filter (where e.event_date >= now() - interval '12 weeks') as events_12w,
  count(e.id) filter (where e.event_date >= now() - interval '26 weeks') as events_26w,
  count(e.id)                                                            as events_total
from styles s
left join event_styles es on es.style_id = s.id
left join events e        on e.id = es.event_id
group by s.id, s.label;

-- ─────────────────────────────────────────────────────────────────────────
-- new_entrants : organisateurs vus pour la première fois il y a < 30 jours
-- ─────────────────────────────────────────────────────────────────────────
create or replace view new_entrants as
select
  o.id            as organizer_id,
  o.name          as organizer_name,
  o.profile_url,
  o.first_seen_at,
  o.last_seen_at,
  count(e.id)                                    as events_total,
  array_agg(distinct c.name) filter (where c.name is not null) as cities,
  (select array_agg(distinct s.label)
     from event_styles es
     join styles s on s.id = es.style_id
     join events e2 on e2.id = es.event_id
    where e2.organizer_id = o.id)                as styles
from organizers o
left join events e on e.organizer_id = o.id
left join cities c on c.id = e.city_id
where o.first_seen_at >= now() - interval '30 days'
group by o.id, o.name, o.profile_url, o.first_seen_at, o.last_seen_at;

-- ─────────────────────────────────────────────────────────────────────────
-- style_by_city : répartition des événements par style et par ville (6 mois)
-- ─────────────────────────────────────────────────────────────────────────
create or replace view style_by_city as
select
  c.id    as city_id,
  c.name  as city_name,
  s.id    as style_id,
  s.label as style_label,
  count(e.id) as events_6m
from events e
join cities c        on c.id = e.city_id
join event_styles es on es.event_id = e.id
join styles s        on s.id = es.style_id
where e.event_date >= now() - interval '6 months'
group by c.id, c.name, s.id, s.label;

-- ─────────────────────────────────────────────────────────────────────────
-- new_cities_report : villes ajoutées depuis le dernier rapport, avec leurs
-- premiers résultats agrégés (cf. §5).
-- ─────────────────────────────────────────────────────────────────────────
create or replace view new_cities_report as
with last_report as (
  select coalesce(max(sent_at), 'epoch'::timestamptz) as sent_at from report_runs
)
select
  c.id,
  c.name,
  c.shotgun_slug,
  c.added_at,
  count(e.id) as events_collected,
  count(distinct e.organizer_id) as organizers_collected
from cities c
left join events e on e.city_id = c.id
where c.added_at > (select sent_at from last_report)
group by c.id, c.name, c.shotgun_slug, c.added_at;

-- ─────────────────────────────────────────────────────────────────────────
-- RPC upsert_event : insertion / mise à jour atomique d'un événement scrapé,
-- avec son organisateur et ses styles. Applique le filtrage électro (§2/§5) :
-- l'événement n'est retenu que si au moins un tag matche target_styles(active).
-- Retourne 'created' | 'updated' | 'skipped'.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function upsert_event(
  p_shotgun_event_id text,
  p_title            text,
  p_event_date       timestamptz,
  p_venue_name       text,
  p_city_slug        text,
  p_organizer_name   text,
  p_organizer_shotgun_id text,
  p_organizer_url    text,
  p_price_min        numeric,
  p_url              text,
  p_image_url        text,
  p_tags             text[]
) returns text
language plpgsql
as $$
declare
  v_city_id       uuid;
  v_organizer_id  uuid;
  v_event_id      uuid;
  v_existing      uuid;
  v_matched_tags  text[];
  v_tag           text;
  v_style_id      uuid;
  v_result        text;
begin
  -- Filtrage électro : ne garder que les tags présents & actifs dans target_styles
  select array_agg(t.shotgun_tag)
    into v_matched_tags
  from target_styles t
  where t.active
    and t.shotgun_tag = any(p_tags);

  if v_matched_tags is null or array_length(v_matched_tags, 1) is null then
    return 'skipped';  -- aucun tag électro whitelisté -> on écarte
  end if;

  -- Ville
  select id into v_city_id from cities where shotgun_slug = p_city_slug;
  if v_city_id is null then
    return 'skipped';  -- ville non suivie
  end if;

  -- Organisateur (upsert par shotgun_id si dispo, sinon par nom)
  if p_organizer_shotgun_id is not null then
    select id into v_organizer_id from organizers where shotgun_id = p_organizer_shotgun_id;
  end if;
  if v_organizer_id is null and p_organizer_name is not null then
    select id into v_organizer_id from organizers where name = p_organizer_name and shotgun_id is null;
  end if;

  if v_organizer_id is null and p_organizer_name is not null then
    insert into organizers (shotgun_id, name, profile_url)
    values (p_organizer_shotgun_id, p_organizer_name, p_organizer_url)
    returning id into v_organizer_id;
  elsif v_organizer_id is not null then
    update organizers
       set last_seen_at = now(),
           profile_url  = coalesce(p_organizer_url, profile_url),
           shotgun_id   = coalesce(shotgun_id, p_organizer_shotgun_id)
     where id = v_organizer_id;
  end if;

  -- Événement (dédup sur shotgun_event_id)
  select id into v_existing from events where shotgun_event_id = p_shotgun_event_id;

  if v_existing is null then
    insert into events (
      shotgun_event_id, title, event_date, venue_name, city_id,
      organizer_id, price_min, url, image_url
    ) values (
      p_shotgun_event_id, p_title, p_event_date, p_venue_name, v_city_id,
      v_organizer_id, p_price_min, p_url, p_image_url
    ) returning id into v_event_id;
    v_result := 'created';
  else
    update events set
      title      = p_title,
      event_date = coalesce(p_event_date, event_date),
      venue_name = coalesce(p_venue_name, venue_name),
      city_id    = v_city_id,
      organizer_id = coalesce(v_organizer_id, organizer_id),
      price_min  = coalesce(p_price_min, price_min),
      url        = coalesce(p_url, url),
      image_url  = coalesce(p_image_url, image_url)
    where id = v_existing;
    v_event_id := v_existing;
    v_result := 'updated';
  end if;

  -- Styles (normalisation + liaison), uniquement les tags whitelistés
  foreach v_tag in array v_matched_tags loop
    select id into v_style_id from styles where label = v_tag;
    if v_style_id is null then
      insert into styles (label, source) values (v_tag, 'shotgun_tag')
      on conflict (label) do update set label = excluded.label
      returning id into v_style_id;
    end if;
    insert into event_styles (event_id, style_id)
    values (v_event_id, v_style_id)
    on conflict do nothing;
  end loop;

  return v_result;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- RPC purge_old_events : supprime les événements dont event_date > 1 an (§8).
-- event_styles est nettoyé par cascade. organizers & styles sont conservés.
-- Retourne le nombre de lignes supprimées.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function purge_old_events() returns integer
language plpgsql
as $$
declare
  v_deleted integer;
begin
  with del as (
    delete from events
    where event_date is not null
      and event_date < now() - interval '1 year'
    returning 1
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end;
$$;
