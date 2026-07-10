// ============================================================================
// Rapport automatique (cf. §2, §4, §5) — SQL + templating natif, SANS LLM.
// Résume les nouveautés depuis le dernier rapport :
//   • nouveaux événements collectés
//   • nouveaux organisateurs (new_entrants)
//   • nouvelles villes ajoutées à la veille (new_cities_report) ← exigence §11
//   • styles en croissance (style_trends)
// Envoie sur un webhook si REPORT_WEBHOOK_URL est défini, sinon écrit sur stdout.
// Enregistre l'envoi dans report_runs (sert de borne au prochain rapport).
// ============================================================================
import { db } from './lib/db.js';
import { config } from './lib/env.js';

async function main() {
  // Borne temporelle : date du dernier rapport (ou epoch si aucun).
  const { data: lastRun } = await db
    .from('report_runs')
    .select('sent_at')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastRun?.sent_at || '1970-01-01T00:00:00Z';

  const [newEvents, newOrganizers, newCities, trends] = await Promise.all([
    db.from('events').select('id', { count: 'exact', head: true }).gte('scraped_at', since),
    db.from('new_entrants').select('organizer_name, cities, styles, first_seen_at'),
    db.from('new_cities_report').select('name, events_collected, organizers_collected, added_at'),
    db.from('style_trends').select('style_label, events_4w, events_12w, events_26w')
      .order('events_4w', { ascending: false })
      .limit(8),
  ]);

  for (const [label, r] of [
    ['events', newEvents],
    ['new_entrants', newOrganizers],
    ['new_cities_report', newCities],
    ['style_trends', trends],
  ]) {
    if (r.error) throw new Error(`Requête ${label} : ${r.error.message}`);
  }

  const risingStyles = (trends.data ?? []).filter((s) => s.events_4w > 0);

  const md = renderMarkdown({
    since,
    newEventCount: newEvents.count ?? 0,
    newOrganizers: newOrganizers.data ?? [],
    newCities: newCities.data ?? [],
    risingStyles,
  });

  console.log(md);

  if (config.reportWebhookUrl) {
    try {
      const res = await fetch(config.reportWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Format compatible Slack/Discord (`text`/`content`) — on envoie les deux.
        body: JSON.stringify({ text: md, content: md.slice(0, 1900) }),
      });
      if (!res.ok) console.error(`[report] Webhook HTTP ${res.status}`);
      else console.log('[report] Rapport envoyé au webhook.');
    } catch (e) {
      console.error(`[report] Envoi webhook échoué : ${e.message}`);
    }
  }

  // On enregistre le run (borne du prochain rapport).
  const summary = {
    new_events: newEvents.count ?? 0,
    new_organizers: (newOrganizers.data ?? []).length,
    new_cities: (newCities.data ?? []).length,
  };
  const { error } = await db.from('report_runs').insert({ summary });
  if (error) console.error(`[report] Enregistrement report_run : ${error.message}`);
}

function renderMarkdown({ since, newEventCount, newOrganizers, newCities, risingStyles }) {
  const d = new Date().toISOString().slice(0, 10);
  const L = [];
  L.push(`# 🎛️  Rapport de veille Shotgun — ${d}`);
  L.push(`_Nouveautés depuis le ${since.slice(0, 10)}_`);
  L.push('');
  L.push(`**${newEventCount}** nouvel(le)(s) événement(s) collecté(s).`);
  L.push('');

  if (newCities.length) {
    L.push('## 🆕 Nouvelles villes suivies');
    for (const c of newCities) {
      L.push(
        `- **${c.name}** (ajoutée le ${String(c.added_at).slice(0, 10)}) — ` +
          `${c.events_collected} événement(s), ${c.organizers_collected} organisateur(s) déjà détecté(s).`
      );
    }
    L.push('');
  }

  if (newOrganizers.length) {
    L.push('## 👥 Nouveaux organisateurs détectés (< 30 j)');
    for (const o of newOrganizers.slice(0, 25)) {
      const cities = (o.cities || []).join(', ') || '—';
      const styles = (o.styles || []).slice(0, 4).join(', ') || '—';
      L.push(`- **${o.organizer_name}** — ${cities} · _${styles}_`);
    }
    L.push('');
  }

  if (risingStyles.length) {
    L.push('## 📈 Styles les plus actifs (4 dernières semaines)');
    for (const s of risingStyles) {
      L.push(`- **${s.style_label}** — ${s.events_4w} (4 sem.) / ${s.events_12w} (12 sem.) / ${s.events_26w} (26 sem.)`);
    }
    L.push('');
  }

  if (!newCities.length && !newOrganizers.length && !risingStyles.length) {
    L.push('_Aucune nouveauté notable sur la période._');
  }

  return L.join('\n');
}

main().catch((e) => {
  console.error(`[report] ✗ ${e.message}`);
  process.exit(1);
});
