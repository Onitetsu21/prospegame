import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import type { City, Filters } from '../lib/types';
import { getStyleTrends, getStyleByCity } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { Panel, EmptyState, Loading, Meter } from '../components/ui';
import { SERIES, AXIS, GRID, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/chart';
import { downloadCsv } from '../lib/csv';

export function StylesView({ filters, setFilters, cities, styles }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
}) {
  const trendsQ = useAsync(() => getStyleTrends(), []);
  const byCityQ = useAsync(() => getStyleByCity(), []);
  const trends = trendsQ.data ?? [];
  const byCity = byCityQ.data ?? [];
  const loading = trendsQ.loading || byCityQ.loading;

  const topStyles = useMemo(
    () => [...trends].sort((a, b) => b.events_26w - a.events_26w).slice(0, 10),
    [trends]
  );
  const chartData = useMemo(
    () => topStyles.map((s) => ({ name: s.style_label, value: s.events_26w })),
    [topStyles]
  );

  // Répartition par ville pour le style sélectionné (ou top global)
  const cityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of byCity) {
      if (filters.style && r.style_label !== filters.style) continue;
      map.set(r.city_name, (map.get(r.city_name) ?? 0) + r.events_6m);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [byCity, filters.style]);
  const maxCity = Math.max(1, ...cityBreakdown.map((c) => c.value));

  const exportCsv = () =>
    downloadCsv('styles_tendances.csv', trends.map((s) => ({
      style: s.style_label, evenements_4_sem: s.events_4w, evenements_12_sem: s.events_12w,
      evenements_26_sem: s.events_26w, total: s.events_total,
    })));

  return (
    <>
      <Topbar
        title="Styles & tendances"
        subtitle="Répartition et dynamique des genres électro (fenêtres 4 / 12 / 26 semaines)"
        filters={filters} setFilters={setFilters} cities={cities} styles={styles} showFilters
        onExport={trends.length ? exportCsv : undefined}
      />
      <div className="p-6 space-y-6">
        {loading ? (
          <Panel><Loading rows={8} /></Panel>
        ) : trends.length === 0 ? (
          <Panel><EmptyState title="Pas encore de données de styles" /></Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bar chart top styles */}
              <Panel title="Top styles (26 dernières semaines)" className="lg:col-span-2">
                <div className="p-4 h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid horizontal={false} stroke={GRID} />
                      <XAxis type="number" stroke={AXIS} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} stroke={AXIS}
                        tick={{ fontSize: 12, fill: '#93A4B3' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(45,212,191,0.06)' }}
                        contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
                        {chartData.map((_, i) => <Cell key={i} fill={SERIES[i % SERIES.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* Répartition par ville */}
              <Panel title={filters.style ? `« ${filters.style} » par ville` : 'Répartition par ville (6 mois)'}>
                <div className="p-5 space-y-4">
                  {cityBreakdown.length === 0 ? (
                    <EmptyState title="Aucune donnée" />
                  ) : (
                    cityBreakdown.map((c) => (
                      <div key={c.name}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-ink">{c.name}</span>
                          <span className="tabular-nums text-ink-2">{c.value}</span>
                        </div>
                        <Meter value={c.value} max={maxCity} />
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>

            {/* Tableau des tendances */}
            <Panel title="Dynamique par style">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="th">Style</th>
                      <th className="th text-right">4 sem.</th>
                      <th className="th text-right">12 sem.</th>
                      <th className="th text-right">26 sem.</th>
                      <th className="th text-right">Total</th>
                      <th className="th w-40">Tendance récente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.map((s) => {
                      // ratio d'activité récente : part des 4 dernières sem. dans les 26
                      const ratio = s.events_26w > 0 ? s.events_4w / s.events_26w : 0;
                      return (
                        <tr key={s.style_id} className="hover:bg-card-hover/50 transition cursor-pointer"
                          onClick={() => setFilters({ style: filters.style === s.style_label ? null : s.style_label })}>
                          <td className="td">
                            <span className={`font-medium ${filters.style === s.style_label ? 'text-turq-300' : 'text-ink'}`}>
                              {s.style_label}
                            </span>
                          </td>
                          <td className="td text-right tabular-nums text-ink">{s.events_4w}</td>
                          <td className="td text-right tabular-nums text-ink-2">{s.events_12w}</td>
                          <td className="td text-right tabular-nums text-ink-2">{s.events_26w}</td>
                          <td className="td text-right tabular-nums text-ink-2">{s.events_total}</td>
                          <td className="td"><Meter value={Math.round(ratio * 100)} max={100} tone="violet" /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
