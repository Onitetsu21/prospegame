import type { City, EventRow } from './types';

// Jeu de données de démonstration déterministe (généré une fois) pour visualiser
// le dashboard sans backend Supabase. Reflète la structure de events_enriched.

const CITIES: City[] = [
  { id: 'c-lyon', name: 'Lyon', shotgun_slug: 'lyon', active: true, added_at: iso(-400) },
  { id: 'c-paris', name: 'Paris', shotgun_slug: 'paris', active: true, added_at: iso(-400) },
  { id: 'c-marseille', name: 'Marseille', shotgun_slug: 'marseille', active: true, added_at: iso(-380) },
  { id: 'c-berlin', name: 'Berlin', shotgun_slug: 'berlin', active: true, added_at: iso(-12) },
];

const STYLES = ['Techno', 'Hard Techno', 'House', 'Deep House', 'Tech House',
  'Trance', 'Psytrance', 'Afro House', 'Drum & Bass', 'Hardcore', 'Minimal', 'Disco'];

const ORGANIZERS = [
  'Nuits Sonores', 'Terminal Club', 'Basement Collective', 'Warehouse Project',
  'Sub Culture', 'La Machine', 'Concrete Lab', 'Modular', 'Deviant', 'Klangkultur',
  'Polyphonie', 'Rinse Nights', 'Distrikt', 'Le Sucre Prod', 'Reset', 'Analog',
  'Möbius', 'Oktave', 'Transmission', 'Peripherik',
];

const VENUES = ['Le Sucre', 'La Marbrerie', 'Warehouse', 'Le Cabaret', 'Docks',
  'Le Rex', 'Dehors Brut', 'La Station', 'T7', 'Friche Belle de Mai', 'Kater Blau'];

// PRNG déterministe (mulberry32) pour un dataset stable entre les rechargements.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString();
}

function build(): EventRow[] {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const events: EventRow[] = [];
  const orgFirstSeen = new Map<string, number>();

  for (let i = 0; i < 220; i++) {
    const offset = Math.floor(r() * 95) - 5; // -5..+90 jours (à-venir, comme Shotgun)
    const org = pick(ORGANIZERS);
    // Berlin (récente) : peu d'events, tous récents
    const city = r() < 0.12 ? CITIES[3] : pick(CITIES.slice(0, 3));
    const cityOffset = city.id === 'c-berlin' ? Math.floor(r() * 60) - 10 : offset;
    const styles = Array.from(
      new Set([pick(STYLES), pick(STYLES), ...(r() < 0.4 ? [pick(STYLES)] : [])])
    );
    if (!orgFirstSeen.has(org)) orgFirstSeen.set(org, cityOffset);

    events.push({
      id: `e-${i}`,
      shotgun_event_id: `sg-${i}`,
      title: `${pick(['Nuit', 'Night', 'Session', 'Rave', 'Warehouse', 'Open Air', 'Klub'])} ${pick(['Techno', 'Trance', 'House', 'Bass', 'Acid', 'Deep'])} #${1 + Math.floor(r() * 40)}`,
      event_date: iso(cityOffset),
      venue_name: pick(VENUES),
      price_min: pick([null, 8, 10, 12, 15, 18, 22, 25]),
      url: 'https://shotgun.live/events/demo',
      image_url: null,
      scraped_at: iso(Math.min(0, cityOffset - Math.floor(r() * 30))),
      city_id: city.id,
      city_name: city.name,
      city_slug: city.shotgun_slug,
      organizer_id: `o-${org}`,
      organizer_name: org,
      organizer_url: 'https://shotgun.live/organizers/demo',
      styles,
    });
  }

  // Quelques nouveaux entrants (détectés < 30 j) — pour illustrer la vue dédiée.
  const NEWCOMERS = ['Halcyon', 'Nocturne Lab', 'Vortex Collective', 'Éclipse'];
  let id = 1000;
  NEWCOMERS.forEach((org, k) => {
    const scrapedOffset = -(4 + k * 5); // -4, -9, -14, -19 jours
    const nEvents = 1 + Math.floor(r() * 3);
    for (let j = 0; j < nEvents; j++) {
      const city = pick(CITIES);
      events.push({
        id: `e-${id}`,
        shotgun_event_id: `sg-${id}`,
        title: `${pick(['Debut', 'First', 'Opening', 'Premiere'])} ${pick(['Techno', 'House', 'Trance', 'Bass'])} #${1 + Math.floor(r() * 12)}`,
        event_date: iso(Math.floor(r() * 45) + 3),
        venue_name: pick(VENUES),
        price_min: pick([null, 10, 12, 15]),
        url: 'https://shotgun.live/events/demo',
        image_url: null,
        scraped_at: iso(scrapedOffset),
        city_id: city.id,
        city_name: city.name,
        city_slug: city.shotgun_slug,
        organizer_id: `o-${org}`,
        organizer_name: org,
        organizer_url: 'https://shotgun.live/organizers/demo',
        styles: Array.from(new Set([pick(STYLES), pick(STYLES)])),
      });
      id++;
    }
  });
  return events;
}

export const mockCities = CITIES;
export const mockEvents = build();
