// Every tuning number, colour and level map in one place.
// The playfield is a fixed 1280x720 logical area (32x18 tiles of 40px);
// the renderer scales it to the window, so no rule depends on screen size.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 104,
  /** Footstep noise radius while walking; sneaking is nearly silent. */
  noiseWalk: 95,
  noiseSneak: 26,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  chaseSpeed: 152,
  returnSpeed: 96,
  /** How long a guard waits at each patrol waypoint, in seconds. */
  waypointPause: 1.1,
  viewRange: 235,
  /** Half of the vision cone, in radians (64 degree cone). */
  viewHalfAngle: 0.56,
  /** Detection meter 0..1; fills while the player is seen, drains otherwise. */
  detectBase: 1.15,
  detectCloseBonus: 0.9,
  detectDecay: 0.55,
  /** Meter at which the guard gets suspicious and investigates. */
  suspiciousAt: 0.35,
  /** Seconds of lost sight before a chasing guard gives up. */
  giveUpAfter: 2.6,
  /** Seconds a suspicious guard stares at the last seen spot. */
  investigateTime: 2.2,
  catchDistance: 26,
};

export const CAMERA = {
  viewRange: 210,
  viewHalfAngle: 0.5,
  sweepSpeed: 0.55,
  /** Fills in ~1.1 s of exposure: enough to cross a sweeping cone if you time it. */
  detectBase: 0.9,
  detectDecay: 1.2,
};

/** Pebbles the player can throw per level (click) to lure a guard. */
export const PEBBLES_PER_LEVEL = 3;

export const LIVES = 3;

export const SCORE = {
  shard: 100,
  ghostBonus: 250,
  levelTimeBonusMax: 300,
};

export const PALETTE = {
  backdrop: '#07080f',
  floorA: '#20242e',
  floorB: '#1b1f29',
  floorSpeck: '#262b38',
  wall: '#3a4152',
  wallTop: '#565f75',
  wallDark: '#232833',
  crate: '#6b4f2a',
  crateDark: '#4a3419',
  crateEdge: '#8a6a3c',
  player: '#37d0a6',
  playerDark: '#1d7a5e',
  guard: '#e5534b',
  guardDark: '#8f2f29',
  guardCalm: '#ffd75e',
  guardSuspicious: '#ff9a3d',
  guardChase: '#ff3b30',
  shard: '#7fe7ff',
  exit: '#4be37a',
  exitLocked: '#c94b4b',
  text: '#eef1f5',
  muted: '#9aa3b5',
  gold: '#f2c94c',
  banner: '#ffd75e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const BEST_KEY = 'shadow-vault.best';

// ---------------------------------------------------------------------------
// Levels. Map legend:
//   # wall   . floor   C crate (cover: blocks movement and sight)
//   P player start   E exit   S moon shard   G guard spawn (waypoints below)
//   K camera mount (a wall tile the camera hangs on; it watches the floor)
// Each level lists its guards' patrol waypoints in tile coordinates and any
// cameras (tile of the mount, facing angle in radians, sweep in radians).
// Every map row is exactly 32 characters; every patrol leg runs along open
// floor so a warden never walks into a wall it cannot pass.
// ---------------------------------------------------------------------------

export const LEVELS = [
  {
    name: 'The Moonlit Gallery',
    intro: 'Steal every moon shard, then slip out the green door. Stay out of the yellow cones.',
    map: [
      '################################',
      '#P......#........#.............#',
      '#.......#...S....#......C......#',
      '#..CC...#........#.............#',
      '#.......#........#.............#',
      '#.......####..####.....####....#',
      '#..............................#',
      '#..S......C......C........E....#',
      '#..............................#',
      '#.......#........#.............#',
      '#..C....#...S....#......C......#',
      '#.......#........#.............#',
      '#.......#........#.............#',
      '#....####..####.....####.......#',
      '#..............................#',
      '#..CC......C......C........S...#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[3, 6], [28, 6], [28, 8], [3, 8]], startAngle: 0 },
      { waypoints: [[28, 16], [6, 16], [6, 14], [28, 14]], startAngle: Math.PI },
    ],
    cameras: [],
  },
  {
    name: 'The Gilded Vault',
    intro: 'Three wardens now, and the vault is tighter. Crates are your friends.',
    map: [
      '################################',
      '#P.....#.........#.......#.....#',
      '#......#....S....#...C...#..S..#',
      '#..C...#.........#.......#.....#',
      '#......#.........#.......#.....#',
      '#......####...####...#####.....#',
      '#..............................#',
      '#..S.....C....#......C.....E...#',
      '#...........#..................#',
      '#....C......#....S.....#.......#',
      '#...........#.........#...C....#',
      '#..C........#.........#........#',
      '#...........#.........#........#',
      '#....####...####...####........#',
      '#..............................#',
      '#..S......C......C......C..S...#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[3, 6], [28, 6]], startAngle: 0 },
      { waypoints: [[9, 1], [9, 4], [15, 4], [15, 1]], startAngle: Math.PI / 2 },
      { waypoints: [[3, 14], [28, 14], [28, 16], [3, 16]], startAngle: Math.PI },
    ],
    cameras: [],
  },
  {
    name: 'The High Atrium',
    intro: 'Four wardens and two sweep cameras. Patience wins. The green door is the way home.',
    map: [
      '################################',
      '#P.....#.........#.......#.....#',
      '#......#....S....#...C...#..S..#',
      '#..C...#.........#.......#.....#',
      '#......#.........#.......#.....#',
      '#......####...####...#####.....#',
      '#..............................#',
      '#..S.....C....#......C.....E...#',
      '#...........#..................#',
      '#....C......#....S.....#.......#',
      '#...........#.........#...C....#',
      '#..C....S...#.........#........#',
      '#...........#.........#........#',
      '#....####...####...####........#',
      '#..............................#',
      '#..S......C......C......C..S...#',
      '#..............................#',
      '################################',
    ],
    guards: [
      { waypoints: [[3, 6], [28, 6]], startAngle: 0 },
      { waypoints: [[9, 1], [9, 4], [15, 4], [15, 1]], startAngle: Math.PI / 2 },
      { waypoints: [[3, 14], [28, 14], [28, 16], [3, 16]], startAngle: Math.PI },
      { waypoints: [[5, 10], [10, 10], [10, 12], [5, 12]], startAngle: -Math.PI / 2 },
    ],
    cameras: [
      { tile: [16, 0], facing: Math.PI / 2, sweep: 1.1 },
      { tile: [16, 17], facing: -Math.PI / 2, sweep: 1.1 },
    ],
  },
];
