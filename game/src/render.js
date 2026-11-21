// All canvas drawing: the tiled floor, walls and crates, vision cones clipped by
// cover, a darkness layer with pools of light, the player, wardens and cameras,
// the HUD, and the title / pause / level-complete / game-over / victory screens.

import { COLS, FIELD, FONT, GUARD, PALETTE, ROWS, TILE } from './config.js';
import { createRandom } from './random.js';
import { isSolid } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const CONE_RAYS = 26;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const darkness = document.createElement('canvas');
  darkness.width = FIELD.width;
  darkness.height = FIELD.height;
  const darkContext = darkness.getContext('2d');
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = FIELD.width;
  floorCanvas.height = FIELD.height;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let floorLevelIndex = -1;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  /** Convert a click in CSS pixels to playfield coordinates. */
  function toWorld(cssX, cssY) {
    return { x: (cssX - offsetX) / scale, y: (cssY - offsetY) / scale };
  }

  function paintFloor(state, random) {
    if (floorLevelIndex === state.levelIndex) return;
    floorLevelIndex = state.levelIndex;
    const floor = floorCanvas.getContext('2d');
    floor.fillStyle = PALETTE.floorA;
    floor.fillRect(0, 0, FIELD.width, FIELD.height);
    const speckles = createRandom((state.seed ?? 1000) + state.levelIndex * 77);
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if ((row + col) % 2 === 0) {
          floor.fillStyle = PALETTE.floorB;
          floor.fillRect(col * TILE, row * TILE, TILE, TILE);
        }
        if (!isSolid(state.level, col, row)) {
          floor.fillStyle = PALETTE.floorSpeck;
          for (let index = 0; index < 3; index += 1) {
            const x = col * TILE + 4 + speckles() * (TILE - 8);
            const y = row * TILE + 4 + speckles() * (TILE - 8);
            floor.fillRect(x, y, 2, 2);
          }
        }
      }
    }
  }

  function drawWallsAndCrates(state) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const cell = state.level.map[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (cell === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 5);
          context.fillStyle = PALETTE.wallDark;
          context.fillRect(x, y + TILE - 4, TILE, 4);
        } else if (cell === 'C') {
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.strokeStyle = PALETTE.crateEdge;
          context.lineWidth = 2;
          context.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.beginPath();
          context.moveTo(x + 3, y + 3);
          context.lineTo(x + TILE - 3, y + TILE - 3);
          context.moveTo(x + TILE - 3, y + 3);
          context.lineTo(x + 3, y + TILE - 3);
          context.stroke();
          context.fillStyle = PALETTE.crateDark;
          context.fillRect(x + 3, y + TILE - 8, TILE - 6, 5);
        }
      }
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.exitOpen;
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 280);
    context.save();
    context.translate(exit.x, exit.y);
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.globalAlpha = 0.25 + 0.3 * pulse;
    context.beginPath();
    context.arc(0, 0, 34, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = '#0c2b16';
    context.fillRect(-16, -18, 32, 36);
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.fillRect(-13, -15, 26, 30);
    context.fillStyle = '#0c2b16';
    context.font = `bold 20px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(open ? '>' : 'x', 0, 1);
    context.restore();
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitLocked;
    context.font = `bold 13px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(open ? 'EXIT — GO!' : 'EXIT (LOCKED)', exit.x, exit.y - 30);
  }

  function drawShards(state) {
    for (const shard of state.level.shards) {
      if (shard.taken) continue;
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300 + shard.pulse);
      context.save();
      context.translate(shard.x, shard.y);
      context.globalAlpha = 0.25 * pulse;
      context.fillStyle = PALETTE.shard;
      context.beginPath();
      context.arc(0, 0, 22, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
      context.rotate(Math.PI / 4 + Math.sin(performance.now() / 500 + shard.pulse) * 0.15);
      context.fillStyle = PALETTE.shard;
      context.fillRect(-8, -8, 16, 16);
      context.fillStyle = '#ffffff';
      context.fillRect(-4, -4, 8, 8);
      context.restore();
    }
  }

  function coneColor(guard) {
    if (guard.state === 'chase') return PALETTE.guardChase;
    if (guard.state === 'suspicious') return PALETTE.guardSuspicious;
    return PALETTE.guardCalm;
  }

  function drawCone(world, x, y, angle, range, halfAngle, color, alpha) {
    const points = world.conePolygon(x, y, angle, range, halfAngle);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
    context.closePath();
    context.fillStyle = color;
    context.globalAlpha = alpha;
    context.fill();
    context.globalAlpha = alpha + 0.12;
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawCones(world, state) {
    for (const guard of state.guards) {
      const color = coneColor(guard);
      drawCone(world, guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, color, guard.state === 'chase' ? 0.3 : 0.2);
      if (guard.meter > 0.02) {
        context.fillStyle = '#0a0a0a';
        context.fillRect(guard.x - 16, guard.y - 34, 32, 6);
        context.fillStyle = color;
        context.fillRect(guard.x - 15, guard.y - 33, 30 * Math.min(1, guard.meter), 4);
      }
    }
    for (const camera of state.cameras) {
      drawCone(world, camera.x, camera.y, camera.angle, 210, 0.5, '#ff5e7a', 0.18);
    }
  }

  function drawDarkness(state) {
    darkContext.clearRect(0, 0, FIELD.width, FIELD.height);
    darkContext.fillStyle = 'rgba(3, 5, 14, 0.5)';
    darkContext.fillRect(0, 0, FIELD.width, FIELD.height);
    darkContext.globalCompositeOperation = 'destination-out';
    lightHole(state.player.x, state.player.y, 210, 0.85);
    lightHole(state.level.exit.x, state.level.exit.y, 110, 0.7);
    for (const shard of state.level.shards) {
      if (!shard.taken) lightHole(shard.x, shard.y, 55, 0.6);
    }
    for (const guard of state.guards) lightHole(guard.x, guard.y, 80, 0.45);
    darkContext.globalCompositeOperation = 'source-over';
    context.drawImage(darkness, 0, 0);
  }

  function lightHole(x, y, radius, strength) {
    const gradient = darkContext.createRadialGradient(x, y, 8, x, y, radius);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    darkContext.fillStyle = gradient;
    darkContext.beginPath();
    darkContext.arc(x, y, radius, 0, Math.PI * 2);
    darkContext.fill();
  }

  function drawPlayer(state) {
    const player = state.player;
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(0, 9, 13, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, -2, 10, 0, Math.PI * 2);
    context.fill();
    // Hood point and facing eyes.
    context.rotate(player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(10, 0);
    context.lineTo(2, -7);
    context.lineTo(2, 7);
    context.closePath();
    context.fill();
    context.fillStyle = '#06231a';
    context.beginPath();
    context.arc(6, -3.5, 1.8, 0, Math.PI * 2);
    context.arc(6, 3.5, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (player.sneaking) {
      context.fillStyle = PALETTE.muted;
      context.font = `11px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('sneaking', player.x, player.y - 22);
    }
  }

  function drawGuard(guard) {
    context.save();
    context.translate(guard.x, guard.y);
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(0, 10, 14, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.guardDark;
    context.beginPath();
    context.arc(0, 0, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.guard;
    context.beginPath();
    context.arc(0, -1, 11, 0, Math.PI * 2);
    context.fill();
    context.rotate(guard.angle);
    context.fillStyle = '#2b0d0b';
    context.beginPath();
    context.moveTo(12, 0);
    context.lineTo(3, -6);
    context.lineTo(3, 6);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffd75e';
    context.beginPath();
    context.arc(6, -3.5, 1.8, 0, Math.PI * 2);
    context.arc(6, 3.5, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (guard.state === 'chase') {
      context.fillStyle = PALETTE.guardChase;
      context.font = `bold 22px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('!', guard.x, guard.y - 26);
    } else if (guard.state === 'suspicious') {
      context.fillStyle = PALETTE.guardSuspicious;
      context.font = `bold 20px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('?', guard.x, guard.y - 26);
    }
  }

  function drawCamera(camera) {
    context.save();
    context.translate(camera.x, camera.y);
    context.fillStyle = '#3a3f4d';
    context.fillRect(-10, -8, 20, 16);
    context.rotate(camera.angle);
    context.fillStyle = '#ff5e7a';
    context.beginPath();
    context.moveTo(10, 0);
    context.lineTo(-2, -6);
    context.lineTo(-2, 6);
    context.closePath();
    context.fill();
    context.restore();
    if (camera.meter > 0.02) {
      context.fillStyle = '#0a0a0a';
      context.fillRect(camera.x - 14, camera.y - 26, 28, 5);
      context.fillStyle = '#ff5e7a';
      context.fillRect(camera.x - 13, camera.y - 25, 26 * Math.min(1, camera.meter), 3);
    }
  }

  function drawPebble(state) {
    const pebble = state.pebblePoint;
    if (!pebble) return;
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(pebble.x, pebble.y, 10 + Math.sin(performance.now() / 90) * 3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(pebble.x, pebble.y, 3, 0, Math.PI * 2);
    context.fill();
  }

  function alertWord(state) {
    if (state.guards.some((guard) => guard.state === 'chase')) return { text: 'ALERTED', color: PALETTE.guardChase };
    if (state.guards.some((guard) => guard.state === 'suspicious')) return { text: 'SUSPICIOUS', color: PALETTE.guardSuspicious };
    if (state.cameras.some((camera) => camera.meter > 0.6)) return { text: 'CAMERA WATCHING', color: '#ff5e7a' };
    return { text: 'UNSEEN', color: PALETTE.exit };
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function drawHud(state, best) {
    const alert = alertWord(state);
    context.fillStyle = 'rgba(5, 7, 14, 0.82)';
    context.fillRect(0, 0, FIELD.width, 44);
    context.fillStyle = PALETTE.text;
    context.font = `bold 17px ${FONT}`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(`${state.levelIndex + 1}. ${state.levelName}`, 16, 23);
    context.font = `15px ${FONT}`;
    context.fillText(`Shards ${state.shardsTaken}/${state.shardsTotal}`, 330, 23);
    context.fillText(`Score ${state.score}`, 470, 23);
    context.fillText(`Time ${formatTime(state.levelTime)}`, 610, 23);
    context.fillText(`Pebbles ${state.pebbles}`, 740, 23);
    context.fillStyle = alert.color;
    context.font = `bold 17px ${FONT}`;
    context.fillText(alert.text, 880, 23);
    context.fillStyle = PALETTE.gold;
    context.textAlign = 'right';
    context.fillText(`Lives ${'◆'.repeat(Math.max(0, state.lives))}${'◇'.repeat(Math.max(0, 3 - state.lives))}`, FIELD.width - 16, 23);
    context.textAlign = 'left';
    context.fillStyle = PALETTE.muted;
    context.font = `13px ${FONT}`;
    context.fillText('WASD / arrows move · Shift sneak · click throws a pebble · P pause · R restart · M mute', 16, FIELD.height - 12);
    if (best > 0) {
      context.fillStyle = PALETTE.muted;
      context.textAlign = 'right';
      context.fillText(`Best ${best}`, FIELD.width - 16, FIELD.height - 12);
    }
    if (state.banner) {
      context.save();
      context.globalAlpha = Math.min(1, state.bannerTimer * 2);
      context.fillStyle = state.banner.includes('SPOTTED') ? PALETTE.guardChase : PALETTE.banner;
      context.font = `bold 34px ${FONT}`;
      context.textAlign = 'center';
      context.strokeStyle = 'rgba(0,0,0,0.8)';
      context.lineWidth = 6;
      context.strokeText(state.banner, FIELD.width / 2, 110);
      context.fillText(state.banner, FIELD.width / 2, 110);
      context.restore();
    }
    if (state.caughtFlash > 0) {
      context.fillStyle = `rgba(255, 40, 30, ${Math.min(0.35, state.caughtFlash * 0.4)})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function dimPanel() {
    context.fillStyle = 'rgba(4, 6, 12, 0.78)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function centreText(lines, y) {
    let cursor = y;
    for (const line of lines) {
      context.font = line.font;
      context.fillStyle = line.color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(line.text, FIELD.width / 2, cursor);
      cursor += line.gap;
    }
  }

  function drawTitle(state, best) {
    dimPanel();
    centreText([
      { text: 'SHADOW VAULT', font: `bold 64px ${FONT}`, color: PALETTE.text, gap: 76 },
      { text: 'a quiet little heist in three rooms', font: `italic 20px ${FONT}`, color: PALETTE.gold, gap: 46 },
      { text: 'Sneak past the wardens. Steal every moon shard.', font: `18px ${FONT}`, color: PALETTE.text, gap: 30 },
      { text: 'Slip out the green door — unseen.', font: `18px ${FONT}`, color: PALETTE.text, gap: 44 },
      { text: 'WASD / arrows — move      Shift — sneak      Click — throw a pebble', font: `16px ${FONT}`, color: PALETTE.muted, gap: 28 },
      { text: 'P — pause      R — restart      M — mute', font: `16px ${FONT}`, color: PALETTE.muted, gap: 52 },
      { text: '▶  Press Enter or click to begin', font: `bold 24px ${FONT}`, color: PALETTE.exit, gap: 40 },
      ...(best > 0 ? [{ text: `Best score: ${best}`, font: `16px ${FONT}`, color: PALETTE.muted, gap: 0 }] : []),
    ], 200);
  }

  function drawPaused() {
    dimPanel();
    centreText([
      { text: 'PAUSED', font: `bold 52px ${FONT}`, color: PALETTE.text, gap: 60 },
      { text: 'Press P or Enter to keep sneaking', font: `18px ${FONT}`, color: PALETTE.muted, gap: 0 },
    ], 320);
  }

  function drawLevelComplete(state, bonus) {
    dimPanel();
    const lines = [
      { text: `${state.levelName} — CLEARED`, font: `bold 44px ${FONT}`, color: PALETTE.exit, gap: 58 },
      { text: `Score ${state.score}`, font: `bold 22px ${FONT}`, color: PALETTE.text, gap: 34 },
    ];
    if (bonus) {
      lines.push({ text: `Time bonus +${bonus.timeBonus}   ${bonus.ghost ? 'Ghost bonus +250 — never spotted!' : 'Spotted once — no ghost bonus'}`, font: `17px ${FONT}`, color: PALETTE.gold, gap: 46 });
    }
    lines.push({ text: state.levelIndex + 1 < state.levelsTotal ? '▶  Press Enter for the next room' : '▶  Press Enter to see your haul', font: `bold 22px ${FONT}`, color: PALETTE.exit, gap: 0 });
    centreText(lines, 300);
  }

  function drawGameOver(state) {
    dimPanel();
    centreText([
      { text: 'CAUGHT', font: `bold 56px ${FONT}`, color: PALETTE.guardChase, gap: 62 },
      { text: 'The wardens found you three times. The vault keeps its shards.', font: `18px ${FONT}`, color: PALETTE.text, gap: 40 },
      { text: `Score ${state.score}`, font: `bold 22px ${FONT}`, color: PALETTE.gold, gap: 52 },
      { text: '▶  Press Enter or click to try again', font: `bold 22px ${FONT}`, color: PALETTE.exit, gap: 0 },
    ], 280);
  }

  function drawVictory(state) {
    dimPanel();
    centreText([
      { text: 'THE VAULT IS YOURS', font: `bold 52px ${FONT}`, color: PALETTE.gold, gap: 62 },
      { text: 'Every shard stolen, every warden outwitted, not a sound left behind.', font: `18px ${FONT}`, color: PALETTE.text, gap: 40 },
      { text: `Final score ${state.score}   ·   Time ${formatTime(state.totalTime)}`, font: `bold 22px ${FONT}`, color: PALETTE.text, gap: 52 },
      { text: '▶  Press Enter or click to play again', font: `bold 22px ${FONT}`, color: PALETTE.exit, gap: 0 },
    ], 280);
  }

  function drawWorld(world, state) {
    paintFloor(state);
    context.drawImage(floorCanvas, 0, 0);
    drawWallsAndCrates(state);
    drawExit(state);
    drawShards(state);
    drawDarkness(state);
    drawCones(world, state);
    for (const camera of state.cameras) drawCamera(camera);
    for (const guard of state.guards) drawGuard(guard);
    drawPebble(state);
    drawPlayer(state);
  }

  function draw(world, state, screen, best, bonus) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (screen === SCREEN_TITLE) {
      drawWorld(world, state);
      drawTitle(state, best);
      return;
    }
    drawWorld(world, state);
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_LEVEL) drawLevelComplete(state, bonus);
    else if (screen === SCREEN_OVER) drawGameOver(state);
    else if (screen === SCREEN_VICTORY) drawVictory(state);
  }

  return { draw, toWorld };
}
