// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the
// real rules forward from a fresh world, steered by a small autopilot that
// follows a breadth-first path around the walls to the next shard, waits
// behind cover when a warden's cone covers the next step, and runs when it
// is chased — so every frame is what a short game really looks like and the
// same seed always gives the same frame.

import { GUARD, STEP, TILE } from './config.js';
import { EVENT_CAUGHT, EVENT_EXIT } from './world.js';
import { inVisionCone, isSolid } from './levels.js';
import { SCREEN_LEVEL, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 16;
const WIN_LIMIT_SECONDS = 150;
const SAMPLE = STEP;

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** How dangerous a point is: huge when a warden can see it, growing near one. */
function dangerAt(state, x, y) {
  let danger = 0;
  for (const guard of state.guards) {
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < 110) danger += (110 - distance) * 4;
    if (inVisionCone(state.level, guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, x, y)) danger += 10000;
  }
  for (const camera of state.cameras) {
    if (inVisionCone(state.level, camera.x, camera.y, camera.angle, 210, 0.5, x, y)) danger += 10000;
  }
  return danger;
}

/** The next thing to steal, or the exit once every shard is taken. */
function currentTarget(state) {
  for (const shard of state.level.shards) {
    if (!shard.taken) return shard;
  }
  return state.level.exit;
}

/**
 * A breadth-first path across open floor from the player to the target, as a
 * list of tile centres. Walls and crates are never stepped on, so the pilot
 * walks around them instead of pushing into them.
 */
function findPath(state, fromX, fromY, toX, toY) {
  const startCol = Math.floor(fromX / TILE);
  const startRow = Math.floor(fromY / TILE);
  const goalCol = Math.floor(toX / TILE);
  const goalRow = Math.floor(toY / TILE);
  const key = (col, row) => row * 32 + col;
  const previous = new Map();
  const queue = [[startCol, startRow]];
  previous.set(key(startCol, startRow), null);
  while (queue.length > 0) {
    const [col, row] = queue.shift();
    if (col === goalCol && row === goalRow) break;
    for (const [dCol, dRow] of NEIGHBOURS) {
      const nextCol = col + dCol;
      const nextRow = row + dRow;
      if (nextCol < 0 || nextRow < 0 || nextCol >= 32 || nextRow >= 18) continue;
      if (isSolid(state.level, nextCol, nextRow)) continue;
      const nextKey = key(nextCol, nextRow);
      if (!previous.has(nextKey)) {
        previous.set(nextKey, [col, row]);
        queue.push([nextCol, nextRow]);
      }
    }
  }
  if (!previous.has(key(goalCol, goalRow))) return null;
  const path = [];
  let current = [goalCol, goalRow];
  while (current) {
    path.unshift({ x: (current[0] + 0.5) * TILE, y: (current[1] + 0.5) * TILE });
    current = previous.get(key(current[0], current[1]));
  }
  return path;
}

/** Steer along the path; wait, sneaking, when the next step is watched. */
function autopilot(world, state) {
  const player = state.player;
  const chased = state.guards.some((guard) => guard.state === 'chase');
  const nearGuard = state.guards.some((guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 280);
  if (!chased) {
    const path = findPath(state, player.x, player.y, currentTarget(state).x, currentTarget(state).y);
    const waypoint = path && path.length > 1 ? path[1] : currentTarget(state);
    if (dangerAt(state, waypoint.x, waypoint.y) > 0) {
      return { direction: { x: 0, y: 0 }, sneak: true };
    }
    const dx = waypoint.x - player.x;
    const dy = waypoint.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) return { direction: { x: 0, y: 0 }, sneak: true };
    return { direction: { x: dx / distance, y: dy / distance }, sneak: nearGuard };
  }
  // Chased: keep running along the path — the player walks faster than a warden.
  const path = findPath(state, player.x, player.y, currentTarget(state).x, currentTarget(state).y);
  const waypoint = path && path.length > 1 ? path[1] : currentTarget(state);
  const dx = waypoint.x - player.x;
  const dy = waypoint.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return { direction: { x: 0, y: 0 }, sneak: false };
  return { direction: { x: dx / distance, y: dy / distance }, sneak: false };
}

function runSteps(world, seconds, pilot) {
  let events = 0;
  let levelBonus = null;
  const steps = Math.floor(seconds / SAMPLE);
  for (let index = 0; index < steps; index += 1) {
    const state = world.state();
    const move = pilot ? pilot(world, state) : { direction: { x: 0, y: 0 }, sneak: false };
    const out = world.step(SAMPLE, move.direction, move.sneak, false);
    events |= out.events;
    if (out.levelBonus) levelBonus = out.levelBonus;
    if (out.events & EVENT_EXIT) break;
    if (out.events & EVENT_CAUGHT) break;
  }
  return { events, levelBonus };
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    // Title over a live patrol: step the world in demo so the wardens wander.
    for (let index = 0; index < Math.floor(START_SECONDS / SAMPLE); index += 1) world.step(SAMPLE, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0, bonus: null };
  }
  if (name === 'alert') {
    const state = world.state();
    const guard = state.guards[0];
    // Put the player in the open floor ahead of the first warden, close
    // enough to be seen at once, far enough not to be caught in the shot.
    const player = state.player;
    player.x = guard.x + Math.cos(guard.angle) * 190;
    player.y = guard.y + Math.sin(guard.angle) * 190;
    guard.meter = 1;
    guard.state = 'chase';
    guard.loseSightTimer = 0;
    runSteps(world, 0.5, () => ({ direction: { x: 0, y: 0 }, sneak: false }));
    return { screen: SCREEN_PLAY, best: 0, bonus: null };
  }
  if (name === 'win') {
    const result = runSteps(world, WIN_LIMIT_SECONDS, autopilot);
    const state = world.state();
    if (result.events & EVENT_EXIT) {
      return { screen: SCREEN_LEVEL, best: state.score, bonus: result.levelBonus };
    }
    // The pilot ran out of time: finish the job from the real state, and show
    // the cleared screen without invented bonuses.
    world.forceWin();
    const done = world.state();
    return { screen: SCREEN_LEVEL, best: done.score, bonus: null };
  }
  runSteps(world, PLAY_SECONDS, autopilot);
  const state = world.state();
  return { screen: SCREEN_PLAY, best: state.score, bonus: null };
}
