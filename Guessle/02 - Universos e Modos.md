# Universos e Modos

## Mapa Completo

| Universo | Slug | Tipo | Modos |
|----------|------|------|-------|
| LoLdle | lol | character | classic, quote, ability, splash, build, skill-order, quadra |
| Narutodle | naruto | character | classic, jutsu, quote, eye |
| OnePiecedle | onepiece | character | classic, devil-fruit, wanted, laugh |
| Jujutsudle | jujutsu | character | classic, cursed-technique, quote, eyes |
| Pokédle | pokemon | character | classic, silhouette, ability, cry |
| Smashdle | smash | character | classic, silhouette, kirby, final-smash |
| Zeldadle | zelda | character | classic, item, location, music |
| Mariodle | mario | character | classic, game, sound, level |
| GoWdle | gow | character | classic, weapon, voice, quote |
| MHdle | monsterhunter | character | classic, silhouette, roar, weakness |
| Gamedle | gamedle | game | classic, screenshot, cover, soundtrack |
| JSdle | js | code | complete, fix, output |
| TSdle | ts | code | complete, fix, output |
| Pythondle | python | code | complete, fix, output |

**Total:** 14 universos, 44 slugs de modo

---

## Registry — Componentes por Slug

| Slug(s) | Componente |
|---------|-----------|
| classic, devil-fruit, game | ClassicMode |
| silhouette, eyes, location, level | SilhouetteMode |
| quote | QuoteMode |
| splash, screenshot, cover | SplashMode |
| ability, cursed-technique, item, weapon | AbilityMode |
| build | BuildMode |
| skill-order | SkillOrderMode |
| quadra | QuadraMode |
| laugh, voice, cry, music, sound, roar, soundtrack | AudioMode |
| jutsu | JutsuMode |
| eye | EyeMode |
| kirby | KirbyMode |
| final-smash | FinalSmashMode |
| weakness | WeaknessMode |
| complete, fix, output | CodeMode |

---

## Logica de Modos Especiais

| Modo | Max Tentativas | Vidas | Hints |
|------|---------------|-------|-------|
| Code (complete/fix/output) | 3 | — | Nao |
| Quadra | Ilimitado | 4 | Nao |
| Todos os outros | Ilimitado | — | 2 (em 5 e 10 erros) |

---

## Fontes de Dados por Universo

| Universo | Fonte |
|----------|-------|
| Pokemon | PokeAPI |
| LoL | Riot Data Dragon |
| Gamedle | IGDB API (pool fixo de 150) |
| JS/TS/Python | Groq LLM (generate-code-puzzle) |
| Naruto, One Piece, Jujutsu, Smash, Zelda, Mario, GoW, MH | Wiki scraper (refresh-catalog) |
