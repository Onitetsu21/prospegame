import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Si Supabase n'est pas configuré, l'app bascule sur un jeu de données de
// démonstration (lib/mock.ts) — pratique pour visualiser le design sans backend.
export const hasSupabase = Boolean(url && key);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, key!, { auth: { persistSession: false } })
  : null;
