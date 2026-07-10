-- ============================================================================
-- ProspeGame — Données de départ
--   • liste blanche électro (target_styles), éditable ensuite via le dashboard
--   • quelques villes cibles (désactivables / supprimables via l'UI)
-- ============================================================================

-- Liste blanche de styles électro (cf. §2 "Précision sur le filtrage électro")
insert into target_styles (shotgun_tag, active) values
  ('Techno', true),
  ('Hard Techno', true),
  ('House', true),
  ('Deep House', true),
  ('Tech House', true),
  ('Afro House', true),
  ('Progressive House', true),
  ('Bass House', true),
  ('Minimal', true),
  ('Trance', true),
  ('Psytrance', true),
  ('Hardcore', true),
  ('Hardstyle', true),
  ('Drum & Bass', true),
  ('Dubstep', true),
  ('Industrial', true),
  ('Electro', true),
  ('Disco', true)
on conflict (shotgun_tag) do nothing;

-- Villes suivies au démarrage (le slug doit correspondre à l'URL Shotgun :
-- shotgun.live/cities/<slug>). Ajout/retrait ensuite via le dashboard.
insert into cities (name, shotgun_slug, active) values
  ('Lyon',      'lyon',      true),
  ('Paris',     'paris',     true),
  ('Marseille', 'marseille', true)
on conflict (shotgun_slug) do nothing;
