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

// Nombre max de pages parcourues par ville (garde-fou anti-boucle).
const MAX_PAGES = parseInt(process.env.SCRAPE_MAX_PAGES || '15', 10);

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
      console.log(`[scrape] → ${city.name} (${cityUrl(city.shotgun_slug)})`);
      try {
        // Pagination : la page ville n'affiche qu'une tranche de jours ; on
        // boucle sur ?page=N jusqu'à épuisement / dépassement de l'horizon.
        const collected = new Map();
        let page = 0;
        let firstPageEmpty = false;
        while (page < MAX_PAGES) {
          const html = await fetchRenderedHtml(cityUrl(city.shotgun_slug, page));
          if (config.debugDump && page === 0) {
            await writeFile(`debug-${city.shotgun_slug}.html`, html);
            console.log(`[scrape]   (debug) HTML page 0 écrit dans debug-${city.shotgun_slug}.html`);
          }
          const parsed = parseCityPage(html, city.shotgun_slug);
          if (parsed.length === 0) {
            if (page === 0) firstPageEmpty = true;
            break; // plus de contenu
          }
          let newCount = 0;
          let anyWithin = false;
          for (const ev of parsed) {
            if (!collected.has(ev.shotgunEventId)) { collected.set(ev.shotgunEventId, ev); newCount++; }
            if (withinHorizon(ev)) anyWithin = true;
          }
          console.log(`[scrape]   page ${page}: ${parsed.length} carte(s), +${newCount} nouvelle(s)`);
          if (newCount === 0) break;      // pagination qui boucle
          if (!anyWithin) break;          // tout au-delà de l'horizon
          page++;
        }

        // Alerting : page 0 vide = challenge non résolu ou structure modifiée (§10).
        if (firstPageEmpty) {
          const msg = `Aucun événement parsé pour ${city.name} — challenge non résolu ou structure HTML à vérifier ?`;
          console.warn(`[scrape] ⚠️  ${msg}`);
          errors.push({ city: city.shotgun_slug, message: msg });
          continue;
        }

        const all = [...collected.values()];
        const events = all.filter(withinHorizon);
        console.log(`[scrape]   ${events.length}/${all.length} événement(s) retenu(s) (horizon)`);
        let skippedHere = 0;
        for (const ev of events) {
          seen++;
          try {
            const res = await upsertEvent(ev);
            if (res === 'created') created++;
            else if (res === 'updated') updated++;
            else if (res === 'skipped') {
              skippedHere++;
              // Diagnostic : afficher pourquoi (tags manquants ou hors whitelist).
              if (skippedHere <= 8) {
                console.log(
                  `[scrape]   ⊘ skip "${ev.title}" — tags=[${(ev.tags || []).join(', ') || '∅'}]`
                );
              }
            }
          } catch (e) {
            errors.push({ city: city.shotgun_slug, event: ev.shotgunEventId, message: e.message });
            console.error(`[scrape]   ✗ ${ev.shotgunEventId}: ${e.message}`);
          }
        }
        if (skippedHere > 0) {
          console.log(
            `[scrape]   ${skippedHere} skippé(s) (aucun tag ne matche la liste blanche électro).`
          );
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
