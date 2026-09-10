/**
 * Sample-based ambient voices via Web Audio API.
 * Loops from Freesound (see public/sounds/SOURCES.json).
 * Each factory returns { connect(dest), prepare(), start(), stop(), dispose() }.
 */

export const SOUND_CATEGORIES = [
  { id: 'nature', title: 'Природа' },
  { id: 'night', title: 'Ночь' },
];

export const SOUND_CATALOG = [
  { id: 'ocean', title: 'Океан', kind: 'ocean', category: 'nature', slug: 'океан', description: 'Белый шум океана: мягкий прибой и волны. Бесшовная петля для сна, работы и расслабления в микшере Белый шум.' },
  { id: 'rain', title: 'Дождь', kind: 'rain', category: 'nature', slug: 'дождь', description: 'Звук дождя для сна и концентрации. Спокойный loop дождя — слушайте отдельно или смешайте с другими звуками природы.' },
  { id: 'stream', title: 'Ручей', kind: 'stream', category: 'nature', slug: 'ручей', description: 'Журчание ручья: лёгкий поток воды. Идеально как фон для чтения, медитации и спокойной работы.' },
  { id: 'fire', title: 'Огонь', kind: 'fire', category: 'nature', slug: 'огонь', description: 'Треск костра и тёплый огонь. Уютный loop камина для вечера, сна и атмосферы отдыха.' },
  { id: 'roof', title: 'Дождь на крыше', kind: 'roof', category: 'nature', slug: 'дождь-на-крыше', description: 'Дождь по крыше: плотный шум капель по металлу. Глубокий фон для сна и отключения от города.' },
  { id: 'forest', title: 'Лес', kind: 'forest', category: 'nature', slug: 'лес', description: 'Лесная атмосфера: птицы, кроны и лёгкий ветер. Погружение в природу без наушников с улицы.' },
  { id: 'wind', title: 'Ветер', kind: 'wind', category: 'nature', slug: 'ветер', description: 'Ветер в деревьях — мягкий шум листвы. Спокойный природный фон для фокуса и отдыха.' },
  { id: 'birds', title: 'Птицы', kind: 'birds', category: 'nature', slug: 'птицы', description: 'Пение птиц в лесу. Утренний loop для настроения, работы и тихих пауз.' },
  { id: 'waterfall', title: 'Водопад', kind: 'waterfall', category: 'nature', slug: 'водопад', description: 'Шум водопада: плотный поток воды. Белый шум природы, который маскирует разговоры и город.' },
  { id: 'thunder', title: 'Гроза', kind: 'thunder', category: 'nature', slug: 'гроза', description: 'Дождь и гром: грозовая атмосфера. Слушайте раскаты и ливень в безопасном loop.' },
  { id: 'lake', title: 'Озеро', kind: 'lake', category: 'nature', slug: 'озеро', description: 'Волны озера у берега. Тихий плеск воды для релакса, сна и медитации.' },
  { id: 'river', title: 'Река', kind: 'river', category: 'nature', slug: 'река', description: 'Течение реки: средний поток воды. Ровный природный шум для концентрации.' },
  { id: 'leaves', title: 'Листва', kind: 'leaves', category: 'nature', slug: 'листва', description: 'Шелест листвы на ветру. Мягкий лесной фон без резких звуков.' },
  { id: 'cave', title: 'Пещера', kind: 'cave', category: 'nature', slug: 'пещера', description: 'Пещерная атмосфера: капли, эхо и тишина. Глубокий звук для сна и погружения.' },
  { id: 'beach', title: 'Пляж', kind: 'beach', category: 'nature', slug: 'пляж', description: 'Берег и спокойный прибой. Пляжный loop волн для отдыха и сна.' },
  { id: 'frogs', title: 'Лягушки', kind: 'frogs', category: 'nature', slug: 'лягушки', description: 'Лягушки у пруда ночью. Живая природная звуковая картина для вечера.' },
  { id: 'snow', title: 'Метель', kind: 'snow', category: 'nature', slug: 'метель', description: 'Зимняя метель и ветер. Холодный атмосферный шум снега для фона и сна.' },
  { id: 'meadow', title: 'Луг', kind: 'meadow', category: 'nature', slug: 'луг', description: 'Луг: птицы и летнее поле. Светлый природный фон для утра и работы.' },
  { id: 'fountain', title: 'Фонтан', kind: 'fountain', category: 'nature', slug: 'фонтан', description: 'Журчание фонтана. Короткий водяной loop для спокойного фона дома и в офисе.' },
  { id: 'cicadas', title: 'Цикады', kind: 'cicadas', category: 'nature', slug: 'цикады', description: 'Цикады жарким днём. Летний хор насекомых — плотный белый шум природы.' },
  { id: 'night', title: 'Сверчок ночью', kind: 'night', category: 'night', slug: 'сверчок-ночью', description: 'Сверчки ночью. Тихий ночной loop для засыпания и спокойного вечера.' },
  { id: 'quiet', title: 'Тихая ночь', kind: 'quiet', category: 'night', slug: 'тихая-ночь', description: 'Тихая ночь: мягкая ночная атмосфера. Едва слышный фон без резких акцентов.' },
];

