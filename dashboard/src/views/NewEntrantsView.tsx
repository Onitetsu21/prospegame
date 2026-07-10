import type { City, Filters } from '../lib/types';
import { getNewEntrants } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { Panel, StyleList, EmptyState, Loading } from '../components/ui';
import { IconExternal, IconSpark } from '../components/icons';
import { formatDate, relativeDays } from '../lib/format';
import { downloadCsv } from '../lib/csv';

export function NewEntrantsView({ filters, setFilters, cities, styles }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
}) {
  const { data, loading, error } = useAsync(() => getNewEntrants(), []);
  const rows = data ?? [];

  const exportCsv = () =>
    downloadCsv('nouveaux_entrants.csv', rows.map((o) => ({
      organisateur: o.organizer_name, premiere_detection: o.first_seen_at,
      villes: o.cities, styles: o.styles, evenements: o.events_total,
    })));

  return (
    <>
      <Topbar
        title="Nouveaux entrants"
        subtitle="Organisateurs détectés pour la première fois il y a moins de 30 jours"
        filters={filters} setFilters={setFilters} cities={cities} styles={styles} showFilters={false}
        onExport={rows.length ? exportCsv : undefined}
      />
      <div className="p-6">
        {loading ? (
          <Panel><Loading /></Panel>
        ) : error ? (
          <Panel><EmptyState title="Erreur de chargement" hint={error} /></Panel>
        ) : rows.length === 0 ? (
          <Panel><EmptyState title="Aucun nouvel entrant" hint="Aucun organisateur détecté sur les 30 derniers jours." /></Panel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((o) => (
              <div key={o.organizer_id} className="card p-5 animate-fade-up hover:border-turq-500/30 transition group">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-turq-500/10 border border-turq-500/20 flex items-center justify-center">
                    <IconSpark className="w-5 h-5 text-turq-300" />
                  </div>
                  {o.profile_url && (
                    <a href={o.profile_url} target="_blank" rel="noreferrer"
                      className="text-ink-3 hover:text-turq-300 transition opacity-0 group-hover:opacity-100">
                      <IconExternal className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <div className="mt-3">
                  <div className="font-semibold text-ink">{o.organizer_name}</div>
                  <div className="text-[11px] text-turq-300 mt-0.5">détecté {relativeDays(o.first_seen_at)}</div>
                </div>
                <div className="mt-3 text-sm text-ink-2">
                  {(o.cities ?? []).join(', ') || '—'}
                  <span className="text-ink-3"> · {o.events_total} event(s)</span>
                </div>
                <div className="mt-3"><StyleList styles={o.styles} max={4} /></div>
                <div className="mt-3 pt-3 border-t border-line text-[11px] text-ink-3">
                  Première détection : {formatDate(o.first_seen_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
