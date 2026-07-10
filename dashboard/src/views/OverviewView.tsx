import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { City, Filters } from '../lib/types';
import { getEvents, getStyleTrends, getNewEntrants } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { StatCard } from '../components/StatCard';
import { Panel, StyleList, Loading, EmptyState, Meter } from '../components/ui';
import { IconCalendar, IconUsers, IconSpark, IconExternal } from '../components/icons';
import { AXIS, GRID, tooltipStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/chart';
import { formatDateTime, isFuture } from '../lib/format';

export function OverviewView({ filters, setFilters, cities, styles, onNavigate }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
  onNavigate: (v: 'events' | 'organizers' | 'styles' | 'new') => void;
}) {
  const eventsQ = useAsync(() => getEvents({ ...filters, search: '', style: null }), [filters.citySlug, filters.months]);
  const trendsQ = useAsync(() => getStyleTrends(), []);
  const newQ = useAsync(() => getNewEntrants(), []);

  const events = eventsQ.data ?? [];
  const trends = trendsQ.data ?? [];
  const newEntrants = newQ.data ?? [];
  const loading = eventsQ.loading || trendsQ.loading;

  const kpis = useMemo(() => {
    const upcoming = events.filter((e) => isFuture(e.event_date)).length;
    const organizers = new Set(events.map((e) => e.organizer_id).filter(Boolean)).size;
    const activeStyles = new Set(events.flatMap((e) => e.styles)).size;
    return { total: events.length, upcoming, organizers, activeStyles };
  }, [events]);

  // Série temporelle : nb d'événements par semaine (à venir + passés dans la fenêtre)
  const series = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const e of events) {
      if (!e.event_date) continue;
      const d = new Date(e.event_date);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, count]) => ({
        week: new Date(week).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        count,
      }));
  }, [events]);

  const topStyles = useMemo(
    () => [...trends].sort((a, b) => b.events_4w - a.events_4w).slice(0, 6),
    [trends]
  );
  const maxStyle = Math.max(1, ...topStyles.map((s) => s.events_4w));
  const latest = useMemo(
    () => [...events].sort((a, b) => (b.scraped_at ?? '').localeCompare(a.scraped_at ?? '')).slice(0, 6),
    [events]
  );

  return (
    <>
      <Topbar
        title="Aperçu"
        subtitle="Vue d'ensemble du tissu événementiel électro sur la fenêtre sélectionnée"
        filters={filters} setFilters={setFilters} cities={cities} styles={styles}
      />
      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Événements" value={kpis.total} sub={`sur ${filters.months} mois`}
            icon={<IconCalendar className="w-4 h-4" />} tone="turq" />
          <StatCard label="À venir" value={kpis.upcoming} sub="événements futurs"
            icon={<IconCalendar className="w-4 h-4" />} tone="sky" />
          <StatCard label="Organisateurs" value={kpis.organizers} sub="actifs sur la période"
            icon={<IconUsers className="w-4 h-4" />} tone="violet" />
          <StatCard label="Nouveaux entrants" value={newEntrants.length} sub="< 30 jours"
            icon={<IconSpark className="w-4 h-4" />} tone="amber" />
        </div>

        {loading ? (
          <Panel><Loading rows={8} /></Panel>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Courbe d'activité */}
            <Panel title="Activité par semaine" className="lg:col-span-2">
              <div className="p-4 h-[300px]">
                {series.length === 0 ? <EmptyState title="Aucune donnée" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="turqFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="week" stroke={AXIS} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                      <YAxis stroke={AXIS} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle}
                        cursor={{ stroke: '#2DD4BF', strokeOpacity: 0.3 }} />
                      <Area type="monotone" dataKey="count" name="événements" stroke="#2DD4BF" strokeWidth={2}
                        fill="url(#turqFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Panel>

            {/* Top styles (4 sem.) */}
            <Panel title="Styles les plus actifs" action={
              <button onClick={() => onNavigate('styles')} className="text-xs text-turq-300 hover:text-turq-200">Tout voir</button>
            }>
              <div className="p-5 space-y-4">
                {topStyles.length === 0 ? <EmptyState title="Aucune donnée" /> : topStyles.map((s) => (
                  <button key={s.style_id} onClick={() => { setFilters({ style: s.style_label }); onNavigate('styles'); }}
                    className="w-full text-left group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-ink group-hover:text-turq-200 transition">{s.style_label}</span>
                      <span className="tabular-nums text-ink-2">{s.events_4w}</span>
                    </div>
                    <Meter value={s.events_4w} max={maxStyle} />
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {/* Derniers événements collectés */}
        <Panel title="Derniers événements collectés" action={
          <button onClick={() => onNavigate('events')} className="text-xs text-turq-300 hover:text-turq-200">Tout voir</button>
        }>
          {loading ? <Loading /> : latest.length === 0 ? <EmptyState title="Aucun événement" /> : (
            <ul className="divide-y divide-line/70">
              {latest.map((e) => (
                <li key={e.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-card-hover/40 transition">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink truncate">{e.title}</div>
                    <div className="text-[11px] text-ink-3">
                      {e.city_name} · {e.venue_name ?? '—'} · {formatDateTime(e.event_date)}
                    </div>
                  </div>
                  <div className="hidden sm:block"><StyleList styles={e.styles} max={2} /></div>
                  <div className="text-sm text-ink-2 hidden md:block w-32 truncate text-right">{e.organizer_name}</div>
                  {e.url && (
                    <a href={e.url} target="_blank" rel="noreferrer" className="text-ink-3 hover:text-turq-300 transition">
                      <IconExternal className="w-4 h-4" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
