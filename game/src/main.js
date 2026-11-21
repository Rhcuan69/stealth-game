// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level complete, game over and victory.
//
// ?seed=N fixes the floor speckles. ?shot=start|play|alert|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_EXIT, EVENT_SHARD, EVENT_SPOTTED, EVENT_SUSPICIOUS } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_LEVEL,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, world.state(), scene.screen, scene.best, scene.bonus);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let levelBonus = null;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    levelBonus = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Sneak past the wardens, steal every moon shard, and leave by the green door.');
  }

  function nextLevel() {
    const state = world.state();
    if (state.levelIndex + 1 < state.levelsTotal) {
      world.loadLevel(state.levelIndex + 1);
      levelBonus = null;
      screen = SCREEN_PLAY;
      announce(`Room ${state.levelIndex + 2}: ${state.levelName}.`);
    } else {
      screen = SCREEN_VICTORY;
      audio.victory();
      if (world.state().score > best) {
        best = world.state().score;
        saveBest(best);
      }
      announce(`Victory. Final score ${world.state().score}.`);
    }
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.caught();
    if (world.state().score > best) {
      best = world.state().score;
      saveBest(best);
    }
    announce(`Caught. Game over. Score ${world.state().score}. Best ${best}.`);
  }

  function handleEvents(out) {
    if (out.events & EVENT_SHARD) audio.shard();
    if (out.events & EVENT_SUSPICIOUS) audio.suspicious();
    if (out.events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Run for cover and break line of sight.');
    }
    if (out.events & EVENT_EXIT) {
      audio.exit();
      levelBonus = out.levelBonus;
      screen = SCREEN_LEVEL;
      announce(`Room cleared. Score ${world.state().score}.`);
    }
    if (out.footstep) audio.footstep(false);
    if (out.events & EVENT_CAUGHT) {
      audio.caught();
      const state = world.state();
      if (state.lives <= 0) {
        endGame();
      } else {
        announce(`Caught! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left. The room resets.`);
        world.loadLevel(state.levelIndex);
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) startGame();
      else if (screen === SCREEN_LEVEL) nextLevel();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      const state = world.state();
      world.loadLevel(state.levelIndex);
      screen = SCREEN_PLAY;
      announce('Room restarted.');
    }
    const click = input.takeClick();
    if (click) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
        startGame();
      } else if (screen === SCREEN_LEVEL) {
        nextLevel();
      } else if (screen === SCREEN_PLAY) {
        const point = renderer.toWorld(click.x, click.y);
        if (world.throwPebble(point.x, point.y)) {
          audio.pebble();
          announce('Pebble thrown. A warden heard it.');
        }
      }
    }
  }

  function step() {
    const out = world.step(STEP, input.direction(), input.sneaking(), false);
    world.tickPebble(STEP);
    handleEvents(out);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0 }, false, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, world.state(), screen, best, levelBonus);
  }

  // Leaving the tab pauses a running game rather than letting wardens wander unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Vault. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
