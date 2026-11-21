// The simulation: one player, patrolling wardens with vision cones, sweep
// cameras, moon shards to steal, and a green exit that opens once every shard
// is taken. Guards go calm -> suspicious -> chase -> investigate -> patrol,
// and a thrown pebble lures the nearest warden to the noise.

import {
  CAMERA,
  FIELD,
  GUARD,
  LEVELS,
  LIVES,
  PEBBLES_PER_LEVEL,
  PLAYER,
  SCORE,
  STEP,
} from './config.js';
import { angleDifference, castSightRay, hasLineOfSight, inVisionCone, isSolid, parseLevel, pointIsSolid } from './levels.js';

export const EVENT_CAUGHT = 1;
export const EVENT_SHARD = 2;
export const EVENT_EXIT = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_SUSPICIOUS = 16;
export const EVENT_PEBBLE = 32;

const GUARD_STATES = { PATROL: 'patrol', SUSPICIOUS: 'suspicious', CHASE: 'chase', RETURN: 'return' };

function makeGuard(definition) {
  const start = definition.waypoints[0];
  return {
    x: start.x,
    y: start.y,
    angle: definition.startAngle,
    waypoints: definition.waypoints,
    waypointIndex: 1 % definition.waypoints.length,
    state: GUARD_STATES.PATROL,
    meter: 0,
    pauseTimer: 0,
    loseSightTimer: 0,
    investigateTimer: 0,
    lastSeen: null,
    target: null,
    speed: 0,
  };
}

function makeCamera(definition) {
  return {
    x: definition.x,
    y: definition.y,
    facing: definition.facing,
    sweep: definition.sweep,
    angle: definition.facing,
    sweepPhase: 0,
    meter: 0,
  };
}

