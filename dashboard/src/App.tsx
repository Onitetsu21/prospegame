import { useMemo, useState } from 'react';
import { Sidebar, ViewId } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { EventsView } from './views/EventsView';
import { OrganizersView } from './views/OrganizersView';
import { StylesView } from './views/StylesView';
import { NewEntrantsView } from './views/NewEntrantsView';
import { CitiesView } from './views/CitiesView';
import { getCities, getTargetStyles } from './lib/api';
import { useAsync } from './lib/useAsync';
import type { Filters } from './lib/types';

export default function App() {
  const [view, setView] = useState<ViewId>('overview');
  const [filters, setFiltersState] = useState<Filters>({
    citySlug: null,
    style: null,
    months: 6, // fenêtre par défaut : 6 mois (cf. §2/§6 du cahier des charges)
    search: '',
  });
  const setFilters = (patch: Partial<Filters>) => setFiltersState((f) => ({ ...f, ...patch }));

  // Villes (pour les filtres) — rechargées quand on en ajoute/désactive
  const citiesQ = useAsync(() => getCities(), []);
  const cities = citiesQ.data ?? [];
  const activeCities = useMemo(() => cities.filter((c) => c.active), [cities]);

  // Styles disponibles pour le filtre = liste blanche
  const stylesQ = useAsync(() => getTargetStyles(), []);
  const styleOptions = useMemo(
    () => (stylesQ.data ?? []).filter((s) => s.active).map((s) => s.shotgun_tag).sort(),
    [stylesQ.data]
  );

  const shared = { filters, setFilters, cities: activeCities, styles: styleOptions };

  return (
    <div className="flex h-full">
      <Sidebar view={view} onNavigate={setView} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Barre de navigation mobile */}
        <MobileNav view={view} onNavigate={setView} />

        {view === 'overview' && (
          <OverviewView {...shared} onNavigate={(v) => setView(v)} />
        )}
        {view === 'events' && <EventsView {...shared} />}
        {view === 'organizers' && <OrganizersView {...shared} />}
        {view === 'styles' && <StylesView {...shared} />}
        {view === 'new' && <NewEntrantsView {...shared} />}
        {view === 'cities' && (
          <CitiesView {...shared} onCitiesChanged={() => citiesQ.refetch()} />
        )}
      </main>
    </div>
  );
}

const MOBILE_NAV: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Aperçu' },
  { id: 'events', label: 'Événements' },
  { id: 'organizers', label: 'Organisateurs' },
  { id: 'styles', label: 'Styles' },
  { id: 'new', label: 'Nouveaux' },
  { id: 'cities', label: 'Villes' },
];

function MobileNav({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <div className="md:hidden sticky top-0 z-30 bg-surface border-b border-line overflow-x-auto">
      <div className="flex items-center gap-1 px-3 py-2">
        <span className="font-bold text-turq-300 pr-2">◈</span>
        {MOBILE_NAV.map((n) => (
          <button key={n.id} onClick={() => onNavigate(n.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition
              ${view === n.id ? 'bg-turq-500/12 text-turq-200' : 'text-ink-3'}`}>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}
