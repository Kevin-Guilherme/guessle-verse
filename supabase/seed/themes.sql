insert into themes (slug, name, icon, color, type, modes) values
  ('lol',           'LoLdle',        '⚔️',  '#C89B3C', 'character', array['classic','quote','ability','splash','build','skill-order','quadra']),
  ('naruto',        'Narutodle',     '🍥',  '#FF6B2B', 'character', array['classic','jutsu','quote','eye','voice']),
  ('onepiece',      'OnePiecedle',   '🏴‍☠️', '#E8C84A', 'character', array['classic','devil-fruit','wanted','laugh']),
  ('jujutsu',       'Jujutsudle',    '🩸',  '#8B5CF6', 'character', array['classic','cursed-technique','quote','eyes']),
  ('pokemon',       'Pokédle',        '⚡',  '#FFCC02', 'character', array['classic','silhouette','ability','cry']),
  ('smash',         'Smashdle',       '🥊',  '#E8534A', 'character', array['classic','silhouette','kirby','final-smash']),
  ('zelda',         'Zeldadle',       '🧝',  '#4ADE80', 'character', array['classic','item','location','music']),
  ('mario',         'Mariodle',       '⭐',  '#EF4444', 'character', array['classic','game','sound','level']),
  ('gow',           'GoWdle',          '🪓',  '#DC2626', 'character', array['classic','weapon','voice','quote']),
  ('monsterhunter', 'MHdle',           '🐉',  '#F97316', 'character', array['classic','silhouette','roar','weakness']),
  ('gamedle',       'Gamedle',         '🕹️', '#6366F1', 'game',      array['classic','screenshot','cover','soundtrack']),
  ('js',            'JSdle',           '🟨',  '#F7DF1E', 'code',      array['complete','fix','output']),
  ('ts',            'TSdle',           '🟦',  '#3178C6', 'code',      array['complete','fix','output']),
  ('python',        'Pythondle',       '🐍',  '#3B82F6', 'code',      array['complete','fix','output'])
on conflict (slug) do nothing;
