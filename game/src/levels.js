// Turns a level's text map into the data the simulation and renderer use:
// a solid-tile grid, the player start, the exit, the moon shards, and the
// guard patrols and camera mounts from the level definition.

import { COLS, ROWS, TILE } from './config.js';

export function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

export function parseLevel(definition) {
  const solid = [];
  const shards = [];
  let playerStart = null;
  let exit = null;
  for (let row = 0; row < ROWS; row += 1) {
    const line = definition.map[row] ?? '';
    solid[row] = [];
    for (let col = 0; col < COLS; col += 1) {
      const cell = line[col] ?? '#';
      solid[row][col] = cell === '#' || cell === 'C';
      if (cell === 'P') playerStart = tileCenter(col, row);
      if (cell === 'E') exit = tileCenter(col, row);
      if (cell === 'S') shards.push({ ...tileCenter(col, row), taken: false, pulse: Math.random() * 6.28 });
    }
  }
  const guards = definition.guards.map((guard) => ({
    waypoints: guard.waypoints.map(([col, row]) => tileCenter(col, row)),
    startAngle: guard.startAngle,
  }));
  const cameras = definition.cameras.map((camera) => ({
    ...tileCenter(camera.tile[0], camera.tile[1]),
    facing: camera.facing,
    sweep: camera.sweep,
  }));
  return { map: definition.map, solid, shards, playerStart, exit, guards, cameras };
}

/** True when the tile at (col, row) blocks movement and sight (outside counts as solid). */
export function isSolid(level, col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
  return level.solid[row][col];
}

/** True when the point (x, y) in pixels sits inside a solid tile. */
export function pointIsSolid(level, x, y) {
  return isSolid(level, Math.floor(x / TILE), Math.floor(y / TILE));
}

/**
 * Line of sight between two points: steps along the line and fails the moment
 * it crosses a solid tile. Crates and walls both block a guard's view.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let index = 1; index < steps; index += 1) {
    const t = index / steps;
    if (pointIsSolid(level, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** Cast a sight ray from (x, y) along `angle` until it hits a solid tile or `range`. */
export function castSightRay(level, x, y, angle, range) {
  const step = 6;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let travelled = 0; travelled < range; travelled += step) {
    px += dx;
    py += dy;
    if (pointIsSolid(level, px, py)) return { x: px - dx, y: py - dy };
  }
  return { x: x + Math.cos(angle) * range, y: y + Math.sin(angle) * range };
}

/** Wrap an angle to (-PI, PI]. */
export function angleDifference(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** True when `target` lies inside a vision cone from (x, y) facing `angle`. */
export function inVisionCone(level, x, y, angle, range, halfAngle, targetX, targetY) {
  const dx = targetX - x;
  const dy = targetY - y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 18) return true;
  const toTarget = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angle, toTarget)) > halfAngle) return false;
  return hasLineOfSight(level, x, y, targetX, targetY);
}
