import { supabase, hasSupabase } from './supabase';
import { mockCities, mockEvents } from './mock';
import type {
  City, EventRow, Filters, OrganizerStat, StyleTrend, NewEntrant, StyleByCity, TargetStyle,
} from './types';

const monthsAgoIso = (m: number) => new Date(Date.now() - m * 30 * 86400000).toISOString();
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

// ─── Villes ──────────────────────────────────────────────────────────────
export async function getCities(): Promise<City[]> {
  if (!hasSupabase) return [...mockCities];
  const { data, error } = await supabase!.from('cities').select('*').order('name');
  if (error) throw error;
  return data as City[];
}

export async function addCity(name: string, slug: string): Promise<void> {
  if (!hasSupabase) {
    mockCities.push({ id: `c-${slug}`, name, shotgun_slug: slug, active: true, added_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase!.from('cities').insert({ name, shotgun_slug: slug, active: true });
  if (error) throw error;
}

export async function setCityActive(id: string, active: boolean): Promise<void> {
  if (!hasSupabase) {
    const c = mockCities.find((x) => x.id === id);
    if (c) c.active = active;
    return;
  }
  const { error } = await supabase!.from('cities').update({ active }).eq('id', id);
  if (error) throw error;
}

// ─── Événements ──────────────────────────────────────────────────────────
export async function getEvents(f: Filters): Promise<EventRow[]> {
  if (!hasSupabase) return filterEventsLocal(mockEvents, f);

  let q = supabase!
    .from('events_enriched')
    .select('*')
    .gte('event_date', monthsAgoIso(f.months))
    .order('event_date', { ascending: false })
    .limit(500);
  if (f.citySlug) q = q.eq('city_slug', f.citySlug);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data as EventRow[]) ?? [];
  if (f.style) rows = rows.filter((e) => e.styles?.includes(f.style!));
  if (f.search) {
    const s = f.search.toLowerCase();
    rows = rows.filter(
      (e) =>
        e.title?.toLowerCase().includes(s) ||
        e.organizer_name?.toLowerCase().includes(s) ||
        e.venue_name?.toLowerCase().includes(s)
    );
  }
  return rows;
}

function filterEventsLocal(rows: EventRow[], f: Filters): EventRow[] {
  const since = monthsAgoIso(f.months);
  const s = f.search.toLowerCase();
  return rows
    .filter((e) => (e.event_date ?? '') >= since)
    .filter((e) => !f.citySlug || e.city_slug === f.citySlug)
    .filter((e) => !f.style || e.styles.includes(f.style!))
    .filter(
      (e) =>
        !s ||
        e.title.toLowerCase().includes(s) ||
        (e.organizer_name ?? '').toLowerCase().includes(s) ||
        (e.venue_name ?? '').toLowerCase().includes(s)
    )
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''));
}

// ─── Organisateurs (organizer_stats) ─────────────────────────────────────
export async function getOrganizerStats(f: Filters): Promise<OrganizerStat[]> {
  if (!hasSupabase) return deriveOrganizerStats(f);
  const { data, error } = await supabase!
    .from('organizer_stats')
    .select('*')
    .order('events_6m', { ascending: false })
    .limit(300);
  if (error) throw error;
  let rows = (data as OrganizerStat[]) ?? [];
  if (f.citySlug) {
    const cityName = mockCities.find((c) => c.shotgun_slug === f.citySlug)?.name;
    rows = rows.filter((o) => !cityName || (o.cities ?? []).includes(cityName));
  }
  if (f.search) {
    const s = f.search.toLowerCase();
    rows = rows.filter((o) => o.organizer_name.toLowerCase().includes(s));
  }
  return rows;
}

function deriveOrganizerStats(f: Filters): OrganizerStat[] {
  const rows = filterEventsLocal(mockEvents, { ...f, style: null, search: '' });
  const map = new Map<string, OrganizerStat>();
  const sixM = monthsAgoIso(6);
  const d30 = daysAgoIso(30);
  for (const e of mockEvents) {
    if (!e.organizer_id) continue;
    let o = map.get(e.organizer_id);
    if (!o) {
      o = {
        organizer_id: e.organizer_id,
        organizer_name: e.organizer_name ?? '—',
        profile_url: e.organizer_url,
        first_seen_at: e.scraped_at,
        last_seen_at: e.scraped_at,
        events_total: 0, events_6m: 0, events_30d: 0,
        cities: [], styles: [], last_event_date: null,
      };
      map.set(e.organizer_id, o);
    }
    o.events_total++;
    if ((e.event_date ?? '') >= sixM) o.events_6m++;
    if ((e.event_date ?? '') >= d30) o.events_30d++;
    if (e.scraped_at < o.first_seen_at) o.first_seen_at = e.scraped_at;
    if (e.city_name && !o.cities!.includes(e.city_name)) o.cities!.push(e.city_name);
    for (const st of e.styles) if (!o.styles!.includes(st)) o.styles!.push(st);
    if (!o.last_event_date || (e.event_date ?? '') > o.last_event_date) o.last_event_date = e.event_date;
  }
  let out = [...map.values()];
  const cityName = mockCities.find((c) => c.shotgun_slug === f.citySlug)?.name;
  if (f.citySlug) out = out.filter((o) => (o.cities ?? []).includes(cityName!));
  if (f.search) out = out.filter((o) => o.organizer_name.toLowerCase().includes(f.search.toLowerCase()));
  void rows;
  return out.sort((a, b) => b.events_6m - a.events_6m);
}

