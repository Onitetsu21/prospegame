// Icônes SVG inline (aucune dépendance externe, stroke = currentColor).
type P = { className?: string };
const base = 'w-5 h-5';
const S = ({ className, children }: P & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? base}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconOverview = (p: P) => (
  <S {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></S>
);
export const IconCalendar = (p: P) => (
  <S {...p}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></S>
);
export const IconUsers = (p: P) => (
  <S {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-3-4.9" /></S>
);
export const IconWave = (p: P) => (
  <S {...p}><path d="M3 12c2-6 3.5-6 5 0s3 6 5 0 3.5-6 5 0" /></S>
);
export const IconSpark = (p: P) => (
  <S {...p}><path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6 3.5 3.5M20.5 20.5l-2.1-2.1M18.4 5.6l2.1-2.1M3.5 20.5l2.1-2.1" /><circle cx="12" cy="12" r="3.2" /></S>
);
export const IconPin = (p: P) => (
  <S {...p}><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></S>
);
export const IconSearch = (p: P) => (
  <S {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></S>
);
export const IconDownload = (p: P) => (
  <S {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></S>
);
export const IconExternal = (p: P) => (
  <S {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></S>
);
export const IconPlus = (p: P) => (
  <S {...p}><path d="M12 5v14M5 12h14" /></S>
);
export const IconTrend = (p: P) => (
  <S {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5h-5" /></S>
);
export const IconTag = (p: P) => (
  <S {...p}><path d="M3 11.5V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.5 6.5a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" /><circle cx="7.5" cy="7.5" r="1.3" /></S>
);
export const IconCheck = (p: P) => (
  <S {...p}><path d="M20 6 9 17l-5-5" /></S>
);
