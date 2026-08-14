/**
 * Procedural ambient sound sources via Web Audio API.
 * Each factory returns { connect(dest), start(), stop(), dispose() }.
 */

function createNoiseBuffer(ctx, type = 'white', seconds = 2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    // brown
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}

function noiseSource(ctx, type) {
  const src = ctx.createBufferSource();
  src.buffer = createNoiseBuffer(ctx, type, 3);
  src.loop = true;
  return src;
}

function makeVoice(ctx, build) {
  const output = ctx.createGain();
  output.gain.value = 1;
  let nodes = [];
  let started = false;

  const api = {
    connect(dest) {
      output.connect(dest);
      return api;
    },
    start(when = 0) {
      if (started) return api;
      started = true;
      nodes = build(ctx, output);
      for (const n of nodes) {
        if (n.start) n.start(when);
      }
      return api;
    },
    stop(when = 0) {
      for (const n of nodes) {
        try {
          if (n.stop) n.stop(when);
        } catch {
          /* already stopped */
        }
      }
      started = false;
      return api;
    },
    dispose() {
      api.stop();
      try {
        output.disconnect();
      } catch {
        /* noop */
      }
    },
  };
  return api;
}

export const SOUND_CATALOG = [
  { id: 'balanced', title: 'Сбалансированный шум', kind: 'pink' },
  { id: 'bright', title: 'Светлый шум', kind: 'white' },
  { id: 'dark', title: 'Темный шум', kind: 'brown' },
  { id: 'ocean', title: 'Океан', kind: 'ocean' },
  { id: 'rain', title: 'Дождь', kind: 'rain' },
  { id: 'stream', title: 'Ручей', kind: 'stream' },
  { id: 'night', title: 'Ночь', kind: 'night' },
  { id: 'fire', title: 'Огонь', kind: 'fire' },
  { id: 'chatter', title: 'Болтовня', kind: 'chatter' },
  { id: 'steam', title: 'Пар', kind: 'steam' },
  { id: 'plane', title: 'Самолет', kind: 'plane' },
  { id: 'boat', title: 'Лодка', kind: 'boat' },
  { id: 'bus', title: 'Автобус', kind: 'bus' },
  { id: 'train', title: 'Поезд', kind: 'train' },
  { id: 'roof', title: 'Дождь на крыше', kind: 'roof' },
  { id: 'quiet', title: 'Тихая ночь', kind: 'quiet' },
];

function buildKind(kind, ctx, output) {
  switch (kind) {
    case 'white':
      return buildNoise(ctx, output, 'white', 8000, 0.35);
    case 'pink':
      return buildNoise(ctx, output, 'pink', 4000, 0.45);
    case 'brown':
      return buildNoise(ctx, output, 'brown', 800, 0.7);
    case 'ocean':
      return buildOcean(ctx, output);
    case 'rain':
      return buildRain(ctx, output, false);
    case 'stream':
      return buildStream(ctx, output);
    case 'night':
      return buildNight(ctx, output, false);
    case 'fire':
      return buildFire(ctx, output);
    case 'chatter':
      return buildChatter(ctx, output);
    case 'steam':
      return buildSteam(ctx, output);
    case 'plane':
      return buildPlane(ctx, output);
    case 'boat':
      return buildBoat(ctx, output);
    case 'bus':
      return buildBus(ctx, output);
    case 'train':
      return buildTrain(ctx, output);
    case 'roof':
      return buildRain(ctx, output, true);
    case 'quiet':
      return buildNight(ctx, output, true);
    default:
      return buildNoise(ctx, output, 'pink', 4000, 0.4);
  }
}

function buildNoise(ctx, output, type, cutoff, gain) {
  const src = noiseSource(ctx, type);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(output);
  return [src];
}

function buildOcean(ctx, output) {
  const src = noiseSource(ctx, 'pink');
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 1.2;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 280;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  const rumble = ctx.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 55;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.08;

  const g = ctx.createGain();
  g.gain.value = 0.55;

  src.connect(filter);
  filter.connect(g);
  rumble.connect(rumbleGain);
  rumbleGain.connect(g);
  g.connect(output);

  return [src, lfo, rumble];
}

function buildRain(ctx, output, onRoof) {
  const src = noiseSource(ctx, 'white');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = onRoof ? 900 : 1400;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = onRoof ? 1800 : 3200;
  bp.Q.value = onRoof ? 0.8 : 0.4;

  if (onRoof) {
    const resonance = ctx.createBiquadFilter();
    resonance.type = 'peaking';
    resonance.frequency.value = 420;
    resonance.Q.value = 2.5;
    resonance.gain.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0.28;
    src.connect(hp);
    hp.connect(bp);
    bp.connect(resonance);
    resonance.connect(g);
    g.connect(output);
    return [src];
  }

  const g = ctx.createGain();
  g.gain.value = 0.22;
  src.connect(hp);
  hp.connect(bp);
  bp.connect(g);
  g.connect(output);
  return [src];
}

function buildStream(ctx, output) {
  const src = noiseSource(ctx, 'white');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1100;
  bp.Q.value = 0.9;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.25;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 400;
  lfo.connect(lfoGain);
  lfoGain.connect(bp.frequency);

  const g = ctx.createGain();
  g.gain.value = 0.2;
  src.connect(bp);
  bp.connect(g);
  g.connect(output);
  return [src, lfo];
}