// ─── Styles (style_trends + style_by_city) ───────────────────────────────
export async function getStyleTrends(): Promise<StyleTrend[]> {
  if (!hasSupabase) return deriveStyleTrends();
  const { data, error } = await supabase!.from('style_trends').select('*').order('events_4w', { ascending: false });
  if (error) throw error;
  return (data as StyleTrend[]) ?? [];
}

function deriveStyleTrends(): StyleTrend[] {
  const w4 = daysAgoIso(28), w12 = daysAgoIso(84), w26 = daysAgoIso(182);
  const map = new Map<string, StyleTrend>();
  for (const e of mockEvents) {
    for (const label of e.styles) {
      let s = map.get(label);
      if (!s) { s = { style_id: label, style_label: label, events_4w: 0, events_12w: 0, events_26w: 0, events_total: 0 }; map.set(label, s); }
      s.events_total++;
      const d = e.event_date ?? '';
      if (d >= w4) s.events_4w++;
      if (d >= w12) s.events_12w++;
      if (d >= w26) s.events_26w++;
    }
  }
  return [...map.values()].sort((a, b) => b.events_4w - a.events_4w);
}

export async function getStyleByCity(): Promise<StyleByCity[]> {
  if (!hasSupabase) return deriveStyleByCity();
  const { data, error } = await supabase!.from('style_by_city').select('*');
  if (error) throw error;
  return (data as StyleByCity[]) ?? [];
}

function deriveStyleByCity(): StyleByCity[] {
  const sixM = monthsAgoIso(6);
  const map = new Map<string, StyleByCity>();
  for (const e of mockEvents) {
    if ((e.event_date ?? '') < sixM || !e.city_id) continue;
    for (const label of e.styles) {
      const key = `${e.city_id}|${label}`;
      let s = map.get(key);
      if (!s) { s = { city_id: e.city_id, city_name: e.city_name ?? '', style_id: label, style_label: label, events_6m: 0 }; map.set(key, s); }
      s.events_6m++;
    }
  }
  return [...map.values()];
}

// ─── Nouveaux entrants (new_entrants) ────────────────────────────────────
export async function getNewEntrants(): Promise<NewEntrant[]> {
  if (!hasSupabase) return deriveNewEntrants();
  const { data, error } = await supabase!.from('new_entrants').select('*').order('first_seen_at', { ascending: false });
  if (error) throw error;
  return (data as NewEntrant[]) ?? [];
}

function deriveNewEntrants(): NewEntrant[] {
  const stats = deriveOrganizerStats({ citySlug: null, style: null, months: 12, search: '' });
  const d30 = daysAgoIso(30);
  return stats
    .filter((o) => o.first_seen_at >= d30)
    .map((o) => ({
      organizer_id: o.organizer_id,
      organizer_name: o.organizer_name,
      profile_url: o.profile_url,
      first_seen_at: o.first_seen_at,
      last_seen_at: o.last_seen_at,
      events_total: o.events_total,
      cities: o.cities,
      styles: o.styles,
    }))
    .sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at));
}

// ─── Liste blanche (target_styles) ───────────────────────────────────────
const MOCK_TARGET: TargetStyle[] = [
  'Techno', 'Hard Techno', 'House', 'Deep House', 'Tech House', 'Afro House',
  'Trance', 'Psytrance', 'Drum & Bass', 'Hardcore', 'Minimal', 'Disco',
].map((t, i) => ({ id: `t-${i}`, shotgun_tag: t, active: true }));

export async function getTargetStyles(): Promise<TargetStyle[]> {
  if (!hasSupabase) return [...MOCK_TARGET];
  const { data, error } = await supabase!.from('target_styles').select('*').order('shotgun_tag');
  if (error) throw error;
  return (data as TargetStyle[]) ?? [];
}

export async function setTargetStyleActive(id: string, active: boolean): Promise<void> {
  if (!hasSupabase) {
    const t = MOCK_TARGET.find((x) => x.id === id);
    if (t) t.active = active;
    return;
  }
  const { error } = await supabase!.from('target_styles').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function addTargetStyle(tag: string): Promise<void> {
  if (!hasSupabase) {
    MOCK_TARGET.push({ id: `t-${Date.now()}`, shotgun_tag: tag, active: true });
    return;
  }
  const { error } = await supabase!.from('target_styles').insert({ shotgun_tag: tag, active: true });
  if (error) throw error;
}
