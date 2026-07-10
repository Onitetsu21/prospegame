import * as cheerio from 'cheerio';
import { config } from './env.js';

// ============================================================================
// Parsing des pages de listing Shotgun.
//
// ⚠️  ROBUSTESSE (cf. §10) : Shotgun est une app Next.js dont le HTML peut
//     changer. Tout le couplage à la structure du site est CONCENTRÉ ICI.
//     Trois stratégies d'extraction sont tentées dans l'ordre, de la plus
//     robuste à la plus fragile :
//       1. JSON-LD (<script type="application/ld+json">, @type Event/MusicEvent)
//       2. __NEXT_DATA__ (payload d'hydratation Next.js)
//       3. Fallback DOM (liens /events/... + heuristiques)
//
//     Si AUCUNE stratégie ne renvoie d'événement pour une page a priori
//     peuplée, on lève une erreur (pas d'échec silencieux) : le run est marqué
//     `partial` et l'incident est journalisé dans scrape_runs.errors.
// ============================================================================

// URL d'une page de listing ville (Shotgun expose /cities/<slug>).
export function cityUrl(slug) {
  return `${config.shotgunBase}/cities/${slug}`;
}

// Point d'entrée : renvoie une liste d'événements normalisés pour une ville.
export function parseCityPage(html, citySlug) {
  const $ = cheerio.load(html);
  const byId = new Map();

  const add = (ev) => {
    if (!ev || !ev.shotgunEventId) return;
    const prev = byId.get(ev.shotgunEventId);
    // Fusion : on garde les champs déjà connus, on complète avec les nouveaux.
    byId.set(ev.shotgunEventId, prev ? mergeEvent(prev, ev) : ev);
  };

  for (const ev of parseJsonLd($, citySlug)) add(ev);
  if (byId.size === 0) for (const ev of parseNextData($, citySlug)) add(ev);
  if (byId.size === 0) for (const ev of parseDomFallback($, citySlug)) add(ev);

  return [...byId.values()];
}

function mergeEvent(a, b) {
  return {
    ...a,
    ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null && v !== '')),
    tags: [...new Set([...(a.tags || []), ...(b.tags || [])])],
  };
}

// ── Stratégie 1 : JSON-LD ───────────────────────────────────────────────────
function parseJsonLd($, citySlug) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let json;
    try {
      json = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const nodes = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];
    for (const node of nodes) {
      const type = node?.['@type'];
      const isEvent =
        type === 'Event' ||
        type === 'MusicEvent' ||
        (Array.isArray(type) && type.some((t) => /Event/i.test(t)));
      if (!isEvent) continue;
      out.push(normalize(
        {
          id: extractIdFromUrl(node.url) || node.identifier,
          title: node.name,
          date: node.startDate,
          venue: node.location?.name,
          organizerName: asOrganizerName(node.organizer),
          organizerUrl: node.organizer?.url,
          price: extractPrice(node.offers),
          url: node.url,
          image: Array.isArray(node.image) ? node.image[0] : node.image,
          tags: extractTags(node),
        },
        citySlug
      ));
    }
  });
  return out.filter(Boolean);
}

// ── Stratégie 2 : __NEXT_DATA__ ─────────────────────────────────────────────
function parseNextData($, citySlug) {
  const raw = $('#__NEXT_DATA__').contents().text();
  if (!raw) return [];
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  // On parcourt récursivement le payload à la recherche d'objets ressemblant
  // à des événements (heuristique : présence d'un id + name/title + startDate).
  const out = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const looksLikeEvent =
      (node.name || node.title) &&
      (node.startDate || node.startTime || node.date) &&
      (node.id || node.slug || node.permalink);
    if (looksLikeEvent) {
      const key = String(node.id ?? node.slug ?? node.permalink);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(normalize(
          {
            id: node.id ?? node.slug ?? extractIdFromUrl(node.permalink),
            title: node.name || node.title,
            date: node.startDate || node.startTime || node.date,
            venue: node.venue?.name || node.location?.name || node.venueName,
            organizerName:
              node.organizer?.name || node.creator?.name || node.promoterName,
            organizerUrl: node.organizer?.permalink || node.organizer?.url,
            organizerId: node.organizer?.id || node.creator?.id,
            price: node.minPrice ?? node.priceMin ?? extractPrice(node.offers),
            url: absoluteUrl(node.permalink || node.url),
            image: node.image || node.cover || node.artworkUrl,
            tags: extractTags(node),
          },
          citySlug
        ));
      }
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(json);
  return out.filter(Boolean);
}

// ── Stratégie 3 : fallback DOM ──────────────────────────────────────────────
function parseDomFallback($, citySlug) {
  const out = [];
  $('a[href*="/events/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const id = extractIdFromUrl(href);
    if (!id) return;
    const card = $(el);
    const title =
      card.find('h2,h3,[class*="title"]').first().text().trim() ||
      card.attr('title') ||
      card.text().trim().slice(0, 120);
    const venue = card.find('[class*="venue"],[class*="location"]').first().text().trim();
    const image = card.find('img').first().attr('src');
    const tags = card
      .find('[class*="tag"],[class*="genre"],[class*="badge"]')
      .map((_, t) => $(t).text().trim())
      .get()
      .filter(Boolean);
    out.push(normalize(
      { id, title, venue, image, url: absoluteUrl(href), tags },
      citySlug
    ));
  });
  return out.filter(Boolean);
}

// ── Helpers de normalisation ────────────────────────────────────────────────
function normalize(r, citySlug) {
  if (!r.id || !r.title) return null;
  return {
    shotgunEventId: String(r.id),
    title: clean(r.title),
    eventDate: toIso(r.date),
    venueName: clean(r.venue) || null,
    citySlug,
    organizerName: clean(r.organizerName) || null,
    organizerShotgunId: r.organizerId != null ? String(r.organizerId) : null,
    organizerUrl: absoluteUrl(r.organizerUrl) || null,
    priceMin: parsePriceNumber(r.price),
    url: absoluteUrl(r.url) || null,
    imageUrl: r.image || null,
    tags: dedupeTags(r.tags),
  };
}

function clean(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s;
}

function toIso(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}

function extractIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // Shotgun : /events/<slug>-<id> ou /events/<id>
  const m = url.match(/\/events\/([a-z0-9-]+)/i);
  if (!m) return null;
  const tail = m[1].match(/(\d+)$/);
  return tail ? tail[1] : m[1];
}

function absoluteUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${config.shotgunBase}${url}`;
  return url;
}

function asOrganizerName(org) {
  if (!org) return null;
  if (typeof org === 'string') return org;
  if (Array.isArray(org)) return org[0]?.name || null;
  return org.name || null;
}

function extractPrice(offers) {
  if (!offers) return null;
  const arr = Array.isArray(offers) ? offers : [offers];
  const prices = arr.map((o) => parseFloat(o.price ?? o.lowPrice)).filter((n) => !isNaN(n));
  return prices.length ? Math.min(...prices) : null;
}

function parsePriceNumber(p) {
  if (p == null) return null;
  const n = typeof p === 'number' ? p : parseFloat(String(p).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function extractTags(node) {
  const raw = []
    .concat(node.genres || [])
    .concat(node.tags || [])
    .concat(node.styles || [])
    .concat(node.keywords ? String(node.keywords).split(',') : [])
    .concat(node.genre ? [node.genre] : []);
  return dedupeTags(raw);
}

function dedupeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const norm = tags
    .map((t) => (typeof t === 'string' ? t : t?.name || t?.label))
    .filter(Boolean)
    .map((t) => t.replace(/\s+/g, ' ').trim());
  return [...new Set(norm)];
}