export function createWorld(seed) {
  let levelIndex = 0;
  let level = null;
  let player = null;
  let guards = [];
  let cameras = [];
  let exitOpen = false;
  let shardsTaken = 0;
  let shardsTotal = 0;
  let pebbles = PEBBLES_PER_LEVEL;
  let pebblePoint = null;
  let levelTime = 0;
  let totalTime = 0;
  let score = 0;
  let scoreAtLevelStart = 0;
  let lives = LIVES;
  let spottedThisLevel = false;
  let caughtFlash = 0;
  let banner = null;
  let bannerTimer = 0;

  function loadLevel(index) {
    levelIndex = index;
    level = parseLevel(LEVELS[index]);
    player = {
      x: level.playerStart.x,
      y: level.playerStart.y,
      angle: 0,
      moving: false,
      sneaking: false,
      stepTimer: 0,
    };
    guards = level.guards.map(makeGuard);
    cameras = level.cameras.map(makeCamera);
    exitOpen = false;
    shardsTaken = 0;
    shardsTotal = level.shards.length;
    pebbles = PEBBLES_PER_LEVEL;
    pebblePoint = null;
    levelTime = 0;
    scoreAtLevelStart = score;
    spottedThisLevel = false;
    banner = null;
    bannerTimer = 0;
  }

  function reset() {
    score = 0;
    totalTime = 0;
    lives = LIVES;
    loadLevel(0);
  }

  function showBanner(text, seconds) {
    banner = text;
    bannerTimer = seconds;
  }

  /** Move a circle against the solid grid, sliding along walls. */
  function moveCircle(body, dx, dy, radius) {
    const nextX = body.x + dx;
    if (!circleHitsSolid(nextX, body.y, radius)) body.x = nextX;
    const nextY = body.y + dy;
    if (!circleHitsSolid(body.x, nextY, radius)) body.y = nextY;
  }

  function circleHitsSolid(x, y, radius) {
    const minCol = Math.floor((x - radius) / 40);
    const maxCol = Math.floor((x + radius) / 40);
    const minRow = Math.floor((y - radius) / 40);
    const maxRow = Math.floor((y + radius) / 40);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        if (!isSolid(level, col, row)) continue;
        const nearestX = Math.max(col * 40, Math.min(x, col * 40 + 40));
        const nearestY = Math.max(row * 40, Math.min(y, row * 40 + 40));
        if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < radius * radius) return true;
      }
    }
    return false;
  }

  function playerSeenBy(guard) {
    return inVisionCone(level, guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, player.x, player.y);
  }

  function playerSeenByCamera(camera) {
    return inVisionCone(level, camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, player.x, player.y);
  }

  function nearestGuardTo(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (const guard of guards) {
      const distance = Math.hypot(guard.x - x, guard.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = guard;
      }
    }
    return best;
  }

  function guardHearsFootsteps(guard) {
    if (!player.moving || player.sneaking) return false;
    return Math.hypot(guard.x - player.x, guard.y - player.y) < PLAYER.noiseWalk;
  }

  function stepGuard(guard, dt, events) {
    const distanceToPlayer = Math.hypot(player.x - guard.x, player.y - guard.y);
    const seen = playerSeenBy(guard);
    const heard = guardHearsFootsteps(guard);

    if (seen) {
      const closeness = 1 - distanceToPlayer / GUARD.viewRange;
      let rate = GUARD.detectBase + closeness * GUARD.detectCloseBonus;
      if (player.sneaking) rate *= 0.45;
      const before = guard.meter;
      guard.meter = Math.min(1, guard.meter + rate * dt);
      if (before < GUARD.suspiciousAt && guard.meter >= GUARD.suspiciousAt && guard.state === GUARD_STATES.PATROL) {
        guard.state = GUARD_STATES.SUSPICIOUS;
        guard.lastSeen = { x: player.x, y: player.y };
        guard.investigateTimer = GUARD.investigateTime;
        events.events |= EVENT_SUSPICIOUS;
      }
      if (guard.meter >= 1 && guard.state !== GUARD_STATES.CHASE) {
        guard.state = GUARD_STATES.CHASE;
        guard.loseSightTimer = 0;
        spottedThisLevel = true;
        events.events |= EVENT_SPOTTED;
        showBanner('SPOTTED!', 1.4);
      }
      if (guard.state === GUARD_STATES.CHASE) guard.loseSightTimer = 0;
    } else {
      guard.meter = Math.max(0, guard.meter - GUARD.detectDecay * dt);
      if (heard && guard.state === GUARD_STATES.PATROL) {
        guard.meter = Math.min(GUARD.suspiciousAt, guard.meter + 0.25 * dt);
        if (guard.meter >= GUARD.suspiciousAt) {
          guard.state = GUARD_STATES.SUSPICIOUS;
          guard.lastSeen = { x: player.x, y: player.y };
          guard.investigateTimer = GUARD.investigateTime;
          events.events |= EVENT_SUSPICIOUS;
        }
      }
      if (guard.state === GUARD_STATES.CHASE) {
        guard.loseSightTimer += dt;
        if (guard.loseSightTimer >= GUARD.giveUpAfter) {
          guard.state = GUARD_STATES.SUSPICIOUS;
          guard.lastSeen = { x: player.x, y: player.y };
          guard.investigateTimer = GUARD.investigateTime;
        }
      }
    }

    if (pebblePoint && guard.state === GUARD_STATES.PATROL) {
      const distance = Math.hypot(guard.x - pebblePoint.x, guard.y - pebblePoint.y);
      if (distance < 420) {
        guard.state = GUARD_STATES.SUSPICIOUS;
        guard.lastSeen = { x: pebblePoint.x, y: pebblePoint.y };
        guard.investigateTimer = GUARD.investigateTime;
        guard.meter = Math.max(guard.meter, GUARD.suspiciousAt);
      }
    }

    // Movement by state.
    if (guard.state === GUARD_STATES.PATROL) {
      const target = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else {
        moveGuardToward(guard, target, GUARD.patrolSpeed, dt);
        if (Math.hypot(target.x - guard.x, target.y - guard.y) < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = GUARD.waypointPause;
        }
      }
    } else if (guard.state === GUARD_STATES.CHASE) {
      moveGuardToward(guard, player, GUARD.chaseSpeed, dt);
      if (distanceToPlayer < GUARD.catchDistance) {
        events.events |= EVENT_CAUGHT;
      }
    } else if (guard.state === GUARD_STATES.SUSPICIOUS) {
      if (guard.lastSeen) {
        const arrived = moveGuardToward(guard, guard.lastSeen, GUARD.patrolSpeed * 1.4, dt);
        if (arrived) {
          guard.investigateTimer -= dt;
          guard.angle += Math.sin(totalTime * 2.4) * dt * 1.6;
          if (guard.investigateTimer <= 0) {
            guard.state = GUARD_STATES.RETURN;
            guard.meter = 0;
          }
        }
      }
    } else if (guard.state === GUARD_STATES.RETURN) {
      const nearest = nearestWaypoint(guard);
      const arrived = moveGuardToward(guard, nearest, GUARD.returnSpeed, dt);
      if (arrived) {
        guard.waypointIndex = guard.waypoints.indexOf(nearest);
        guard.state = GUARD_STATES.PATROL;
      }
    }
  }

  function nearestWaypoint(guard) {
    let best = guard.waypoints[0];
    let bestDistance = Infinity;
    for (const waypoint of guard.waypoints) {
      const distance = Math.hypot(waypoint.x - guard.x, waypoint.y - guard.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = waypoint;
      }
    }
    return best;
  }

  /** Step a guard toward a point; returns true when it arrives. */
  function moveGuardToward(guard, target, speed, dt) {
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) return true;
    const stepDistance = Math.min(distance, speed * dt);
    const nx = guard.x + (dx / distance) * stepDistance;
    const ny = guard.y + (dy / distance) * stepDistance;
    const wanted = Math.atan2(dy, dx);
    guard.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, angleDifference(guard.angle, wanted)));
    if (!circleHitsSolid(nx, guard.y, GUARD.radius)) guard.x = nx;
    if (!circleHitsSolid(guard.x, ny, GUARD.radius)) guard.y = ny;
    return Math.hypot(target.x - guard.x, target.y - guard.y) < 6;
  }

  function stepCamera(camera, dt, events) {
    camera.sweepPhase += CAMERA.sweepSpeed * dt;
    camera.angle = camera.facing + Math.sin(camera.sweepPhase) * camera.sweep;
    const seen = playerSeenByCamera(camera);
    if (seen) {
      const before = camera.meter;
      camera.meter = Math.min(1, camera.meter + CAMERA.detectBase * dt);
      if (camera.meter >= 1 && before < 1) {
        const guard = nearestGuardTo(player.x, player.y);
        if (guard) {
          guard.state = GUARD_STATES.CHASE;
          guard.loseSightTimer = 0;
          spottedThisLevel = true;
          events.events |= EVENT_SPOTTED;
          showBanner('CAMERA SPOTTED YOU!', 1.4);
        }
      }
    } else {
      camera.meter = Math.max(0, camera.meter - CAMERA.detectDecay * dt);
    }
  }

  function stepPlayer(direction, sneaking, dt, events) {
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    player.sneaking = sneaking;
    player.moving = direction.x !== 0 || direction.y !== 0;
    if (player.moving) {
      player.angle = Math.atan2(direction.y, direction.x);
      moveCircle(player, direction.x * speed * dt, direction.y * speed * dt, PLAYER.radius);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = sneaking ? 0.42 : 0.3;
        events.footstep = !sneaking;
      }
    }
    // Shards.
    for (const shard of level.shards) {
      if (!shard.taken && Math.hypot(shard.x - player.x, shard.y - player.y) < 26) {
        shard.taken = true;
        shardsTaken += 1;
        score += SCORE.shard;
        events.events |= EVENT_SHARD;
        if (shardsTaken === shardsTotal) {
          exitOpen = true;
          showBanner('EXIT OPEN — GO!', 1.6);
        }
      }
    }
    // Exit.
    if (Math.hypot(level.exit.x - player.x, level.exit.y - player.y) < 30) {
      if (exitOpen) {
        const timeBonus = Math.max(0, SCORE.levelTimeBonusMax - Math.floor(levelTime) * 5);
        const ghost = spottedThisLevel ? 0 : SCORE.ghostBonus;
        score += timeBonus + ghost;
        events.events |= EVENT_EXIT;
        events.levelBonus = { timeBonus, ghost };
      } else {
        showBanner('LOCKED — STEAL EVERY SHARD FIRST', 1.2);
      }
    }
  }

  /**
   * Advance the world one fixed step. `direction` is the player's move input,
   * `sneaking` whether Shift is held. Returns a bitmask of events; the `out`
   * object also carries `footstep` and `levelBonus` when set.
   */
  function step(dt, direction, sneaking, demo) {
    const out = { events: 0, footstep: false, levelBonus: null };
    levelTime += dt;
    totalTime += dt;
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) banner = null;
    }
    if (caughtFlash > 0) caughtFlash -= dt;
    if (!demo) stepPlayer(direction, sneaking, dt, out);
    for (const guard of guards) stepGuard(guard, dt, out);
    for (const camera of cameras) stepCamera(camera, dt, out);
    if (out.events & EVENT_CAUGHT) {
      caughtFlash = 0.9;
      lives -= 1;
      score = scoreAtLevelStart;
    }
    return out;
  }

  function throwPebble(worldX, worldY) {
    if (pebbles <= 0) return false;
    if (worldX < 0 || worldY < 0 || worldX > FIELD.width || worldY > FIELD.height) return false;
    if (pointIsSolid(level, worldX, worldY)) return false;
    pebbles -= 1;
    pebblePoint = { x: worldX, y: worldY, timer: 2.5 };
    return true;
  }

  function tickPebble(dt) {
    if (pebblePoint) {
      pebblePoint.timer -= dt;
      if (pebblePoint.timer <= 0) pebblePoint = null;
    }
  }

  function conePolygon(x, y, angle, range, halfAngle) {
    const rays = 26;
    const points = [{ x, y }];
    for (let index = 0; index <= rays; index += 1) {
      const rayAngle = angle - halfAngle + (2 * halfAngle * index) / rays;
      points.push(castSightRay(level, x, y, rayAngle, range));
    }
    return points;
  }

  function forceWin() {
    // Screenshot staging only: finish the room from its real state so the
    // level-complete screen is drawn over a genuinely cleared level.
    for (const shard of level.shards) shard.taken = true;
    shardsTaken = shardsTotal;
    exitOpen = true;
    player.x = level.exit.x;
    player.y = level.exit.y;
  }

  function state() {
    return {
      seed,
      levelIndex,
      level,
      player,
      guards,
      cameras,
      exitOpen,
      shardsTaken,
      shardsTotal,
      pebbles,
      pebblePoint,
      levelTime,
      totalTime,
      score,
      lives,
      spottedThisLevel,
      caughtFlash,
      banner,
      bannerTimer,
      levelName: LEVELS[levelIndex].name,
      levelIntro: LEVELS[levelIndex].intro,
      levelsTotal: LEVELS.length,
    };
  }

  // Boot on the first room so the title screen can already draw it.
  loadLevel(0);

  return {
    reset,
    loadLevel,
    step,
    throwPebble,
    tickPebble,
    forceWin,
    conePolygon,
    hasLineOfSight: (x0, y0, x1, y1) => hasLineOfSight(level, x0, y0, x1, y1),
    state,
  };
}
