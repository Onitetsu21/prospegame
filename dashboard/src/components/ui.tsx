import React from 'react';

// ── Pastille de style (électro) ───────────────────────────────────────────
export function StylePill({ label }: { label: string }) {
  return <span className="pill">{label}</span>;
}

export function StyleList({ styles, max = 3 }: { styles: string[] | null; max?: number }) {
  const list = styles ?? [];
  if (list.length === 0) return <span className="text-ink-3">—</span>;
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((s) => <StylePill key={s} label={s} />)}
      {rest > 0 && <span className="text-xs text-ink-3 self-center">+{rest}</span>}
    </div>
  );
}

// ── État vide ──────────────────────────────────────────────────────────────
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-turq-500/10 border border-turq-500/20 flex items-center justify-center mb-4">
        <span className="text-turq-300 text-2xl">◎</span>
      </div>
      <p className="text-ink font-medium">{title}</p>
      {hint && <p className="text-ink-3 text-sm mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

// ── Skeleton de chargement ──────────────────────────────────────────────────
export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 rounded-lg bg-card-hover/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

// ── Carte panneau ────────────────────────────────────────────────────────────
export function Panel({ title, action, children, className = '' }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between px-5 py-4 border-b border-line">
          {title && <h2 className="text-sm font-semibold text-ink tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// ── Barre de progression fine (répartitions) ─────────────────────────────────
export function Meter({ value, max, tone = 'turq' }: { value: number; max: number; tone?: 'turq' | 'violet' }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const color = tone === 'violet' ? 'bg-violet' : 'bg-turq-400';
  return (
    <div className="h-1.5 w-full rounded-full bg-line-strong/50 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Toggle switch ────────────────────────────────────────────────────────────
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-turq-500' : 'bg-line-strong'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}
