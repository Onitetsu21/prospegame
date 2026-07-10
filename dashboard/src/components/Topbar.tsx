import type { City, Filters } from '../lib/types';
import { IconSearch, IconDownload } from './icons';

const WINDOWS = [
  { m: 1, label: '1 mois' },
  { m: 3, label: '3 mois' },
  { m: 6, label: '6 mois' },
  { m: 12, label: '12 mois' },
];

export function Topbar({
  title, subtitle, filters, setFilters, cities, styles, showFilters = true, onExport,
}: {
  title: string;
  subtitle?: string;
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  cities: City[];
  styles: string[];
  showFilters?: boolean;
  onExport?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 bg-base/80 backdrop-blur-xl border-b border-line">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="text-sm text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          {onExport && (
            <button className="btn-ghost" onClick={onExport}>
              <IconDownload className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-2.5 flex-wrap mt-4">
            {/* Recherche */}
            <div className="relative">
              <IconSearch className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-9 w-56"
                placeholder="Rechercher…"
                value={filters.search}
                onChange={(e) => setFilters({ search: e.target.value })}
              />
            </div>

            {/* Ville */}
            <select
              className="input pr-8"
              value={filters.citySlug ?? ''}
              onChange={(e) => setFilters({ citySlug: e.target.value || null })}
            >
              <option value="">Toutes les villes</option>
              {cities.map((c) => (
                <option key={c.id} value={c.shotgun_slug}>{c.name}</option>
              ))}
            </select>

            {/* Style */}
            <select
              className="input pr-8"
              value={filters.style ?? ''}
              onChange={(e) => setFilters({ style: e.target.value || null })}
            >
              <option value="">Tous les styles</option>
              {styles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Fenêtre temporelle (défaut 6 mois — cf. §2/§6) */}
            <div className="flex items-center rounded-xl border border-line bg-surface p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.m}
                  onClick={() => setFilters({ months: w.m })}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition
                    ${filters.months === w.m ? 'bg-turq-500/15 text-turq-200' : 'text-ink-3 hover:text-ink-2'}`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
