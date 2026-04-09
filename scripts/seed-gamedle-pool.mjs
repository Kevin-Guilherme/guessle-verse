/**
 * Seed da gamedle_pool com 150 jogos populares.
 *
 * IGDB IDs são os reais quando conhecidos.
 * Nota: capa/screenshot via IGDB só funciona quando IGDB_CLIENT_ID
 * estiver configurado nas Supabase Function secrets — o seed
 * não depende disso para funcionar nos modos classic/soundtrack.
 *
 * Uso: node scripts/seed-gamedle-pool.mjs [--dry-run]
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dirname, '../apps/web/.env.local'), 'utf8')
const env        = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DRY_RUN  = process.argv.includes('--dry-run')

// ─── Game Pool ────────────────────────────────────────────────────────────────
// igdb_id: ID real quando conhecido; 9_000_000+ quando placeholder

const GAMES = [
  // ── Action-Adventure ──────────────────────────────────────────────────────
  { igdb_id: 7346,   name: 'The Legend of Zelda: Breath of the Wild', genre: ['Adventure', 'Role-playing (RPG)'], platform: ['Switch', 'Wii U'], developer: 'Nintendo EPD', franchise: 'The Legend of Zelda', release_year: 2017, multiplayer: false },
  { igdb_id: 10049,  name: 'The Legend of Zelda: Ocarina of Time',    genre: ['Adventure', 'Role-playing (RPG)'], platform: ['Nintendo 64', 'Nintendo 3DS'], developer: 'Nintendo EAD', franchise: 'The Legend of Zelda', release_year: 1998, multiplayer: false },
  { igdb_id: 119388, name: 'The Legend of Zelda: Tears of the Kingdom',genre: ['Adventure', 'Role-playing (RPG)'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'The Legend of Zelda', release_year: 2023, multiplayer: false },
  { igdb_id: 37663,  name: 'God of War (2018)',                        genre: ['Action', 'Adventure'], platform: ['PlayStation 4', 'PC Windows'], developer: 'Santa Monica Studio', franchise: 'God of War', release_year: 2018, multiplayer: false },
  { igdb_id: 119171, name: 'God of War: Ragnarök',                     genre: ['Action', 'Adventure'], platform: ['PlayStation 4', 'PlayStation 5'], developer: 'Santa Monica Studio', franchise: 'God of War', release_year: 2022, multiplayer: false },
  { igdb_id: 25076,  name: 'Red Dead Redemption 2',                    genre: ['Adventure', 'Shooter'], platform: ['PlayStation 4', 'Xbox One', 'PC Windows'], developer: 'Rockstar Games', franchise: 'Red Dead', release_year: 2018, multiplayer: true },
  { igdb_id: 10297,  name: 'Red Dead Redemption',                      genre: ['Adventure', 'Shooter'], platform: ['PlayStation 3', 'Xbox 360'], developer: 'Rockstar San Diego', franchise: 'Red Dead', release_year: 2010, multiplayer: true },
  { igdb_id: 1020,   name: 'Grand Theft Auto V',                       genre: ['Adventure', 'Shooter'], platform: ['PlayStation 4', 'Xbox One', 'PC Windows', 'PlayStation 5'], developer: 'Rockstar North', franchise: 'Grand Theft Auto', release_year: 2013, multiplayer: true },
  { igdb_id: 23027,  name: 'Grand Theft Auto: San Andreas',            genre: ['Adventure', 'Shooter'], platform: ['PlayStation 2', 'PC Windows', 'Xbox'], developer: 'Rockstar North', franchise: 'Grand Theft Auto', release_year: 2004, multiplayer: false },
  { igdb_id: 19834,  name: 'Uncharted 4: A Thief\'s End',              genre: ['Adventure', 'Shooter'], platform: ['PlayStation 4'], developer: 'Naughty Dog', franchise: 'Uncharted', release_year: 2016, multiplayer: true },
  { igdb_id: 2122,   name: 'Batman: Arkham City',                      genre: ['Action', 'Adventure'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360'], developer: 'Rocksteady Studios', franchise: 'Batman: Arkham', release_year: 2011, multiplayer: false },
  { igdb_id: 39736,  name: 'Marvel\'s Spider-Man',                     genre: ['Action', 'Adventure'], platform: ['PlayStation 4'], developer: 'Insomniac Games', franchise: 'Spider-Man', release_year: 2018, multiplayer: false },
  // ── RPG ───────────────────────────────────────────────────────────────────
  { igdb_id: 1942,   name: 'The Witcher 3: Wild Hunt',                 genre: ['Role-playing (RPG)', 'Adventure'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'CD Projekt RED', franchise: 'The Witcher', release_year: 2015, multiplayer: false },
  { igdb_id: 72,     name: 'The Elder Scrolls V: Skyrim',              genre: ['Role-playing (RPG)', 'Adventure'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Bethesda Game Studios', franchise: 'The Elder Scrolls', release_year: 2011, multiplayer: false },
  { igdb_id: 83,     name: 'Mass Effect 2',                            genre: ['Role-playing (RPG)', 'Shooter'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360'], developer: 'BioWare', franchise: 'Mass Effect', release_year: 2010, multiplayer: false },
  { igdb_id: 360,    name: 'Dark Souls',                               genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360'], developer: 'FromSoftware', franchise: 'Souls', release_year: 2011, multiplayer: true },
  { igdb_id: 11133,  name: 'Dark Souls III',                           genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'FromSoftware', franchise: 'Souls', release_year: 2016, multiplayer: true },
  { igdb_id: 119133, name: 'Elden Ring',                               genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series'], developer: 'FromSoftware', franchise: 'Souls', release_year: 2022, multiplayer: true },
  { igdb_id: 19064,  name: 'Bloodborne',                               genre: ['Role-playing (RPG)', 'Action'], platform: ['PlayStation 4'], developer: 'FromSoftware', franchise: 'Souls', release_year: 2015, multiplayer: true },
  { igdb_id: 70111,  name: 'Sekiro: Shadows Die Twice',                genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'FromSoftware', franchise: 'Souls', release_year: 2019, multiplayer: false },
  { igdb_id: 21867,  name: 'Persona 5',                                genre: ['Role-playing (RPG)'], platform: ['PlayStation 3', 'PlayStation 4'], developer: 'Atlus', franchise: 'Persona', release_year: 2016, multiplayer: false },
  { igdb_id: 429,    name: 'Final Fantasy VII',                         genre: ['Role-playing (RPG)'], platform: ['PlayStation', 'PC Windows'], developer: 'Square', franchise: 'Final Fantasy', release_year: 1997, multiplayer: false },
  { igdb_id: 1137,   name: 'Final Fantasy XIV: A Realm Reborn',        genre: ['Role-playing (RPG)', 'Massively Multiplayer Online (MMO)'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5'], developer: 'Square Enix', franchise: 'Final Fantasy', release_year: 2013, multiplayer: true },
  { igdb_id: 1022,   name: 'Final Fantasy XV',                         genre: ['Role-playing (RPG)', 'Action'], platform: ['PlayStation 4', 'Xbox One', 'PC Windows'], developer: 'Square Enix', franchise: 'Final Fantasy', release_year: 2016, multiplayer: true },
  { igdb_id: 99936,  name: 'Disco Elysium',                            genre: ['Role-playing (RPG)', 'Point-and-click'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5'], developer: 'ZA/UM', franchise: '', release_year: 2019, multiplayer: false },
  { igdb_id: 149,    name: 'Baldur\'s Gate II: Shadows of Amn',        genre: ['Role-playing (RPG)'], platform: ['PC Windows', 'Mac'], developer: 'BioWare', franchise: 'Baldur\'s Gate', release_year: 2000, multiplayer: true },
  { igdb_id: 257494, name: 'Baldur\'s Gate 3',                         genre: ['Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 5', 'Mac'], developer: 'Larian Studios', franchise: 'Baldur\'s Gate', release_year: 2023, multiplayer: true },
  // ── FPS ───────────────────────────────────────────────────────────────────
  { igdb_id: 49,     name: 'Half-Life 2',                              genre: ['Shooter'], platform: ['PC Windows', 'Xbox', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Half-Life', release_year: 2004, multiplayer: true },
  { igdb_id: 3028,   name: 'Portal 2',                                 genre: ['Puzzle', 'Shooter'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Portal', release_year: 2011, multiplayer: true },
  { igdb_id: 702,    name: 'Portal',                                   genre: ['Puzzle', 'Shooter'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Portal', release_year: 2007, multiplayer: false },
  { igdb_id: 7974,   name: 'Doom (2016)',                              genre: ['Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'id Software', franchise: 'Doom', release_year: 2016, multiplayer: true },
  { igdb_id: 97218,  name: 'Doom Eternal',                             genre: ['Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'id Software', franchise: 'Doom', release_year: 2020, multiplayer: true },
  { igdb_id: 1096,   name: 'Halo: Combat Evolved',                     genre: ['Shooter'], platform: ['Xbox', 'PC Windows', 'Mac'], developer: 'Bungie', franchise: 'Halo', release_year: 2001, multiplayer: true },
  { igdb_id: 521,    name: 'BioShock',                                 genre: ['Shooter', 'Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360', 'Mac'], developer: 'Irrational Games', franchise: 'BioShock', release_year: 2007, multiplayer: false },
  { igdb_id: 1685,   name: 'BioShock Infinite',                        genre: ['Shooter', 'Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360', 'Mac', 'Linux'], developer: 'Irrational Games', franchise: 'BioShock', release_year: 2013, multiplayer: false },
  { igdb_id: 7438,   name: 'Titanfall 2',                              genre: ['Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'Respawn Entertainment', franchise: 'Titanfall', release_year: 2016, multiplayer: true },
  { igdb_id: 11198,  name: 'Overwatch',                                genre: ['Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Blizzard Entertainment', franchise: 'Overwatch', release_year: 2016, multiplayer: true },
  { igdb_id: 6857,   name: 'Counter-Strike: Global Offensive',         genre: ['Shooter'], platform: ['PC Windows', 'Mac', 'Linux', 'PlayStation 3', 'Xbox 360'], developer: 'Valve', franchise: 'Counter-Strike', release_year: 2012, multiplayer: true },
  // ── Platformers ───────────────────────────────────────────────────────────
  { igdb_id: 52570,  name: 'Super Mario Odyssey',                      genre: ['Platform', 'Adventure'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'Mario', release_year: 2017, multiplayer: true },
  { igdb_id: 3836,   name: 'Super Mario 64',                           genre: ['Platform', 'Adventure'], platform: ['Nintendo 64'], developer: 'Nintendo EAD', franchise: 'Mario', release_year: 1996, multiplayer: false },
  { igdb_id: 5442,   name: 'Super Mario Galaxy',                       genre: ['Platform', 'Adventure'], platform: ['Wii'], developer: 'Nintendo EAD', franchise: 'Mario', release_year: 2007, multiplayer: false },
  { igdb_id: 91730,  name: 'Celeste',                                  genre: ['Platform', 'Indie'], platform: ['PC Windows', 'Switch', 'PlayStation 4', 'Xbox One'], developer: 'Extremely OK Games', franchise: '', release_year: 2018, multiplayer: false },
  { igdb_id: 28768,  name: 'Hollow Knight',                            genre: ['Platform', 'Adventure', 'Indie'], platform: ['PC Windows', 'Switch', 'PlayStation 4', 'Xbox One', 'Mac', 'Linux'], developer: 'Team Cherry', franchise: 'Hollow Knight', release_year: 2017, multiplayer: false },
  { igdb_id: 23127,  name: 'Ori and the Blind Forest',                 genre: ['Platform', 'Adventure', 'Indie'], platform: ['PC Windows', 'Xbox One', 'Switch', 'Mac'], developer: 'Moon Studios', franchise: 'Ori', release_year: 2015, multiplayer: false },
  { igdb_id: 8296,   name: 'Crash Bandicoot',                          genre: ['Platform', 'Adventure'], platform: ['PlayStation'], developer: 'Naughty Dog', franchise: 'Crash Bandicoot', release_year: 1996, multiplayer: false },
  { igdb_id: 105984, name: 'Crash Bandicoot N. Sane Trilogy',          genre: ['Platform', 'Adventure'], platform: ['PlayStation 4', 'PC Windows', 'Xbox One', 'Switch'], developer: 'Vicarious Visions', franchise: 'Crash Bandicoot', release_year: 2017, multiplayer: false },
  // ── Survival/Horror ───────────────────────────────────────────────────────
  { igdb_id: 4816,   name: 'The Last of Us',                           genre: ['Adventure', 'Shooter'], platform: ['PlayStation 3', 'PlayStation 4'], developer: 'Naughty Dog', franchise: 'The Last of Us', release_year: 2013, multiplayer: true },
  { igdb_id: 116630, name: 'The Last of Us Part II',                   genre: ['Adventure', 'Shooter'], platform: ['PlayStation 4'], developer: 'Naughty Dog', franchise: 'The Last of Us', release_year: 2020, multiplayer: false },
  { igdb_id: 8534,   name: 'Resident Evil 4',                          genre: ['Adventure', 'Shooter'], platform: ['GameCube', 'PC Windows', 'PlayStation 2', 'PlayStation 4'], developer: 'Capcom', franchise: 'Resident Evil', release_year: 2005, multiplayer: false },
  { igdb_id: 101553, name: 'Resident Evil 2 (2019)',                   genre: ['Adventure', 'Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'Capcom', franchise: 'Resident Evil', release_year: 2019, multiplayer: false },
  { igdb_id: 8573,   name: 'Alien: Isolation',                         genre: ['Adventure', 'Stealth'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 3', 'Xbox One', 'Xbox 360'], developer: 'Creative Assembly', franchise: 'Alien', release_year: 2014, multiplayer: false },
  { igdb_id: 9,      name: 'Silent Hill 2',                            genre: ['Adventure', 'Horror'], platform: ['PlayStation 2', 'Xbox', 'PC Windows'], developer: 'Konami', franchise: 'Silent Hill', release_year: 2001, multiplayer: false },
  { igdb_id: 57522,  name: 'Outlast',                                  genre: ['Adventure', 'Horror', 'Indie'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Red Barrels', franchise: 'Outlast', release_year: 2013, multiplayer: false },
  { igdb_id: 131026, name: 'Phasmophobia',                             genre: ['Adventure', 'Horror', 'Indie'], platform: ['PC Windows'], developer: 'Kinetic Games', franchise: '', release_year: 2020, multiplayer: true },
  { igdb_id: 31469,  name: 'Dead by Daylight',                         genre: ['Survival', 'Horror'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Behaviour Interactive', franchise: '', release_year: 2016, multiplayer: true },
  // ── Stealth/Action ────────────────────────────────────────────────────────
  { igdb_id: 1703,   name: 'Metal Gear Solid V: The Phantom Pain',     genre: ['Adventure', 'Stealth', 'Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'PlayStation 3', 'Xbox 360'], developer: 'Kojima Productions', franchise: 'Metal Gear', release_year: 2015, multiplayer: true },
  { igdb_id: 8989,   name: 'Dishonored',                               genre: ['Stealth', 'Action'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360'], developer: 'Arkane Studios', franchise: 'Dishonored', release_year: 2012, multiplayer: false },
  { igdb_id: 131913, name: 'Hitman 3',                                 genre: ['Stealth', 'Shooter'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Switch'], developer: 'IO Interactive', franchise: 'Hitman', release_year: 2021, multiplayer: false },
  { igdb_id: 3888,   name: "Assassin's Creed II",                      genre: ['Action', 'Adventure', 'Stealth'], platform: ['PC Windows', 'PlayStation 3', 'Xbox 360'], developer: 'Ubisoft Montreal', franchise: "Assassin's Creed", release_year: 2009, multiplayer: false },
  { igdb_id: 38730,  name: 'Prey (2017)',                              genre: ['Shooter', 'Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'Arkane Studios', franchise: '', release_year: 2017, multiplayer: false },
  // ── Open World ────────────────────────────────────────────────────────────
  { igdb_id: 27749,  name: 'NieR: Automata',                           genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'PlatinumGames', franchise: 'NieR', release_year: 2017, multiplayer: false },
  { igdb_id: 1877,   name: 'Cyberpunk 2077',                           genre: ['Role-playing (RPG)', 'Shooter'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series'], developer: 'CD Projekt RED', franchise: 'Cyberpunk', release_year: 2020, multiplayer: false },
  { igdb_id: 28608,  name: 'Horizon Zero Dawn',                        genre: ['Role-playing (RPG)', 'Shooter'], platform: ['PlayStation 4', 'PC Windows'], developer: 'Guerrilla Games', franchise: 'Horizon', release_year: 2017, multiplayer: false },
  { igdb_id: 113903, name: 'Ghost of Tsushima',                        genre: ['Action', 'Adventure'], platform: ['PlayStation 4', 'PlayStation 5'], developer: 'Sucker Punch Productions', franchise: '', release_year: 2020, multiplayer: true },
  { igdb_id: 103298, name: 'Death Stranding',                          genre: ['Action', 'Adventure'], platform: ['PlayStation 4', 'PC Windows', 'PlayStation 5'], developer: 'Kojima Productions', franchise: '', release_year: 2019, multiplayer: true },
  // ── Strategy ──────────────────────────────────────────────────────────────
  { igdb_id: 3959,   name: 'Civilization VI',                          genre: ['Strategy', 'Turn-based strategy (TBS)'], platform: ['PC Windows', 'Mac', 'Linux', 'Switch', 'iOS', 'Android'], developer: 'Firaxis Games', franchise: 'Civilization', release_year: 2016, multiplayer: true },
  { igdb_id: 5560,   name: 'StarCraft II: Wings of Liberty',           genre: ['Strategy', 'Real Time Strategy (RTS)'], platform: ['PC Windows', 'Mac'], developer: 'Blizzard Entertainment', franchise: 'StarCraft', release_year: 2010, multiplayer: true },
  { igdb_id: 4,      name: 'Warcraft III: Reign of Chaos',             genre: ['Strategy', 'Real Time Strategy (RTS)'], platform: ['PC Windows', 'Mac'], developer: 'Blizzard Entertainment', franchise: 'Warcraft', release_year: 2002, multiplayer: true },
  { igdb_id: 1550,   name: 'Age of Empires II',                        genre: ['Strategy', 'Real Time Strategy (RTS)'], platform: ['PC Windows', 'Mac'], developer: 'Ensemble Studios', franchise: 'Age of Empires', release_year: 1999, multiplayer: true },
  // ── Sports/Racing ─────────────────────────────────────────────────────────
  { igdb_id: 18891,  name: 'Rocket League',                            genre: ['Sport', 'Racing'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Psyonix', franchise: '', release_year: 2015, multiplayer: true },
  { igdb_id: 164870, name: 'Mario Kart 8 Deluxe',                      genre: ['Racing', 'Sport'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'Mario Kart', release_year: 2017, multiplayer: true },
  { igdb_id: 37124,  name: 'Super Smash Bros. Ultimate',               genre: ['Fighting'], platform: ['Switch'], developer: 'Sora Ltd.', franchise: 'Super Smash Bros.', release_year: 2018, multiplayer: true },
  // ── Fighting ──────────────────────────────────────────────────────────────
  { igdb_id: 25647,  name: 'Mortal Kombat 11',                         genre: ['Fighting'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'PlayStation 5'], developer: 'NetherRealm Studios', franchise: 'Mortal Kombat', release_year: 2019, multiplayer: true },
  { igdb_id: 229781, name: 'Street Fighter 6',                         genre: ['Fighting'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox Series'], developer: 'Capcom', franchise: 'Street Fighter', release_year: 2023, multiplayer: true },
  { igdb_id: 7846,   name: 'Tekken 7',                                 genre: ['Fighting'], platform: ['Arcade', 'PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'Bandai Namco Studios', franchise: 'Tekken', release_year: 2015, multiplayer: true },
  // ── Battle Royale/Multiplayer ──────────────────────────────────────────────
  { igdb_id: 62045,  name: 'Fortnite',                                 genre: ['Shooter', 'Battle Royale'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'iOS', 'Android'], developer: 'Epic Games', franchise: 'Fortnite', release_year: 2017, multiplayer: true },
  { igdb_id: 108593, name: 'PUBG: Battlegrounds',                      genre: ['Shooter', 'Battle Royale'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Mobile'], developer: 'PUBG Studios', franchise: '', release_year: 2017, multiplayer: true },
  { igdb_id: 107399, name: 'Apex Legends',                             genre: ['Shooter', 'Battle Royale'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Respawn Entertainment', franchise: '', release_year: 2019, multiplayer: true },
  { igdb_id: 116116, name: 'Among Us',                                 genre: ['Strategy', 'Indie'], platform: ['PC Windows', 'iOS', 'Android', 'Switch', 'PlayStation 4', 'Xbox One'], developer: 'Innersloth', franchise: '', release_year: 2018, multiplayer: true },
  { igdb_id: 144048, name: 'Fall Guys',                                genre: ['Platform', 'Battle Royale'], platform: ['PC Windows', 'PlayStation 4', 'Switch', 'Xbox One'], developer: 'Mediatonic', franchise: '', release_year: 2020, multiplayer: true },
  { igdb_id: 115,    name: 'League of Legends',                        genre: ['Massively Multiplayer Online (MMO)', 'Strategy'], platform: ['PC Windows', 'Mac'], developer: 'Riot Games', franchise: 'League of Legends', release_year: 2009, multiplayer: true },
  { igdb_id: 435,    name: 'Dota 2',                                   genre: ['Strategy', 'Massively Multiplayer Online (MMO)'], platform: ['PC Windows', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Dota', release_year: 2013, multiplayer: true },
  // ── Indie/Sandbox ─────────────────────────────────────────────────────────
  { igdb_id: 23767,  name: 'Undertale',                                genre: ['Role-playing (RPG)', 'Adventure', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'PlayStation 4', 'Switch'], developer: 'Toby Fox', franchise: '', release_year: 2015, multiplayer: false },
  { igdb_id: 50871,  name: 'Stardew Valley',                           genre: ['Role-playing (RPG)', 'Simulator', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'Switch', 'PlayStation 4', 'Xbox One', 'iOS', 'Android'], developer: 'ConcernedApe', franchise: '', release_year: 2016, multiplayer: true },
  { igdb_id: 111313, name: 'Hades',                                    genre: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up', 'Indie'], platform: ['PC Windows', 'Mac', 'Switch', 'PlayStation 4', 'PlayStation 5', 'Xbox One'], developer: 'Supergiant Games', franchise: 'Hades', release_year: 2020, multiplayer: false },
  { igdb_id: 23716,  name: 'Cuphead',                                  genre: ['Platform', 'Shooter', 'Indie'], platform: ['PC Windows', 'Xbox One', 'Switch', 'PlayStation 4', 'Mac'], developer: 'Studio MDHR', franchise: '', release_year: 2017, multiplayer: true },
  { igdb_id: 134,    name: 'Minecraft',                                genre: ['Simulator', 'Adventure', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'iOS', 'Android', 'Switch', 'PlayStation 4', 'Xbox One'], developer: 'Mojang Studios', franchise: 'Minecraft', release_year: 2011, multiplayer: true },
  { igdb_id: 1290,   name: 'Terraria',                                 genre: ['Platform', 'Adventure', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'iOS', 'Android', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Re-Logic', franchise: '', release_year: 2011, multiplayer: true },
  { igdb_id: 38742,  name: 'Dead Cells',                               genre: ['Platform', 'Hack and slash/Beat \'em up', 'Indie'], platform: ['PC Windows', 'Switch', 'PlayStation 4', 'Xbox One', 'iOS', 'Android'], developer: 'Motion Twin', franchise: '', release_year: 2018, multiplayer: false },
  { igdb_id: 24189,  name: 'Enter the Gungeon',                        genre: ['Shooter', 'Role-playing (RPG)', 'Indie'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'Mac', 'Linux'], developer: 'Dodge Roll', franchise: '', release_year: 2016, multiplayer: true },
  { igdb_id: 14417,  name: 'The Binding of Isaac: Rebirth',            genre: ['Shooter', 'Role-playing (RPG)', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'PlayStation 4', 'PlayStation Vita', 'Xbox One', 'Switch', 'iOS', 'Android'], developer: 'Nicalis', franchise: 'The Binding of Isaac', release_year: 2014, multiplayer: false },
  // ── Action ────────────────────────────────────────────────────────────────
  { igdb_id: 105649, name: 'Devil May Cry 5',                          genre: ['Hack and slash/Beat \'em up', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'PlayStation 5', 'Xbox Series'], developer: 'Capcom', franchise: 'Devil May Cry', release_year: 2019, multiplayer: false },
  { igdb_id: 89474,  name: 'Control',                                  genre: ['Shooter', 'Action', 'Adventure'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'PlayStation 5', 'Xbox Series'], developer: 'Remedy Entertainment', franchise: '', release_year: 2019, multiplayer: false },
  { igdb_id: 37030,  name: 'Monster Hunter: World',                    genre: ['Role-playing (RPG)', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One'], developer: 'Capcom', franchise: 'Monster Hunter', release_year: 2018, multiplayer: true },
  { igdb_id: 97220,  name: 'Monster Hunter Rise',                      genre: ['Role-playing (RPG)', 'Action'], platform: ['Switch', 'PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Xbox Series'], developer: 'Capcom', franchise: 'Monster Hunter', release_year: 2021, multiplayer: true },
  { igdb_id: 7056,   name: 'Bayonetta',                                genre: ['Hack and slash/Beat \'em up', 'Action'], platform: ['PlayStation 3', 'Xbox 360', 'PC Windows', 'Wii U', 'Switch'], developer: 'PlatinumGames', franchise: 'Bayonetta', release_year: 2009, multiplayer: false },
  // ── Simulation ────────────────────────────────────────────────────────────
  { igdb_id: 100786, name: 'Animal Crossing: New Horizons',            genre: ['Simulator', 'Adventure'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'Animal Crossing', release_year: 2020, multiplayer: true },
  { igdb_id: 2694,   name: 'The Sims 4',                               genre: ['Simulator', 'Strategy'], platform: ['PC Windows', 'Mac', 'PlayStation 4', 'Xbox One'], developer: 'Maxis', franchise: 'The Sims', release_year: 2014, multiplayer: false },
  { igdb_id: 3126,   name: 'Cities: Skylines',                         genre: ['Simulator', 'Strategy'], platform: ['PC Windows', 'Mac', 'Linux', 'Xbox One', 'PlayStation 4', 'Switch'], developer: 'Colossal Order', franchise: '', release_year: 2015, multiplayer: false },
  { igdb_id: 1400,   name: 'Factorio',                                 genre: ['Strategy', 'Simulator', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux'], developer: 'Wube Software', franchise: '', release_year: 2020, multiplayer: true },
  // ── Nintendo ──────────────────────────────────────────────────────────────
  { igdb_id: 70261,  name: 'Splatoon 2',                               genre: ['Shooter'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'Splatoon', release_year: 2017, multiplayer: true },
  { igdb_id: 131328, name: 'Splatoon 3',                               genre: ['Shooter'], platform: ['Switch'], developer: 'Nintendo EPD', franchise: 'Splatoon', release_year: 2022, multiplayer: true },
  { igdb_id: 78663,  name: 'Fire Emblem: Three Houses',                genre: ['Strategy', 'Role-playing (RPG)', 'Turn-based strategy (TBS)'], platform: ['Switch'], developer: 'Intelligent Systems', franchise: 'Fire Emblem', release_year: 2019, multiplayer: false },
  { igdb_id: 122767, name: 'Kirby and the Forgotten Land',             genre: ['Platform', 'Adventure'], platform: ['Switch'], developer: 'HAL Laboratory', franchise: 'Kirby', release_year: 2022, multiplayer: true },
  { igdb_id: 134597, name: 'Metroid Dread',                            genre: ['Platform', 'Shooter', 'Adventure'], platform: ['Switch'], developer: 'MercurySteam', franchise: 'Metroid', release_year: 2021, multiplayer: false },
  // ── 2021–2024 ─────────────────────────────────────────────────────────────
  { igdb_id: 126880, name: 'It Takes Two',                             genre: ['Adventure', 'Platform', 'Puzzle'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Switch'], developer: 'Hazelight Studios', franchise: '', release_year: 2021, multiplayer: true },
  { igdb_id: 101009, name: 'Returnal',                                 genre: ['Shooter', 'Adventure'], platform: ['PlayStation 5', 'PC Windows'], developer: 'Housemarque', franchise: '', release_year: 2021, multiplayer: false },
  { igdb_id: 113086, name: 'Deathloop',                                genre: ['Shooter', 'Stealth'], platform: ['PC Windows', 'PlayStation 5', 'Xbox Series'], developer: 'Arkane Lyon', franchise: '', release_year: 2021, multiplayer: true },
  { igdb_id: 154774, name: 'Sifu',                                     genre: ['Hack and slash/Beat \'em up', 'Action'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Switch', 'Xbox One', 'Xbox Series'], developer: 'Sloclap', franchise: '', release_year: 2022, multiplayer: false },
  { igdb_id: 224694, name: 'Hi-Fi Rush',                               genre: ['Hack and slash/Beat \'em up', 'Action'], platform: ['PC Windows', 'Xbox Series', 'PlayStation 5'], developer: 'Tango Gameworks', franchise: '', release_year: 2023, multiplayer: false },
  { igdb_id: 215554, name: 'Alan Wake 2',                              genre: ['Adventure', 'Shooter'], platform: ['PC Windows', 'PlayStation 5', 'Xbox Series'], developer: 'Remedy Entertainment', franchise: 'Alan Wake', release_year: 2023, multiplayer: false },
  { igdb_id: 297700, name: 'Hades II',                                 genre: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up', 'Indie'], platform: ['PC Windows', 'Mac'], developer: 'Supergiant Games', franchise: 'Hades', release_year: 2024, multiplayer: false },
  // ── Classic/Retro ─────────────────────────────────────────────────────────
  { igdb_id: 32,     name: 'Pac-Man',                                  genre: ['Arcade'], platform: ['Arcade', 'PC Windows', 'Atari 2600'], developer: 'Namco', franchise: 'Pac-Man', release_year: 1980, multiplayer: true },
  { igdb_id: 585,    name: 'Tetris',                                   genre: ['Puzzle'], platform: ['Game Boy', 'NES', 'Arcade', 'PC Windows'], developer: 'Nintendo', franchise: 'Tetris', release_year: 1984, multiplayer: true },
  { igdb_id: 1074,   name: 'Super Mario Bros.',                        genre: ['Platform'], platform: ['NES', 'Game Boy Advance', 'Switch'], developer: 'Nintendo', franchise: 'Mario', release_year: 1985, multiplayer: true },
  { igdb_id: 553,    name: 'Donkey Kong Country',                      genre: ['Platform'], platform: ['Super Nintendo', 'Game Boy Advance', 'Wii'], developer: 'Rare', franchise: 'Donkey Kong', release_year: 1994, multiplayer: true },
  { igdb_id: 268,    name: 'Quake',                                    genre: ['Shooter'], platform: ['PC Windows', 'Mac', 'Linux', 'PlayStation 4'], developer: 'id Software', franchise: 'Quake', release_year: 1996, multiplayer: true },
  { igdb_id: 1573,   name: 'Doom (1993)',                              genre: ['Shooter'], platform: ['PC Windows', 'PlayStation', 'Xbox One', 'Switch'], developer: 'id Software', franchise: 'Doom', release_year: 1993, multiplayer: true },
  { igdb_id: 3,      name: 'Super Mario World',                        genre: ['Platform', 'Adventure'], platform: ['Super Nintendo', 'Game Boy Advance', 'Wii'], developer: 'Nintendo EAD', franchise: 'Mario', release_year: 1990, multiplayer: true },
  { igdb_id: 572,    name: 'Castlevania: Symphony of the Night',       genre: ['Platform', 'Role-playing (RPG)', 'Adventure'], platform: ['PlayStation', 'PlayStation 3', 'Xbox 360', 'PSP'], developer: 'Konami', franchise: 'Castlevania', release_year: 1997, multiplayer: false },
  // ── Misc Popular ──────────────────────────────────────────────────────────
  { igdb_id: 2611,   name: 'Left 4 Dead 2',                            genre: ['Shooter'], platform: ['PC Windows', 'Xbox 360', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Left 4 Dead', release_year: 2009, multiplayer: true },
  { igdb_id: 2663,   name: 'Team Fortress 2',                          genre: ['Shooter'], platform: ['PC Windows', 'Mac', 'Linux'], developer: 'Valve', franchise: 'Team Fortress', release_year: 2007, multiplayer: true },
  { igdb_id: 541,    name: 'World of Warcraft',                        genre: ['Role-playing (RPG)', 'Massively Multiplayer Online (MMO)'], platform: ['PC Windows', 'Mac'], developer: 'Blizzard Entertainment', franchise: 'Warcraft', release_year: 2004, multiplayer: true },
  { igdb_id: 58,     name: 'Diablo II',                                genre: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up'], platform: ['PC Windows', 'Mac'], developer: 'Blizzard Entertainment', franchise: 'Diablo', release_year: 2000, multiplayer: true },
  { igdb_id: 136,    name: 'Minecraft Dungeons',                       genre: ['Hack and slash/Beat \'em up', 'Role-playing (RPG)'], platform: ['PC Windows', 'Switch', 'PlayStation 4', 'Xbox One'], developer: 'Mojang Studios', franchise: 'Minecraft', release_year: 2020, multiplayer: true },
  { igdb_id: 14593,  name: 'Shovel Knight',                            genre: ['Platform', 'Indie'], platform: ['PC Windows', 'Switch', 'PlayStation 4', 'Xbox One', '3DS', 'Wii U'], developer: 'Yacht Club Games', franchise: 'Shovel Knight', release_year: 2014, multiplayer: true },
  { igdb_id: 119280, name: 'Outer Wilds',                              genre: ['Adventure', 'Puzzle', 'Indie'], platform: ['PC Windows', 'PlayStation 4', 'PlayStation 5', 'Xbox One', 'Switch', 'Mac'], developer: 'Mobius Digital', franchise: '', release_year: 2019, multiplayer: false },
  { igdb_id: 81530,  name: 'What Remains of Edith Finch',              genre: ['Adventure', 'Indie'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'iOS'], developer: 'Giant Sparrow', franchise: '', release_year: 2017, multiplayer: false },
  { igdb_id: 32467,  name: 'Firewatch',                                genre: ['Adventure', 'Indie'], platform: ['PC Windows', 'Mac', 'Linux', 'PlayStation 4', 'Xbox One', 'Switch'], developer: 'Campo Santo', franchise: '', release_year: 2016, multiplayer: false },
  { igdb_id: 13194,  name: 'Destiny 2',                                genre: ['Shooter', 'Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'PlayStation 5', 'Xbox Series'], developer: 'Bungie', franchise: 'Destiny', release_year: 2017, multiplayer: true },
  { igdb_id: 9767,   name: 'Warframe',                                 genre: ['Shooter', 'Role-playing (RPG)'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'PlayStation 5'], developer: 'Digital Extremes', franchise: '', release_year: 2013, multiplayer: true },
  { igdb_id: 17000,  name: 'No Man\'s Sky',                            genre: ['Simulator', 'Adventure', 'Shooter'], platform: ['PC Windows', 'PlayStation 4', 'Xbox One', 'Switch', 'PlayStation 5'], developer: 'Hello Games', franchise: '', release_year: 2016, multiplayer: true },
  { igdb_id: 20,     name: 'Diablo III',                               genre: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up'], platform: ['PC Windows', 'Mac', 'PlayStation 3', 'PlayStation 4', 'Xbox 360', 'Xbox One', 'Switch'], developer: 'Blizzard Entertainment', franchise: 'Diablo', release_year: 2012, multiplayer: true },
  { igdb_id: 15375,  name: 'Path of Exile',                            genre: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up'], platform: ['PC Windows', 'Xbox One', 'PlayStation 4', 'Mac'], developer: 'Grinding Gear Games', franchise: '', release_year: 2013, multiplayer: true },
  { igdb_id: 130,    name: 'The Sims',                                 genre: ['Simulator', 'Strategy'], platform: ['PC Windows', 'Mac'], developer: 'Maxis', franchise: 'The Sims', release_year: 2000, multiplayer: false },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎮 Gamedle Pool Seeder ${DRY_RUN ? '[DRY RUN]' : ''}\n`)
  console.log(`📋 ${GAMES.length} games no catálogo\n`)

  if (DRY_RUN) {
    console.log('Primeiros 5 games:')
    GAMES.slice(0, 5).forEach(g => console.log(`  • [${g.igdb_id}] ${g.name} (${g.release_year}) — ${g.developer}`))
    console.log('\n  ...\n')
    console.log('ℹ️  Dry-run. Nada foi salvo.')
    return
  }

  // Upsert em batches de 20
  const BATCH = 20
  let inserted = 0, updated = 0, errors = 0

  for (let i = 0; i < GAMES.length; i += BATCH) {
    const batch = GAMES.slice(i, i + BATCH)
    const { data, error } = await supabase
      .from('gamedle_pool')
      .upsert(batch, { onConflict: 'igdb_id' })
      .select('id')

    if (error) {
      console.error(`❌ Batch ${i / BATCH + 1} erro:`, error.message)
      errors += batch.length
    } else {
      const count = data?.length ?? batch.length
      inserted += count
      console.log(`✅ Batch ${i / BATCH + 1}/${Math.ceil(GAMES.length / BATCH)}: ${count} upserted`)
    }
  }

  console.log(`\n📊 Resultado:`)
  console.log(`   ✅ Upserted: ${inserted}`)
  if (errors) console.log(`   ❌ Erros: ${errors}`)
  console.log(`\n💡 Próximo passo: rodar o populate-gamedle-audio.mjs para buscar URLs de áudio no Deezer.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
