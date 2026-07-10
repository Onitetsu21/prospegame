import { chromium } from 'playwright';
import { config, sleep } from './env.js';

// ============================================================================
// Rendu des pages Shotgun via navigateur headless (Playwright / Chromium).
//
// ⚠️  Shotgun est protégé par le "Vercel Security Checkpoint" (challenge JS
//     anti-bot). Un simple fetch renvoie HTTP 429 + une page de challenge : il
//     FAUT un vrai navigateur qui exécute le JavaScript pour obtenir le contenu.
//     C'est le cas "contenu chargé en JS" prévu au §7 du cahier des charges.
//
//     Ce module lance Chromium, ouvre la page, attend que le challenge se
//     résolve et que les cartes d'événements apparaissent, puis renvoie le HTML
//     rendu (que shotgun.js parse ensuite).
// ============================================================================

let _browser = null;

export async function getBrowser() {
  if (_browser) return _browser;
  _browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });
  return _browser;
}

export async function closeBrowser() {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

async function newContext(browser) {
  const ctx = await browser.newContext({
    userAgent: config.userAgent.startsWith('Mozilla')
      ? config.userAgent
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1366, height: 900 },
  });
  // Réduit quelques signaux d'automatisation les plus évidents.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return ctx;
}

const isChallenge = (t) => /Checkpoint|Security|Just a moment|Attention Required/i.test(t || '');

// Charge une URL et renvoie le HTML rendu, après résolution du challenge Vercel
// et apparition d'au moins un lien /events/. Lève une erreur si rien n'apparaît.
export async function fetchRenderedHtml(url) {
  const browser = await getBrowser();
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Attente active : le challenge se résout puis le contenu s'hydrate.
    let ready = false;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(2500);
      const title = await page.title().catch(() => '');
      if (isChallenge(title)) continue;
      const hasEvents = await page.$('a[href*="/events/"]');
      if (hasEvents) { ready = true; break; }
    }

    // Déclenche le lazy-loading en scrollant jusqu'en bas.
    if (ready) {
      for (let s = 0; s < 6; s++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1200);
      }
    }

    const html = await page.content();
    const title = await page.title().catch(() => '');
    if (isChallenge(title)) {
      throw new Error(`Bloqué par le challenge Vercel (titre: "${title}")`);
    }
    // Rate limiting entre deux pages (cf. §10).
    await sleep(config.scrapeDelayMs);
    return html;
  } finally {
    await ctx.close();
  }
}
