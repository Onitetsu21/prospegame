const dtf = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const dtfTime = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : dtf.format(d);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : dtfTime.format(d);
}

export function relativeDays(iso: string | null): string {
  if (!iso) return '';
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  if (diff < 30) return `il y a ${diff} j`;
  const m = Math.round(diff / 30);
  return `il y a ${m} mois`;
}

export function formatPrice(p: number | null): string {
  if (p == null) return '—';
  return p === 0 ? 'Gratuit' : `${p} €`;
}

export function isFuture(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() > Date.now();
}
