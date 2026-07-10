import React from 'react';

export function StatCard({
  label, value, sub, icon, tone = 'turq',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'turq' | 'violet' | 'amber' | 'sky';
}) {
  const tones: Record<string, string> = {
    turq: 'text-turq-300 bg-turq-500/10 border-turq-500/20',
    violet: 'text-violet bg-violet/10 border-violet/20',
    amber: 'text-amber bg-amber/10 border-amber/20',
    sky: 'text-sky bg-sky/10 border-sky/20',
  };
  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-3">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}
