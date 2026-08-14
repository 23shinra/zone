import { SOUND_CATALOG, createSoundVoice } from './sounds.js';

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
  }

  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
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

  setMasterVolume(value) {
    this.masterVolume = Math.min(1, Math.max(0, value));
    if (this.master && this.playing) {
      this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  setTrackVolume(id, value) {
    const track = this.tracks.get(id);
    if (!track || !this.ctx) return;
    const v = Math.min(1, Math.max(0, value));
    track.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  #ensureTrack(id) {
    const meta = SOUND_CATALOG.find((s) => s.id === id);
    if (!meta) return null;

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
      track.voice.start();
      track.active = true;
      if (!this.playing) {
        this.playing = true;
        this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
      }
    }

    if (![...this.tracks.values()].some((t) => t.active)) {
      this.playing = false;
    }

    return track.active;
  }

  pauseAll() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    this.playing = false;
  }

  async resumeAll() {
    await this.ensureContext();
    if (![...this.tracks.values()].some((t) => t.active)) return;
    this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.03);
    this.playing = true;
  }

  stopAll() {
    for (const track of this.tracks.values()) {
      if (track.active) {
        track.voice.stop();
        track.voice.dispose();
        const voice = createSoundVoice(this.ctx, track.kind);
        voice.connect(track.gain);
        track.voice = voice;
      }
      track.active = false;
    }
    this.playing = false;
  }

  activeCount() {
    return [...this.tracks.values()].filter((t) => t.active).length;
  }
}
