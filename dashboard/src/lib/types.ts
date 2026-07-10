export interface City {
  id: string;
  name: string;
  shotgun_slug: string;
  active: boolean;
  added_at: string;
}

export interface EventRow {
  id: string;
  shotgun_event_id: string;
  title: string;
  event_date: string | null;
  venue_name: string | null;
  price_min: number | null;
  url: string | null;
  image_url: string | null;
  scraped_at: string;
  city_id: string | null;
  city_name: string | null;
  city_slug: string | null;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_url: string | null;
  styles: string[];
}

export interface OrganizerStat {
  organizer_id: string;
  organizer_name: string;
  profile_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  events_total: number;
  events_6m: number;
  events_30d: number;
  cities: string[] | null;
  styles: string[] | null;
  last_event_date: string | null;
}

export interface StyleTrend {
  style_id: string;
  style_label: string;
  events_4w: number;
  events_12w: number;
  events_26w: number;
  events_total: number;
}

export interface NewEntrant {
  organizer_id: string;
  organizer_name: string;
  profile_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
  events_total: number;
  cities: string[] | null;
  styles: string[] | null;
}

export interface StyleByCity {
  city_id: string;
  city_name: string;
  style_id: string;
  style_label: string;
  events_6m: number;
}

export interface TargetStyle {
  id: string;
  shotgun_tag: string;
  active: boolean;
}

export interface Filters {
  citySlug: string | null; // null = toutes
  style: string | null; // null = tous
  months: number; // fenêtre glissante, défaut 6
  search: string;
}
