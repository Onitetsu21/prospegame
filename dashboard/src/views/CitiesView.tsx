import { useState } from 'react';
import type { City, Filters } from '../lib/types';
import { getCities, addCity, setCityActive, getTargetStyles, setTargetStyleActive, addTargetStyle } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { Topbar } from '../components/Topbar';
import { Panel, EmptyState, Loading, Switch } from '../components/ui';
import { IconPlus, IconPin, IconTag } from '../components/icons';
import { formatDate } from '../lib/format';

const SIX_MONTHS = 6 * 30 * 86400000;

export function CitiesView({ filters, setFilters, cities, styles, onCitiesChanged }: {
  filters: Filters; setFilters: (f: Partial<Filters>) => void; cities: City[]; styles: string[];
  onCitiesChanged: () => void;
}) {
  return (
    <>
      <Topbar
        title="Villes & filtres"
        subtitle="Gérez le périmètre de veille : villes suivies et liste blanche des styles électro"
        filters={filters} setFilters={setFilters} cities={cities} styles={styles} showFilters={false}
      />
      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CitiesPanel onChanged={onCitiesChanged} />
        <TargetStylesPanel />
      </div>
    </>
  );
}

function CitiesPanel({ onChanged }: { onChanged: () => void }) {
  const { data, loading, error, refetch } = useAsync(() => getCities(), []);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await addCity(name.trim(), slug.trim().toLowerCase());
      setName(''); setSlug('');
      refetch(); onChanged();
    } catch (err) {
      setMsg((err as Error).message);
    } finally { setBusy(false); }
  };

  const toggle = async (c: City) => {
    await setCityActive(c.id, !c.active);
    refetch(); onChanged();
  };

  const rows = data ?? [];

  return (
    <Panel title="Villes suivies" action={<span className="text-xs text-ink-3">{rows.filter((c) => c.active).length} active(s)</span>}>
      <form onSubmit={submit} className="flex items-end gap-2 p-4 border-b border-line flex-wrap">
        <label className="flex-1 min-w-[120px]">
          <span className="text-[11px] text-ink-3 block mb-1">Nom</span>
          <input className="input w-full" placeholder="Bordeaux" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex-1 min-w-[120px]">
          <span className="text-[11px] text-ink-3 block mb-1">Slug Shotgun</span>
          <input className="input w-full" placeholder="bordeaux" value={slug}
            onChange={(e) => setSlug(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={busy || !name || !slug}>
          <IconPlus className="w-4 h-4" /> Ajouter
        </button>
      </form>
      <p className="px-4 pt-3 text-[11px] text-ink-3">
        Le slug correspond à l'URL <span className="text-ink-2">shotgun.live/cities/<b>slug</b></span>.
        La ville est prise en compte au prochain cycle de scraping, sans redéploiement.
      </p>
      {msg && <p className="px-4 pt-2 text-xs text-rose">{msg}</p>}

      {loading ? <Loading rows={4} /> : error ? <EmptyState title="Erreur" hint={error} /> : (
        <ul className="divide-y divide-line/70 p-2">
          {rows.map((c) => {
            const isNew = Date.now() - new Date(c.added_at).getTime() < SIX_MONTHS;
            return (
              <li key={c.id} className="flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-card-hover border border-line flex items-center justify-center">
                    <IconPin className="w-4 h-4 text-ink-3" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{c.name}</span>
                      {isNew && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">
                          données en constitution
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-3">/{c.shotgun_slug} · ajoutée le {formatDate(c.added_at)}</div>
                  </div>
                </div>
                <Switch checked={c.active} onChange={() => toggle(c)} label={`Activer ${c.name}`} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TargetStylesPanel() {
  const { data, loading, error, refetch } = useAsync(() => getTargetStyles(), []);
  const [tag, setTag] = useState('');
  const rows = data ?? [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;
    await addTargetStyle(tag.trim());
    setTag(''); refetch();
  };
  const toggle = async (id: string, active: boolean) => {
    await setTargetStyleActive(id, !active);
    refetch();
  };

  return (
    <Panel title="Liste blanche des styles électro"
      action={<span className="text-xs text-ink-3">{rows.filter((r) => r.active).length} actif(s)</span>}>
      <form onSubmit={add} className="flex items-end gap-2 p-4 border-b border-line">
        <label className="flex-1">
          <span className="text-[11px] text-ink-3 block mb-1">Tag Shotgun exact</span>
          <input className="input w-full" placeholder="Ex : Melodic Techno" value={tag} onChange={(e) => setTag(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={!tag}><IconPlus className="w-4 h-4" /> Ajouter</button>
      </form>
      <p className="px-4 pt-3 text-[11px] text-ink-3">
        Un événement n'est retenu que si au moins un de ses tags figure ici (actif).
        Désactivez un style pour l'exclure sans le supprimer.
      </p>

      {loading ? <Loading rows={5} /> : error ? <EmptyState title="Erreur" hint={error} /> : (
        <div className="flex flex-wrap gap-2 p-4">
          {rows.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id, t.active)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition
                ${t.active
                  ? 'bg-turq-500/10 border-turq-500/30 text-turq-200'
                  : 'bg-card-hover border-line text-ink-3 line-through'}`}>
              <IconTag className="w-3.5 h-3.5" /> {t.shotgun_tag}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
