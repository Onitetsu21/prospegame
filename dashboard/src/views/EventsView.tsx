import type { City, Filters } from '../lib/types';
import { getEvents } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { Panel, StyleList, EmptyState, Loading } from '../components/ui';
import { IconExternal, IconPin } from '../components/icons';
import { formatDateTime, formatPrice, isFuture } from '../lib/format';
import { downloadCsv } from '../lib/csv';

export function EventsView({ filters, setFilters, cities, styles }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
}) {
  const { data, loading, error } = useAsync(() => getEvents(filters), [filters]);
  const rows = data ?? [];

  const exportCsv = () =>
    downloadCsv(
      `evenements_${filters.citySlug ?? 'toutes-villes'}.csv`,
      rows.map((e) => ({
        titre: e.title,
        date: e.event_date,
        ville: e.city_name,
        venue: e.venue_name,
        organisateur: e.organizer_name,
        styles: e.styles,
        prix_min: e.price_min,
        url: e.url,
      }))
    );

  return (
    <>
      <Topbar
        title="Événements"
        subtitle={`${rows.length} événement(s) sur la fenêtre affichée`}
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
            <EmptyState title="Aucun événement" hint="Ajustez les filtres ou élargissez la fenêtre temporelle." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className="th">Événement</th>
                    <th className="th">Date</th>
                    <th className="th">Ville / Venue</th>
                    <th className="th">Organisateur</th>
                    <th className="th">Styles</th>
                    <th className="th text-right">Prix</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="hover:bg-card-hover/50 transition">
                      <td className="td">
                        <div className="font-medium text-ink">{e.title}</div>
                      </td>
                      <td className="td whitespace-nowrap">
                        <div className="text-ink">{formatDateTime(e.event_date)}</div>
                        <div className={`text-[11px] ${isFuture(e.event_date) ? 'text-turq-300' : 'text-ink-3'}`}>
                          {isFuture(e.event_date) ? 'à venir' : 'passé'}
                        </div>
                      </td>
                      <td className="td whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-ink">
                          <IconPin className="w-3.5 h-3.5 text-ink-3" /> {e.city_name ?? '—'}
                        </div>
                        <div className="text-[11px] text-ink-3">{e.venue_name ?? '—'}</div>
                      </td>
                      <td className="td text-ink whitespace-nowrap">{e.organizer_name ?? '—'}</td>
                      <td className="td"><StyleList styles={e.styles} /></td>
                      <td className="td text-right whitespace-nowrap text-ink">{formatPrice(e.price_min)}</td>
                      <td className="td text-right">
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer"
                            className="inline-flex text-ink-3 hover:text-turq-300 transition" title="Voir sur Shotgun">
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
