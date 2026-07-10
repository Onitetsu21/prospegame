import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

// Client Supabase avec la clé service_role : contourne la RLS (usage serveur
// uniquement — ne jamais exposer cette clé côté frontend).
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});

export async function getActiveCities() {
  const { data, error } = await db
    .from('cities')
    .select('id, name, shotgun_slug, added_at')
    .eq('active', true);
  if (error) throw new Error(`Lecture cities : ${error.message}`);
  return data ?? [];
}

export async function getActiveTargetStyles() {
  const { data, error } = await db
    .from('target_styles')
    .select('shotgun_tag')
    .eq('active', true);
  if (error) throw new Error(`Lecture target_styles : ${error.message}`);
  return (data ?? []).map((r) => r.shotgun_tag);
}

// Journal de run (robustesse / alerting — cf. §10)
export async function startScrapeRun() {
  const { data, error } = await db
    .from('scrape_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();
  if (error) throw new Error(`Création scrape_run : ${error.message}`);
  return data.id;
}

export async function finishScrapeRun(id, patch) {
  const { error } = await db
    .from('scrape_runs')
    .update({ finished_at: new Date().toISOString(), ...patch })
    .eq('id', id);
  if (error) console.error(`[db] Clôture scrape_run échouée : ${error.message}`);
}

// Upsert atomique d'un événement (filtrage électro appliqué côté SQL).
// Retourne 'created' | 'updated' | 'skipped'.
export async function upsertEvent(ev) {
  const { data, error } = await db.rpc('upsert_event', {
    p_shotgun_event_id: ev.shotgunEventId,
    p_title: ev.title,
    p_event_date: ev.eventDate,
    p_venue_name: ev.venueName,
    p_city_slug: ev.citySlug,
    p_organizer_name: ev.organizerName,
    p_organizer_shotgun_id: ev.organizerShotgunId,
    p_organizer_url: ev.organizerUrl,
    p_price_min: ev.priceMin,
    p_url: ev.url,
    p_image_url: ev.imageUrl,
    p_tags: ev.tags,
  });
  if (error) throw new Error(`upsert_event(${ev.shotgunEventId}): ${error.message}`);
  return data;
}
