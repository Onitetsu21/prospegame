import type { City, Filters } from '../lib/types';
import { getOrganizerStats } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { Panel, StyleList, EmptyState, Loading, Meter } from '../components/ui';
import { IconExternal } from '../components/icons';
import { formatDate, relativeDays } from '../lib/format';
import { downloadCsv } from '../lib/csv';

export function OrganizersView({ filters, setFilters, cities, styles }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
}) {
  const { data, loading, error } = useAsync(() => getOrganizerStats(filters), [filters.citySlug, filters.search]);
  const rows = data ?? [];
  const maxEvents = Math.max(1, ...rows.map((o) => o.events_6m));

  const exportCsv = () =>
    downloadCsv(
      `organisateurs_${filters.citySlug ?? 'toutes-villes'}.csv`,
      rows.map((o) => ({
        organisateur: o.organizer_name,
        villes: o.cities,
        evenements_6m: o.events_6m,
        evenements_total: o.events_total,
        styles: o.styles,
        derniere_activite: o.last_event_date,
        premiere_detection: o.first_seen_at,
      }))
    );

  return (
    <>
      <Topbar
        title="Organisateurs"
        subtitle="Classés par volume d'activité (6 derniers mois) — cœur de la prospection"
        filters={filters} setFilters={setFilters} cities={cities} styles={styles}
        onExport={rows.length ? exportCsv : undefined}
      />
      <div className="p-6">
        <Panel>
          {loading ? (
            <Loading />
          ) : error ? (
            <EmptyState title="Erreur de chargement" hint={error} />
          ) : rows.length === 0 ? (
            <EmptyState title="Aucun organisateur" hint="Aucun organisateur ne correspond aux filtres." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className="th">Organisateur</th>
                    <th className="th w-52">Activité (6 mois)</th>
                    <th className="th">Ville(s)</th>
                    <th className="th">Styles</th>
                    <th className="th whitespace-nowrap">Dernière activité</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.organizer_id} className="hover:bg-card-hover/50 transition">
                      <td className="td">
                        <div className="font-medium text-ink">{o.organizer_name}</div>
                        <div className="text-[11px] text-ink-3">détecté {relativeDays(o.first_seen_at)}</div>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <span className="tabular-nums text-ink font-semibold w-6">{o.events_6m}</span>
                          <div className="flex-1"><Meter value={o.events_6m} max={maxEvents} /></div>
                        </div>
                        <div className="text-[11px] text-ink-3 mt-1">{o.events_total} au total</div>
                      </td>
                      <td className="td text-ink">{(o.cities ?? []).join(', ') || '—'}</td>
                      <td className="td"><StyleList styles={o.styles} max={3} /></td>
                      <td className="td whitespace-nowrap text-ink">{formatDate(o.last_event_date)}</td>
                      <td className="td text-right">
                        {o.profile_url && (
                          <a href={o.profile_url} target="_blank" rel="noreferrer"
                            className="inline-flex text-ink-3 hover:text-turq-300 transition" title="Profil Shotgun">
                            <IconExternal className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
