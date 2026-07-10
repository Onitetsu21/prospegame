// Chargement de configuration partagé par tous les jobs (scrape / report / purge).
// Aucune dépendance externe : on lit process.env directement (les workflows
// GitHub Actions et Supabase Edge Functions injectent déjà les variables).

export const config = {
  // On nettoie l'URL : un retour à la ligne / espace / slash final collé par
  // erreur dans la variable casse le chemin ("Invalid path specified in request URL").
  supabaseUrl: requireEnv('SUPABASE_URL').trim().replace(/\/+$/, ''),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY').trim(),
  scrapeDelayMs: parseInt(process.env.SCRAPE_DELAY_MS || '2500', 10),
  userAgent:
    process.env.SCRAPE_USER_AGENT ||
    'ProspeGame/1.0 (veille perso; +https://github.com)',
  reportWebhookUrl: process.env.REPORT_WEBHOOK_URL || '',
  shotgunBase: process.env.SHOTGUN_BASE || 'https://shotgun.live',
  // Horizon : ne conserver que les événements dont la date tombe dans les N
  // prochains mois (Shotgun ne liste que l'à-venir). Vide/0 = tout garder.
  horizonMonths: parseFloat(process.env.SCRAPE_HORIZON_MONTHS || '3'),
  // Si "1", écrit le HTML rendu de chaque ville dans debug-<slug>.html
  // (récupérable comme artefact GitHub Actions pour ajuster les sélecteurs).
  debugDump: process.env.SCRAPE_DEBUG_DUMP === '1',
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(
      `[config] Variable d'environnement manquante : ${name}. ` +
        `Voir .env.example à la racine du repo.`
    );
    process.exit(1);
  }
  return v;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
