import { SOUND_CATALOG, createSoundVoice, isSampleCached, isSoundStored } from './sounds.js';

const AudioCtx = window.AudioContext || window.webkitAudioContext;

/**
 * Multi-track ambient mixer.
 * Each sound has independent volume; master gain on top.
 * Pause ducks master to 0 without tearing down voices.
 */
export class SoundMixer {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {GainNode | null} */
    this.master = null;
    /** @type {Map<string, { gain: GainNode, voice: ReturnType<typeof createSoundVoice>, active: boolean }>} */
    this.tracks = new Map();
    this.playing = false;
    this.masterVolume = 0.85;
    /** @type {Set<string>} */
    this.#pending = new Set();
    /** @type {HTMLAudioElement | null} */
    this.#htmlUnlock = null;
    this.#didUnlockBuffer = false;
  }

  /** @type {Set<string>} */
  #pending;

  /** @type {HTMLAudioElement | null} */
  #htmlUnlock;

  #didUnlockBuffer = false;

  #usePlaybackSession() {
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch {
      /* unsupported */
    }
  }

  /**
   * Must run inside a user-gesture call stack (touch/click).
   * iOS Safari starts AudioContext suspended and mutes Web Audio
   * unless the session type is playback.
   */
  unlock() {
    this.#usePlaybackSession();
    if (!AudioCtx) return;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx({ latencyHint: 'playback' });
      } catch {
        this.ctx = new AudioCtx();
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.#didUnlockBuffer) {
      try {
        const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate || 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.ctx.destination);
        src.start(this.ctx.currentTime);
        this.#didUnlockBuffer = true;
      } catch {
        /* unlock buffer is best-effort */
      }
    }

    if (!this.#htmlUnlock) {
      try {
        const a = new Audio();
        a.playsInline = true;
        a.setAttribute('playsinline', 'true');
        a.setAttribute('webkit-playsinline', 'true');
        a.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        this.#htmlUnlock = a;
        const play = a.play();
        if (play) play.catch(() => {});
      } catch {
        /* html unlock is best-effort */
      }
    }
  }

  async ensureContext() {
    this.unlock();
    if (!this.ctx) {
      throw new Error('Web Audio is not supported');
    }
    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  getCatalog() {
    return SOUND_CATALOG;
  }

  isActive(id) {
    return this.tracks.get(id)?.active ?? false;
  }

  isPrepared(id) {
    const meta = SOUND_CATALOG.find((s) => s.id === id);
    if (!meta) return false;
    if (this.tracks.get(id)?.voice.isPrepared?.()) return true;
    return isSampleCached(meta.kind);
  }

  async isStoredOffline(id) {
    if (this.isPrepared(id)) return true;
    const meta = SOUND_CATALOG.find((s) => s.id === id);
    if (!meta) return false;
    return isSoundStored(meta.kind);
  }

  isLoading(id) {
    return this.#pending.has(id);
  }

  #setGain(node, value) {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(value, now + 0.04);
    } catch {
      node.gain.value = value;
    }
  }

  setMasterVolume(value) {
    this.masterVolume = Math.min(1, Math.max(0, value));
    if (this.master && this.playing) {
      this.#setGain(this.master, this.masterVolume);
    }
  }

  setTrackVolume(id, value) {
    const track = this.tracks.get(id);
    if (!track || !this.ctx) return;
    const v = Math.min(1, Math.max(0, value));
    this.#setGain(track.gain, v);
  }

  getTrackVolume(id) {
    const track = this.tracks.get(id);
    if (!track) return 0.7;
    return track.gain.gain.value;
  }

  getActiveSnapshot() {
    return this.getActiveIds().map((id) => ({
      id,
      volume: this.getTrackVolume(id),
    }));
  }

  /**
   * Replace current mix with the given layers.
   * @param {{ id: string, volume?: number }[]} layers
   */
  async applyPreset(layers) {
    await this.ensureContext();
    this.stopAll();

    const prepared = await Promise.all(
      layers.map(async (layer) => {
        const track = this.#ensureTrack(layer.id);
        if (!track) return null;
        const v = Math.min(1, Math.max(0, Number(layer.volume) || 0.7));
        track.gain.gain.value = v;
        try {
          await track.voice.prepare();
          return track;
        } catch (err) {
          console.error('Failed to load sound', layer.id, err);
          return null;
        }
      }),
    );

    await this.ensureContext();
    for (const track of prepared) {
      if (!track) continue;
      track.voice.start();
      track.active = true;
    }

    const any = [...this.tracks.values()].some((t) => t.active);
    this.playing = any;
    if (any) this.#setGain(this.master, this.masterVolume);
  }

  #ensureTrack(id) {
    const meta = SOUND_CATALOG.find((s) => s.id === id);
    if (!meta || !this.ctx || !this.master) return null;

    let track = this.tracks.get(id);
    if (!track) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0.7;
      gain.connect(this.master);
      const voice = createSoundVoice(this.ctx, meta.kind);
      voice.connect(gain);
      track = { gain, voice, active: false, kind: meta.kind };
      this.tracks.set(id, track);
    }
    return track;
  }

  async toggle(id) {
    if (this.#pending.has(id)) return this.isActive(id);
    this.#pending.add(id);

    try {
      await this.ensureContext();
      const track = this.#ensureTrack(id);
      if (!track) return false;

      if (track.active) {
        track.voice.stop();
        track.voice.dispose();
        const voice = createSoundVoice(this.ctx, track.kind);
        voice.connect(track.gain);
        track.voice = voice;
        track.active = false;
      } else {
        try {
          await track.voice.prepare();
        } catch (err) {
          console.error('Failed to load sound', id, err);
          return false;
        }
        await this.ensureContext();
        track.voice.start();
        track.active = true;
        this.playing = true;
        this.#setGain(this.master, this.masterVolume);
      }

      if (![...this.tracks.values()].some((t) => t.active)) {
        this.playing = false;
      }

      return track.active;
    } finally {
      this.#pending.delete(id);
    }
  }

  pauseAll() {
    if (!this.ctx || !this.master) return;
    this.#setGain(this.master, 0);
    this.playing = false;
  }

  async resumeAll() {
    await this.ensureContext();
    if (![...this.tracks.values()].some((t) => t.active)) return;
    this.#setGain(this.master, this.masterVolume);
    this.playing = true;
  }

  stopAll() {
    for (const track of this.tracks.values()) {
      if (track.active) {
        track.voice.stop();
        track.voice.dispose();
        if (this.ctx) {
          const voice = createSoundVoice(this.ctx, track.kind);
          voice.connect(track.gain);
          track.voice = voice;
        }
      }
      track.active = false;
    }
    this.playing = false;
  }

  activeCount() {
    return [...this.tracks.values()].filter((t) => t.active).length;
  }

  getActiveIds() {
    return [...this.tracks.entries()]
      .filter(([, t]) => t.active)
      .map(([id]) => id);
  }
}
