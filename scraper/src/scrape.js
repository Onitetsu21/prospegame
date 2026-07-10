// ============================================================================
// Job de scraping quotidien.
// Lit les villes actives + la liste blanche électro depuis la DB, parcourt les
// pages de listing Shotgun, et upsert chaque événement (le filtrage électro est
// appliqué côté SQL par upsert_event). Journalise le run dans scrape_runs.
// ============================================================================
import {
  getActiveCities,
  getActiveTargetStyles,
  startScrapeRun,
  finishScrapeRun,
  upsertEvent,
} from './lib/db.js';
import { cityUrl, fetchHtml, parseCityPage } from './lib/shotgun.js';

async function main() {
  const runId = await startScrapeRun();
  const errors = [];
  let seen = 0;
  let created = 0;
  let updated = 0;

  try {
    const [cities, whitelist] = await Promise.all([
      getActiveCities(),
      getActiveTargetStyles(),
    ]);

    if (cities.length === 0) {
      console.warn('[scrape] Aucune ville active. Rien à faire.');
    }
    console.log(
      `[scrape] ${cities.length} ville(s) active(s), ${whitelist.length} style(s) whitelisté(s).`
    );

    for (const city of cities) {
      const url = cityUrl(city.shotgun_slug);
      console.log(`[scrape] → ${city.name} (${url})`);
      try {
        const html = await fetchHtml(url);
        const events = parseCityPage(html, city.shotgun_slug);

        // Alerting : une page ville sans aucun événement est suspecte
        // (changement de structure HTML probable — cf. §10). On ne fait pas
        // échouer tout le run, mais on trace l'incident.
        if (events.length === 0) {
          const msg = `Aucun événement parsé pour ${city.name} — structure HTML à vérifier ?`;
          console.warn(`[scrape] ⚠️  ${msg}`);
          errors.push({ city: city.shotgun_slug, message: msg });
          continue;
        }

        console.log(`[scrape]   ${events.length} événement(s) trouvé(s)`);
        for (const ev of events) {
          seen++;
          try {
            const res = await upsertEvent(ev);
            if (res === 'created') created++;
            else if (res === 'updated') updated++;
          } catch (e) {
            errors.push({ city: city.shotgun_slug, event: ev.shotgunEventId, message: e.message });
            console.error(`[scrape]   ✗ ${ev.shotgunEventId}: ${e.message}`);
          }
        }
      } catch (e) {
        errors.push({ city: city.shotgun_slug, message: e.message });
        console.error(`[scrape] ✗ ${city.name}: ${e.message}`);
      }
    }

    const status = errors.length === 0 ? 'success' : 'partial';
    await finishScrapeRun(runId, {
      status,
      events_seen: seen,
      events_created: created,
      events_updated: updated,
      errors,
    });
    console.log(
      `[scrape] Terminé (${status}) — vus:${seen} créés:${created} maj:${updated} erreurs:${errors.length}`
    );
    // Code de sortie non nul si des erreurs -> visible dans GitHub Actions.
    process.exit(errors.length === 0 ? 0 : 1);
  } catch (e) {
    console.error(`[scrape] ✗ Échec global : ${e.message}`);
    await finishScrapeRun(runId, {
      status: 'failed',
      events_seen: seen,
      events_created: created,
      events_updated: updated,
      errors: [...errors, { message: e.message }],
    });
    process.exit(1);
  }
}

main();
