import { hasSupabase } from '../lib/supabase';
import {
  IconOverview, IconCalendar, IconUsers, IconWave, IconSpark, IconPin,
} from './icons';

export type ViewId = 'overview' | 'events' | 'organizers' | 'styles' | 'new' | 'cities';

const NAV: { id: ViewId; label: string; icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'overview', label: 'Aperçu', icon: IconOverview },
  { id: 'events', label: 'Événements', icon: IconCalendar },
  { id: 'organizers', label: 'Organisateurs', icon: IconUsers },
  { id: 'styles', label: 'Styles', icon: IconWave },
  { id: 'new', label: 'Nouveaux entrants', icon: IconSpark },
  { id: 'cities', label: 'Villes & filtres', icon: IconPin },
];

export function Sidebar({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-surface border-r border-line h-full">
      {/* Marque */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-line">
        <div className="w-9 h-9 rounded-xl bg-turq-500/12 border border-turq-500/25 flex items-center justify-center shadow-glow">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-turq-300" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 14c3-1 4-9 7-9s3 9 7 9" />
            <path d="M3 18c3-1 4-9 7-9s3 9 7 9" opacity=".4" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-ink font-bold tracking-tight">ProspeGame</div>
          <div className="text-[11px] text-ink-3">Veille Shotgun</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition group relative
                ${active ? 'text-turq-200 bg-turq-500/10' : 'text-ink-2 hover:text-ink hover:bg-card-hover'}`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-turq-400" />}
              <Icon className={`w-[18px] h-[18px] ${active ? 'text-turq-300' : 'text-ink-3 group-hover:text-ink-2'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Statut backend */}
      <div className="px-5 py-4 border-t border-line">
        <div className="flex items-center gap-2 text-[11px] text-ink-3">
          <span className={`w-2 h-2 rounded-full ${hasSupabase ? 'bg-turq-400' : 'bg-amber'}`} />
          {hasSupabase ? 'Connecté à Supabase' : 'Mode démonstration'}
        </div>
      </div>
    </aside>
  );
}
