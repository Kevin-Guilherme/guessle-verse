-- Migrate Monster Hunter theme to universe-specific mode slugs
UPDATE themes
SET modes = array['monsterhunter-classic', 'monsterhunter-description', 'monsterhunter-silhouette']
WHERE slug = 'monsterhunter';
