import { chromium } from 'playwright';
import { config, sleep } from './env.js';

// ============================================================================
// Rendu des pages Shotgun via navigateur headless (Playwright / Chromium).
//
// ⚠️  Shotgun est protégé par le "Vercel Security Checkpoint" (challenge JS
//     anti-bot). Un simple fetch renvoie HTTP 429 + une page de challenge : il
//     FAUT un vrai navigateur qui exécute le JavaScript.
//
//     On réutilise UN SEUL contexte navigateur pour toute la session : le
//     cookie de challenge Vercel persiste, donc il n'est résolu qu'une fois et
//     les pages suivantes (pagination + fiches événement) se chargent vite.
// ============================================================================

let _browser = null;
let _ctx = null;

async function getContext() {
  if (_ctx) return _ctx;
  _browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });
  _ctx = await _browser.newContext({
    userAgent: config.userAgent.startsWith('Mozilla')
      ? config.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1366, height: 900 },
  });
  await _ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return _ctx;
}

export async function closeBrowser() {
  if (_ctx) { await _ctx.close().catch(() => {}); _ctx = null; }
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}

const isChallenge = (t) => /Checkpoint|Security|Just a moment|Attention Required/i.test(t || '');

// Charge une URL et renvoie le HTML rendu. `readySelector` = sélecteur dont la
// présence signale que le contenu utile est chargé (et le challenge résolu).
// `scroll` déclenche le lazy-loading (utile pour les listings, inutile pour une
// fiche événement).
export async function fetchRenderedHtml(
  url,
  { readySelector = 'a[href*="/events/"]', scroll = true } = {}
) {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    // Attente résiliente à la navigation (le challenge recharge la page).
    let ready = false;
    for (let i = 0; i < 15; i++) {
      try {
        await page.waitForSelector(readySelector, { timeout: 3000, state: 'attached' });
        ready = true;
        break;
      } catch {
        /* challenge en cours / navigation -> on réessaie */
      }
    }

    if (ready && scroll) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      for (let s = 0; s < 6; s++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
        await page.waitForTimeout(1200);
      }
    }

    const html = await page.content().catch(() => '');
    const title = await page.title().catch(() => '');
    if (!ready && isChallenge(title)) {
      throw new Error(`Bloqué par le challenge Vercel (titre: "${title}")`);
    }
    await sleep(config.scrapeDelayMs); // rate limiting (§10)
    return html;
  } finally {
    await page.close().catch(() => {});
  }
}
