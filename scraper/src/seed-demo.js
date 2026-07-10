// ============================================================================
// Génère un jeu de données de démonstration réaliste dans la base (organisateurs,
// événements, styles) pour visualiser le dashboard sans attendre un vrai scrape.
//   node src/seed-demo.js         → insère ~180 événements de démo
//   node src/seed-demo.js --wipe  → vide events/event_styles/organizers d'abord
// Les villes & la liste blanche doivent déjà exister (migration 0004_seed.sql).
// ============================================================================
import { db } from './lib/db.js';
import { upsertEvent } from './lib/db.js';

const CITIES = ['lyon', 'paris', 'marseille'];
const STYLES = ['Techno', 'Hard Techno', 'House', 'Deep House', 'Tech House',
  'Trance', 'Psytrance', 'Afro House', 'Drum & Bass', 'Hardcore', 'Minimal', 'Disco'];
const ORGANIZERS = [
  'Nuits Sonores', 'Terminal Club', 'Basement Collective', 'Warehouse Project',
  'Sub Culture', 'La Machine', 'Concrete Lab', 'Modular', 'Deviant', 'Klangkultur',
  'Acid Arab crew', 'Polyphonie', 'Rinse Nights', 'Bloc Party', 'Distrikt',
  'Cabaret Sauvage', 'Le Sucre Prod', 'Voxx', 'Reset', 'Analog',
];
const VENUES = ['Le Sucre', 'La Marbrerie', 'Warehouse', 'Le Cabaret', 'Docks',
  'Le Rex', 'Dehors Brut', 'La Station', 'T7', 'La Dame de Canton', 'Friche Belle de Mai'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

async function main() {
  if (process.argv.includes('--wipe')) {
    console.log('[seed] Purge des données existantes…');
    await db.from('event_styles').delete().neq('event_id', '00000000-0000-0000-0000-000000000000');
    await db.from('events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('organizers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const N = 180;
  let ok = 0;
  for (let i = 0; i < N; i++) {
    // event_date réparti de -5 mois à +2 mois autour d'aujourd'hui
    const offsetDays = randInt(-150, 60);
    const date = new Date(Date.now() + offsetDays * 86400000);
    date.setHours(randInt(20, 23), rand([0, 30]), 0, 0);

    const tags = Array.from(new Set([rand(STYLES), rand(STYLES), rand(STYLES)]));
    const orgName = rand(ORGANIZERS);
    const slug = rand(CITIES);

    const res = await upsertEvent({
      shotgunEventId: `demo-${i}-${Date.now()}`,
      title: `${rand(['Nuit', 'Night', 'Session', 'Rave', 'Warehouse', 'Open Air'])} ${rand(['Techno', 'Trance', 'House', 'Bass', 'Acid'])} #${randInt(1, 40)}`,
      eventDate: date.toISOString(),
      venueName: rand(VENUES),
      citySlug: slug,
      organizerName: orgName,
      organizerShotgunId: `org-${orgName.toLowerCase().replace(/\W+/g, '-')}`,
      organizerUrl: `https://shotgun.live/organizers/${orgName.toLowerCase().replace(/\W+/g, '-')}`,
      priceMin: rand([null, 8, 10, 12, 15, 18, 22, 25]),
      url: `https://shotgun.live/events/demo-${i}`,
      imageUrl: null,
      tags,
    });
    if (res !== 'skipped') ok++;
  }
  console.log(`[seed] ${ok}/${N} événements de démo insérés.`);
}

main().catch((e) => {
  console.error(`[seed] ✗ ${e.message}`);
  process.exit(1);
});
