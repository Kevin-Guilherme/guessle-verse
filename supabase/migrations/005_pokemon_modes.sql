-- Migrate Pokémon theme to new mode slugs
UPDATE themes
SET modes = array['pokemon-classic', 'pokemon-card', 'pokemon-description', 'pokemon-silhouette']
WHERE slug = 'pokemon';