/** @type {Record<string, { url: string, gain: number }>} */
const SAMPLE_KINDS = {
  ocean: { url: '/sounds/ocean.mp3', gain: 0.8 },
  rain: { url: '/sounds/rain.mp3', gain: 0.85 },
  stream: { url: '/sounds/stream.mp3', gain: 0.75 },
  fire: { url: '/sounds/fire.mp3', gain: 0.75 },
  roof: { url: '/sounds/roof.mp3', gain: 0.8 },
  forest: { url: '/sounds/forest.mp3', gain: 0.75 },
  wind: { url: '/sounds/wind.mp3', gain: 0.7 },
  birds: { url: '/sounds/birds.mp3', gain: 0.7 },
  waterfall: { url: '/sounds/waterfall.mp3', gain: 0.75 },
  thunder: { url: '/sounds/thunder.mp3', gain: 0.8 },
  lake: { url: '/sounds/lake.mp3', gain: 0.75 },
  river: { url: '/sounds/river.mp3', gain: 0.75 },
  leaves: { url: '/sounds/leaves.mp3', gain: 0.7 },
  cave: { url: '/sounds/cave.mp3', gain: 0.7 },
  beach: { url: '/sounds/beach.mp3', gain: 0.75 },
  frogs: { url: '/sounds/frogs.mp3', gain: 0.7 },
  snow: { url: '/sounds/blizzard.mp3', gain: 0.85 },
  meadow: { url: '/sounds/meadow.mp3', gain: 0.7 },
  fountain: { url: '/sounds/fountain.mp3', gain: 0.7 },
  cicadas: { url: '/sounds/cicadas.mp3', gain: 0.65 },
  night: { url: '/sounds/night.mp3', gain: 0.7 },
  quiet: { url: '/sounds/quiet.mp3', gain: 0.65 },
};

/** @type {Map<string, AudioBuffer>} */
const sampleBufferCache = new Map();

export const SOUND_CACHE_NAME = 'zone-sounds';

function soundRequestUrl(url) {
  return new URL(url, window.location.origin).href;
}

async function matchSoundCache(url) {
  if (!('caches' in globalThis)) return null;
  try {
    const cache = await caches.open(SOUND_CACHE_NAME);
    return cache.match(soundRequestUrl(url), { ignoreSearch: true });
  } catch {
    return null;
  }
}

async function putSoundCache(url, bytes) {
  if (!('caches' in globalThis)) return;
  try {
    const cache = await caches.open(SOUND_CACHE_NAME);
    await cache.put(
      soundRequestUrl(url),
      new Response(bytes, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      }),
    );
  } catch (err) {
    console.warn('Failed to store sound offline', url, err);
  }
}

export async function isSoundStored(kind) {
  const sample = SAMPLE_KINDS[kind];
  if (!sample) return false;
  if (sampleBufferCache.has(sample.url)) return true;
  const hit = await matchSoundCache(sample.url);
  return Boolean(hit);
}

async function fetchSoundBytes(url) {
  const cached = await matchSoundCache(url);
  if (cached) {
    try {
      return await cached.arrayBuffer();
    } catch {
      /* fall through to network */
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    await putSoundCache(url, data.slice(0));
    return data;
  } catch (err) {
    throw err instanceof Error ? err : new Error(`Failed to load sample: ${url}`);
  }
}

function decodeAudioDataCompat(ctx, arrayBuffer) {
  const data = arrayBuffer.slice(0);
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buf) => {
      if (settled) return;
      settled = true;
      resolve(buf);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error('decodeAudioData failed'));
    };
    try {
      const result = ctx.decodeAudioData(data, ok, fail);
      if (result && typeof result.then === 'function') {
        result.then(ok, fail);
      }
    } catch (err) {
      fail(err);
    }
  });
}

async function getSampleBuffer(ctx, url) {
  const cached = sampleBufferCache.get(url);
  if (cached) return cached;

  const data = await fetchSoundBytes(url);
  const buffer = await decodeAudioDataCompat(ctx, data);
  sampleBufferCache.set(url, buffer);
  return buffer;
}

function makeSampleVoice(ctx, { url, gain = 0.8 }) {
  const output = ctx.createGain();
  output.gain.value = 1;
  let nodes = [];
  let started = false;
  /** @type {AudioBuffer | null} */
  let buffer = null;

  const api = {
    connect(dest) {
      output.connect(dest);
      return api;
    },
    async prepare() {
      buffer = await getSampleBuffer(ctx, url);
      return api;
    },
    isPrepared() {
      return Boolean(buffer);
    },
    start() {
      if (started || !buffer) return api;
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        ctx.resume().catch(() => {});
      }
      started = true;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = buffer.duration;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(output);
      const when = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
      src.start(when);
      nodes = [src];
      return api;
    },
    stop() {
      for (const n of nodes) {
        try {
          if (n.stop) n.stop();
        } catch {
          /* already stopped */
        }
      }
      nodes = [];
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

export function isSampleCached(kind) {
  const sample = SAMPLE_KINDS[kind];
  return Boolean(sample && sampleBufferCache.has(sample.url));
}

export function createSoundVoice(ctx, kind) {
  const sample = SAMPLE_KINDS[kind];
  if (!sample) {
    throw new Error(`Unknown sound kind: ${kind}`);
  }
  return makeSampleVoice(ctx, sample);
}

export function getSoundById(id) {
  return SOUND_CATALOG.find((s) => s.id === id) ?? null;
}

export function getSoundBySlug(slug) {
  if (!slug) return null;
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  return (
    SOUND_CATALOG.find(
      (s) => s.slug === decoded || s.slug === slug || s.id === decoded || s.id === slug,
    ) ?? null
  );
}

export function soundPagePath(soundOrKey) {
  const key = typeof soundOrKey === 'string' ? soundOrKey : soundOrKey?.id;
  const sound = getSoundById(key) || getSoundBySlug(key) || soundOrKey;
  const id = typeof sound === 'object' && sound?.id ? sound.id : key;
  return `/sounds/${id}`;
}

/** Warm common buffers after first user gesture. */
export async function preloadSamples(ctx, kinds = Object.keys(SAMPLE_KINDS)) {
  await Promise.all(
    kinds.map(async (kind) => {
      const sample = SAMPLE_KINDS[kind];
      if (sample) await getSampleBuffer(ctx, sample.url);
    }),
  );
}
