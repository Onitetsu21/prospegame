// ============================================================================
// Job de scraping quotidien.
// Lit les villes actives + la liste blanche électro depuis la DB, REND chaque
// page de listing Shotgun via navigateur headless (challenge anti-bot Vercel),
// puis upsert chaque événement (le filtrage électro est appliqué côté SQL par
// upsert_event). Journalise le run dans scrape_runs.
// ============================================================================
import { writeFile } from 'node:fs/promises';
import {
  getActiveCities,
  getActiveTargetStyles,
  startScrapeRun,
  finishScrapeRun,
  upsertEvent,
} from './lib/db.js';
import { cityUrl, parseCityPage } from './lib/shotgun.js';
import { fetchRenderedHtml, closeBrowser } from './lib/browser.js';
import { config } from './lib/env.js';

// Borne d'horizon : événements au-delà de N mois écartés (Shotgun ne liste que
// l'à-venir ; on garde ce qui tombe dans la fenêtre demandée).
const horizonLimit =
  config.horizonMonths > 0
    ? Date.now() + config.horizonMonths * 30 * 86400000
    : Infinity;

function withinHorizon(ev) {
  if (!ev.eventDate) return true; // date inconnue : on garde, la dédup gérera
  const t = new Date(ev.eventDate).getTime();
  if (isNaN(t)) return true;
  // on écarte le lointain futur ET le passé de plus de 2 jours
  return t <= horizonLimit && t >= Date.now() - 2 * 86400000;
}

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

    if (cities.length === 0) console.warn('[scrape] Aucune ville active. Rien à faire.');
    console.log(
      `[scrape] ${cities.length} ville(s) active(s), ${whitelist.length} style(s) whitelisté(s), ` +
        `horizon ${config.horizonMonths || '∞'} mois.`
    );

    for (const city of cities) {
      const url = cityUrl(city.shotgun_slug);
      console.log(`[scrape] → ${city.name} (${url})`);
      try {
        const html = await fetchRenderedHtml(url);
        if (config.debugDump) {
          await writeFile(`debug-${city.shotgun_slug}.html`, html);
          console.log(`[scrape]   (debug) HTML rendu écrit dans debug-${city.shotgun_slug}.html`);
        }

        const all = parseCityPage(html, city.shotgun_slug);
        const events = all.filter(withinHorizon);

        // Alerting : une page ville sans aucun événement est suspecte
        // (challenge non résolu ou structure HTML modifiée — cf. §10).
        if (all.length === 0) {
          const msg = `Aucun événement parsé pour ${city.name} — challenge non résolu ou structure HTML à vérifier ?`;
          console.warn(`[scrape] ⚠️  ${msg}`);
          errors.push({ city: city.shotgun_slug, message: msg });
          continue;
        }

        console.log(`[scrape]   ${events.length}/${all.length} événement(s) retenu(s) (horizon)`);
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
      status, events_seen: seen, events_created: created, events_updated: updated, errors,
    });
    console.log(
      `[scrape] Terminé (${status}) — vus:${seen} créés:${created} maj:${updated} erreurs:${errors.length}`
    );
    await closeBrowser();
    process.exit(errors.length === 0 ? 0 : 1);
  } catch (e) {
    console.error(`[scrape] ✗ Échec global : ${e.message}`);
    await finishScrapeRun(runId, {
      status: 'failed', events_seen: seen, events_created: created, events_updated: updated,
      errors: [...errors, { message: e.message }],
    });
    await closeBrowser();
    process.exit(1);
  }
}

main();
