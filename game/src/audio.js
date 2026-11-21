// Synthesised WebAudio only: no audio files, no network. Soft footsteps, a
// rising "someone sees you" ping, an alert sting, shard chimes, a quiet bass
// line that keeps the heist moving, and a mute toggle. Audio starts on the
// first gesture, as browsers require.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A slow A-minor lope: bass notes with a sparse pluck on top.
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 82.41, 0, 73.42, 0];
  const PLUCK = [220, 0, 0, 261.63, 0, 0, 329.63, 0, 0, 0, 392, 0, 329.63, 0, 261.63, 0];

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, duration, type, gain, slideTo, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noiseBurst(duration, gain, lowFreq) {
    if (!context || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowFreq;
    const envelope = context.createGain();
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function startMusic() {
    if (!context || musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      const bass = BASS[musicStep % BASS.length];
      const pluck = PLUCK[musicStep % PLUCK.length];
      if (bass > 0) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = bass;
        const start = context.currentTime;
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        oscillator.connect(envelope);
        envelope.connect(musicGain);
        oscillator.start(start);
        oscillator.stop(start + 0.5);
      }
      if (pluck > 0) tone(pluck, 0.5, 'sine', 0.1);
      musicStep += 1;
    }, 240);
  }

  return {
    unlock,
    startMusic,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
      return muted;
    },
    get muted() {
      return muted;
    },
    footstep(sneak) {
      noiseBurst(0.07, sneak ? 0.05 : 0.16, sneak ? 500 : 900);
    },
    suspicious() {
      tone(660, 0.16, 'sine', 0.16, 880);
    },
    spotted() {
      tone(392, 0.14, 'square', 0.14);
      tone(523.25, 0.14, 'square', 0.14, null, 0.12);
      tone(659.25, 0.3, 'square', 0.16, null, 0.24);
    },
    shard() {
      tone(880, 0.12, 'sine', 0.18);
      tone(1318.5, 0.22, 'sine', 0.16, null, 0.07);
    },
    pebble() {
      noiseBurst(0.05, 0.2, 1400);
      tone(1200, 0.08, 'sine', 0.1, 700);
    },
    exit() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => tone(freq, 0.28, 'triangle', 0.2, null, index * 0.09));
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.16, 55);
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, index) => tone(freq, 0.4, 'triangle', 0.18, null, index * 0.11));
    },
  };
}
