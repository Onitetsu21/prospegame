import * as cheerio from 'cheerio';
import { config } from './env.js';

// ============================================================================
// Parsing des pages de listing Shotgun (structure vérifiée sur le HTML rendu).
//
// ⚠️  ROBUSTESSE (cf. §10) : tout le couplage à la structure du site est ICI.
//     Shotgun n'expose PAS de JSON-LD d'événements ni de __NEXT_DATA__ ; les
//     données sont dans le DOM. Chaque événement est une <a href="/…/events/…">
//     contenant :
//       • titre   : <p class="line-clamp-…">
//       • lieu    : <div class="text-muted-foreground shrink …">
//       • date    : <time> (date FR) + <time> (heure)
//       • prix    : élément dont le texte propre vaut "12,00 €" (ou "Gratuit")
//       • genres  : pastilles <div class="… rounded-full …">
//     La page ville n'affiche qu'une tranche de jours ; la pagination se fait
//     via ?page=N (le scraper boucle sur les pages, cf. scrape.js).
// ============================================================================

// URL d'une page de listing ville. page=0 → URL nue ; page>=1 → ?page=N.
export function cityUrl(slug, page = 0) {
  const base = `${config.shotgunBase}/cities/${slug}`;
  return page > 0 ? `${base}?page=${page}` : base;
}

const MONTHS = {
  janv: 0, févr: 1, fevr: 1, mars: 2, avr: 3, mai: 4, juin: 5,
  juil: 6, août: 7, aout: 7, sept: 8, oct: 9, nov: 10, déc: 11, dec: 11,
};

// Point d'entrée : renvoie la liste des événements normalisés d'une page.
export function parseCityPage(html, citySlug) {
  const $ = cheerio.load(html);
  const byId = new Map();
  $('a[href*="/events/"]').each((_, el) => {
    const ev = parseCard($, $(el), citySlug);
    if (ev && !byId.has(ev.shotgunEventId)) byId.set(ev.shotgunEventId, ev);
  });
  return [...byId.values()];
}

function parseCard($, a, citySlug) {
  const href = a.attr('href') || '';
  const m = href.match(/\/events\/([^/?#]+)/);
  if (!m) return null;
  const shotgunEventId = m[1]; // slug complet = clé de dédup stable

  const title =
    directText($, a.find('p[class*="line-clamp"]').first()) ||
    a.find('img').first().attr('alt') ||
    '';
  if (!title) return null;

  const venueName = directText($, a.find('div.text-muted-foreground.shrink').first()) || null;

  // Genres : pastilles rounded-full (texte court, non vide).
  const tags = [
    ...new Set(
      a.find('div[class*="rounded-full"]')
        .map((_, t) => $(t).text().replace(/\s+/g, ' ').trim())
        .get()
        .filter((x) => x && x.length < 30)
    ),
  ];

  const times = a.find('time').map((_, t) => $(t).text().trim()).get();
  const eventDate = parseFrenchDate(times);

  const priceMin = parsePrice($, a);
  const imageUrl = firstImage(a.find('img').first());

  return {
    shotgunEventId,
    title: title.replace(/\s+/g, ' ').trim(),
    eventDate,
    venueName,
    citySlug,
    // La page ville expose le lieu, pas l'organisateur (celui-ci est sur la
    // fiche événement) — laissé null en V1, enrichissable ultérieurement.
    organizerName: null,
    organizerShotgunId: null,
    organizerUrl: null,
    priceMin,
    url: absoluteUrl(href),
    imageUrl,
    tags,
  };
}

// Texte propre d'un élément (sans le texte de ses enfants).
function directText($, el) {
  if (!el || el.length === 0) return '';
  return el.clone().children().remove().end().text().replace(/\s+/g, ' ').trim();
}

// Prix mini : plus petit montant "12,00 €" trouvé dans un élément dédié
// (on lit le texte PROPRE des éléments pour éviter de coller le prix au titre).
function parsePrice($, a) {
  let min = null;
  a.find('*').each((_, e) => {
    const dt = directText($, $(e));
    const pm = dt.match(/^(\d{1,4})[.,](\d{2})\s*€$/);
    if (pm) {
      const v = parseFloat(`${pm[1]}.${pm[2]}`);
      if (min == null || v < min) min = v;
    } else if (/^gratuit$/i.test(dt)) {
      min = 0;
    }
  });
  return min;
}

// Date FR sans année ("ven. 10 juil." + "22:00") -> ISO. L'année est inférée
// (si la date tombe > 7 j dans le passé, on passe à l'année suivante).
function parseFrenchDate(times) {
  let day, month, hh = 22, mm = 0, found = false;
  for (const t of times) {
    const dm = t.match(/(\d{1,2})\s*([a-zàâäéèêëîïôöûüç]+)/i);
    if (dm) {
      const mk = dm[2].toLowerCase().replace(/\./g, '');
      for (const k in MONTHS) {
        if (mk.startsWith(k)) { month = MONTHS[k]; day = +dm[1]; found = true; break; }
      }
    }
    const hm = t.match(/(\d{1,2}):(\d{2})/);
    if (hm) { hh = +hm[1]; mm = +hm[2]; }
  }
  if (!found) return null;
  const now = new Date();
  let d = new Date(now.getFullYear(), month, day, hh, mm);
  if (d.getTime() < now.getTime() - 7 * 86400000) {
    d = new Date(now.getFullYear() + 1, month, day, hh, mm);
  }
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function firstImage(img) {
  if (!img || img.length === 0) return null;
  const src = img.attr('src');
  if (src && src.startsWith('http')) return src;
  const srcset = img.attr('srcset');
  if (srcset) return srcset.split(',')[0].trim().split(/\s+/)[0] || null;
  return null;
}

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${config.shotgunBase}${url}`;
  return url;
}
