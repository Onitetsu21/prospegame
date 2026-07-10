// Chargement de configuration partagé par tous les jobs (scrape / report / purge).
// Aucune dépendance externe : on lit process.env directement (les workflows
// GitHub Actions et Supabase Edge Functions injectent déjà les variables).

export const config = {
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  scrapeDelayMs: parseInt(process.env.SCRAPE_DELAY_MS || '1500', 10),
  userAgent:
    process.env.SCRAPE_USER_AGENT ||
    'ProspeGame/1.0 (veille perso; +https://github.com)',
  reportWebhookUrl: process.env.REPORT_WEBHOOK_URL || '',
  shotgunBase: process.env.SHOTGUN_BASE || 'https://shotgun.live',
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
