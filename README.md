# Shadow Vault — a stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Rhcuan69/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Rhcuan69/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An original top-down stealth game for the make.fun bounty
[best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759)
("Make the best stealth game"). You are Wren, a thief stealing glowing moon
shards from guarded rooms and slipping out the exit unseen. All art is drawn
procedurally in code and all sounds are synthesized with WebAudio — no image,
audio, or font files, no libraries, no network requests. It runs offline in a
desktop browser from static files.

## How to play

- **Move** with WASD or the arrow keys. Hold **Shift** to sneak: slower, but
  quieter and half as easy to spot.
- **Click** to throw a pebble (3 per level) and lure a warden away from its
  patrol. Guards patrol waypoints with vision cones clipped by walls and
  crates; their detection meter fills as they see you — suspicious ("?"),
  then chase ("!"). Break line of sight to recover.
- Collect every moon shard to unlock the green exit, then reach it unseen.
  Staying completely unseen earns a ghost bonus (+250); finishing fast earns a
  time bonus.
- **P** or **Esc** pauses, **R** restarts, **M** mutes. Best score is kept in
  localStorage.

## Levels

1. **The Moonlit Gallery** — 2 guards, 4 shards.
2. **The Gilded Vault** — 3 guards, 6 shards.
3. **The High Atrium** — 4 guards, 7 shards, 2 sweeping cameras.

## Run it

Serve the folder and open `game/index.html` in desktop Chrome, e.g.
`node serve.ts` then http://localhost:8080. `main.ts` (Node 22) hands the
game in: it copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json`.
