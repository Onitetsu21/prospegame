// ============================================================================
// Job de purge (cf. §8) : supprime les événements dont event_date > 1 an.
// organizers & styles sont conservés. À planifier quotidiennement/hebdo.
// ============================================================================
import { db } from './lib/db.js';

async function main() {
  const { data, error } = await db.rpc('purge_old_events');
  if (error) {
    console.error(`[purge] ✗ ${error.message}`);
    process.exit(1);
  }
  console.log(`[purge] ${data ?? 0} événement(s) de plus d'un an supprimé(s).`);
}

main();