function buildNight(ctx, output, quiet) {
  const wind = noiseSource(ctx, 'pink');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = quiet ? 350 : 500;
  const windGain = ctx.createGain();
  windGain.gain.value = quiet ? 0.12 : 0.18;

  wind.connect(lp);
  lp.connect(windGain);
  windGain.connect(output);

  const nodes = [wind];

  if (!quiet) {
    // Soft cricket-like chirps via amplitude-modulated oscillators
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 3200 + i * 420;
      const am = ctx.createOscillator();
      am.frequency.value = 18 + i * 3;
      const amGain = ctx.createGain();
      amGain.gain.value = 0.015;
      const chirp = ctx.createGain();
      chirp.gain.value = 0;
      am.connect(amGain);
      amGain.connect(chirp.gain);
      osc.connect(chirp);
      chirp.connect(output);

      // Slow envelope LFO for sparse chirps
      const env = ctx.createOscillator();
      env.frequency.value = 0.12 + i * 0.04;
      const envDepth = ctx.createGain();
      envDepth.gain.value = 0.012;
      env.connect(envDepth);
      envDepth.connect(chirp.gain);

      nodes.push(osc, am, env);
    }
  }

  return nodes;
}

function buildFire(ctx, output) {
  const src = noiseSource(ctx, 'pink');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 0.6;

  const crackle = noiseSource(ctx, 'white');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2000;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.08;

  // Random crackle amplitude via LFO-ish noise modulation
  const mod = ctx.createOscillator();
  mod.type = 'square';
  mod.frequency.value = 2.7;
  const modGain = ctx.createGain();
  modGain.gain.value = 0.06;
  mod.connect(modGain);
  modGain.connect(crackleGain.gain);

  const rumble = ctx.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 70;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.05;

  const g = ctx.createGain();
  g.gain.value = 0.45;

  src.connect(bp);
  bp.connect(g);
  crackle.connect(hp);
  hp.connect(crackleGain);
  crackleGain.connect(g);
  rumble.connect(rumbleGain);
  rumbleGain.connect(g);
  g.connect(output);

  return [src, crackle, mod, rumble];
}

function buildChatter(ctx, output) {
  const src = noiseSource(ctx, 'pink');
  const bp1 = ctx.createBiquadFilter();
  bp1.type = 'bandpass';
  bp1.frequency.value = 700;
  bp1.Q.value = 2;
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.value = 1400;
  bp2.Q.value = 1.5;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 2.4;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.12;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  lfo.connect(lfoGain);
  lfoGain.connect(g.gain);

  src.connect(bp1);
  bp1.connect(bp2);
  bp2.connect(g);
  g.connect(output);
  return [src, lfo];
}

function buildSteam(ctx, output) {
  const src = noiseSource(ctx, 'white');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2800;
  const g = ctx.createGain();
  g.gain.value = 0.12;
  src.connect(hp);
  hp.connect(g);
  g.connect(output);
  return [src];
}

function buildPlane(ctx, output) {
  const drone = ctx.createOscillator();
  drone.type = 'sawtooth';
  drone.frequency.value = 85;
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 220;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.07;

  const cabin = noiseSource(ctx, 'pink');
  const cabinFilter = ctx.createBiquadFilter();
  cabinFilter.type = 'lowpass';
  cabinFilter.frequency.value = 400;
  const cabinGain = ctx.createGain();
  cabinGain.gain.value = 0.35;

  drone.connect(droneFilter);
  droneFilter.connect(droneGain);
  droneGain.connect(output);
  cabin.connect(cabinFilter);
  cabinFilter.connect(cabinGain);
  cabinGain.connect(output);

  return [drone, cabin];
}

function buildBoat(ctx, output) {
  const engine = ctx.createOscillator();
  engine.type = 'sine';
  engine.frequency.value = 48;
  const engGain = ctx.createGain();
  engGain.gain.value = 0.1;

  const water = noiseSource(ctx, 'pink');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 0.7;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0.22;

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(waterGain.gain);

  engine.connect(engGain);
  engGain.connect(output);
  water.connect(bp);
  bp.connect(waterGain);
  waterGain.connect(output);

  return [engine, water, lfo];
}

function buildBus(ctx, output) {
  const engine = ctx.createOscillator();
  engine.type = 'sawtooth';
  engine.frequency.value = 42;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 160;
  const engGain = ctx.createGain();
  engGain.gain.value = 0.08;

  const road = noiseSource(ctx, 'brown');
  const roadGain = ctx.createGain();
  roadGain.gain.value = 0.4;

  engine.connect(filter);
  filter.connect(engGain);
  engGain.connect(output);
  road.connect(roadGain);
  roadGain.connect(output);

  return [engine, road];
}

function buildTrain(ctx, output) {
  const rumble = noiseSource(ctx, 'brown');
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.35;

  // Rhythmic clack via amplitude-gated noise bursts
  const click = noiseSource(ctx, 'white');
  const clickHp = ctx.createBiquadFilter();
  clickHp.type = 'bandpass';
  clickHp.frequency.value = 900;
  clickHp.Q.value = 4;
  const clickGain = ctx.createGain();
  clickGain.gain.value = 0;

  const pulse = ctx.createOscillator();
  pulse.type = 'square';
  pulse.frequency.value = 3.2;
  const pulseDepth = ctx.createGain();
  pulseDepth.gain.value = 0.1;
  pulse.connect(pulseDepth);
  pulseDepth.connect(clickGain.gain);

  const air = noiseSource(ctx, 'pink');
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'highpass';
  airFilter.frequency.value = 1500;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.06;

  rumble.connect(rumbleGain);
  rumbleGain.connect(output);
  click.connect(clickHp);
  clickHp.connect(clickGain);
  clickGain.connect(output);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(output);

  return [rumble, click, pulse, air];
}

export function createSoundVoice(ctx, kind) {
  return makeVoice(ctx, (c, out) => buildKind(kind, c, out));
}
