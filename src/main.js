import './style.css';
import { SoundMixer } from './mixer.js';
import { applyPageSeo, buildPageSeo } from './seo.js';
import { getSoundById, getSoundBySlug, soundPagePath } from './sounds.js';

const CHROME_CACHE_VER = 'chrome-layout-v9';
(async () => {
  try {
    if (localStorage.getItem('zone.chrome') === CHROME_CACHE_VER) return;
    localStorage.setItem('zone.chrome', CHROME_CACHE_VER);
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    location.reload();
  } catch {
    /* ignore */
  }
})();

const mixer = new SoundMixer();
const PRESETS_KEY = 'zone.presets';
const FAV_KEY = 'zone.favorites';
const THEME_KEY = 'zone.theme';

/** Подставь сюда свой номер Kaspi Gold (16 цифр, пробелы можно). */
const DONATE_VISIBLE = false;
const DONATE_KASPI_CARD = '4400 4300 1234 5678';
const DONATE_KASPI_HOLDER = 'ESL · Белый шум';
const DONATE_KASPI_HINT = 'Kaspi Gold · перевод другу';

const TAB_ROUTES = {
  sounds: '/sounds',
  favorites: '/favorites',
  settings: '/settings',
};

function normalizePath(pathname) {
  try {
    return decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  } catch {
    return pathname || '/';
  }
}

function parseRoute(pathname) {
  const p = normalizePath(pathname);
  if (p === '/избранное' || p === '/favorites') {
    return { tab: 'favorites', sound: null };
  }
  if (p === '/настройки' || p === '/settings') {
    return { tab: 'settings', sound: null };
  }
  for (const prefix of ['/звуки/', '/sounds/']) {
    if (p.startsWith(prefix)) {
      return { tab: 'sounds', sound: getSoundBySlug(p.slice(prefix.length)) };
    }
  }
  return { tab: 'sounds', sound: null };
}

function pathForTab(tab, soundSlug = null) {
  if (tab === 'favorites') return TAB_ROUTES.favorites;
  if (tab === 'settings') return TAB_ROUTES.settings;
  if (soundSlug) return soundPagePath(soundSlug);
  return TAB_ROUTES.sounds;
}

function seoSoundSlug(tab = currentTab) {
  if (tab !== 'sounds') return null;
  const active = mixer.getActiveIds();
  if (active.length === 1) return getSoundById(active[0])?.id ?? null;
  if (active.length === 0 && focusedSoundId) {
    return getSoundById(focusedSoundId)?.id ?? null;
  }
  return null;
}

function currentSeoPage() {
  const activeIds = mixer.getActiveIds();
  return buildPageSeo({
    tab: currentTab,
    activeSounds: activeIds.map((id) => getSoundById(id)).filter(Boolean),
    focusedSound: focusedSoundId ? getSoundById(focusedSoundId) : null,
    preset: playingPresetId ? presets.find((p) => p.id === playingPresetId) ?? null : null,
  });
}

function syncDocumentMeta({ history = 'none' } = {}) {
  const page = currentSeoPage();
  applyPageSeo(page);
  if (history === 'none') return;
  writeHistory(currentTab, history);
}

function highlightFocusedSound() {
  const id = mixer.getActiveIds().length === 1 ? mixer.getActiveIds()[0] : focusedSoundId;
  document.querySelectorAll('.sound-tile').forEach((tile) => {
    tile.classList.toggle('is-focused', Boolean(id) && tile.dataset.id === id);
  });
}

function writeHistory(tab, mode) {
  if (mode === 'none') return;
  const path = pathForTab(tab, seoSoundSlug(tab));
  if (normalizePath(location.pathname) === path) return;
  const state = { tab, soundId: focusedSoundId };
  if (mode === 'replace') window.history.replaceState(state, '', path);
  else window.history.pushState(state, '', path);
}

/** @type {'light' | 'dark'} */
let currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

function applyTheme(theme) {
  currentTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = currentTheme;
  try {
    localStorage.setItem(THEME_KEY, currentTheme);
  } catch {
    /* ignore */
  }
  const meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', currentTheme === 'dark' ? '#0c1219' : '#f4f8fc');
  syncThemeSwitch();
}

function syncThemeSwitch() {
  document.querySelectorAll('.theme-switch').forEach((el) => {
    el.dataset.themeActive = currentTheme;
  });
  document.querySelectorAll('[data-theme-set]').forEach((btn) => {
    const on = btn.dataset.themeSet === currentTheme;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/** @type {'sounds' | 'favorites' | 'settings'} */
let currentTab = parseRoute(location.pathname).tab;
/** @type {string | null} */
let focusedSoundId = parseRoute(location.pathname).sound?.id ?? null;
let sheetOpen = false;
let sleepMenuOpen = false;
/** @type {number} */
let sleepEndsAt = 0;
/** @type {number} */
let sleepChosenMinutes = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let sleepTick = null;
let dockHidden = false;
let lastScrollY = 0;
let bound = false;
/** @type {string | null} */
let playingPresetId = null;
/** @type {string | null} */
let pendingDeletePresetId = null;
/** @type {BeforeInstallPromptEvent | Event | null} */
let deferredInstall = null;

/**
 * @typedef {{ id: string, volume: number }} PresetSound
 * @typedef {{ id: string, name: string, createdAt: number, sounds: PresetSound[] }} Preset
 */

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => p && typeof p.id === 'string' && Array.isArray(p.sounds) && p.sounds.length,
    );
  } catch {
    return [];
  }
}

/** @type {Preset[]} */
let presets = loadPresets();

function savePresets() {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/** @type {Set<string>} */
let favorites = loadFavorites();

function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
}

function makePresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function presetNameFromSounds(sounds) {
  const titles = sounds.map((s) => titleById(s.id));
  if (titles.length <= 3) return titles.join(' · ');
  return `${titles.slice(0, 2).join(' · ')} +${titles.length - 2}`;
}

function isStandaloneApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function syncInstallButton() {
  const btn = document.getElementById('btn-install');
  if (!btn) return;
  btn.hidden = isStandaloneApp();
}

function showInstallSheet() {
  const sheet = document.getElementById('install-sheet');
  if (sheet) sheet.hidden = false;
}

function hideInstallSheet() {
  const sheet = document.getElementById('install-sheet');
  if (sheet) sheet.hidden = true;
}

async function installPwa() {
  if (deferredInstall && 'prompt' in deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    syncInstallButton();
    return;
  }
  showInstallSheet();
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  syncInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstall = null;
  hideInstallSheet();
  syncInstallButton();
});

function svg(body, { filled = false, sizeClass = 'sound-card__icon' } = {}) {
  const fill = filled ? 'currentColor' : 'none';
  const stroke = filled ? 'none' : 'currentColor';
  const sw = filled ? '' : ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}"${sw} aria-hidden="true">${body}</svg>`;
}

const ICONS = {
  ocean: svg(
    '<path d="M3 9c2.2 0 2.2 2 4.4 2S9.6 9 11.8 9s2.2 2 4.4 2S18.4 9 21 9"/><path d="M3 14c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.8-2"/>',
  ),
  rain: svg(
    '<path d="M7.2 16H17a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5-1.2A3.8 3.8 0 0 0 7.2 16z"/><path d="M9 19v2M12.5 19v2M16 19v2"/>',
  ),
  stream: svg(
    '<path d="M4 8c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/><path d="M4 12.5c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/><path d="M4 17c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/>',
  ),
  fire: svg(
    '<path d="M12 3.5c1.8 2.4.2 3.8 1.4 5.8 1.1 1.8 3.1 2.2 3.1 5.2a4.5 4.5 0 0 1-9 0c0-2.4 1.4-3.6 2.4-5.4C11.2 7.2 10.2 5.8 12 3.5z"/><path d="M12 18.5c1.4 0 2.4-1 2.4-2.3 0-1.2-.8-1.8-2.4-3.2-1.6 1.4-2.4 2-2.4 3.2 0 1.3 1 2.3 2.4 2.3z"/>',
  ),
  roof: svg(
    '<path d="M7 3.2v2.6M12 2.2v2.6M17 3.2v2.6"/><path d="M3.5 13.2 12 6.2l8.5 7"/><path d="M6 12.2V20h12v-7.8"/><path d="M10.2 20v-3.6h3.6V20"/>',
  ),
  forest: svg(
    '<path d="M12 21V11"/><path d="M7.5 21h9"/><path d="M12 4 6.5 13h4L5.5 20h13L13.5 13h4L12 4z"/>',
  ),
  wind: svg(
    '<path d="M3 8h11.5a2.8 2.8 0 1 0-2.8-2.8"/><path d="M3 12.5h14a2.8 2.8 0 1 1-2.8 2.8"/><path d="M3 17h7"/>',
  ),
  birds: svg(
    '<path d="M4 14.5c3.8-1.2 6-5 7-9.5 1 4.5 3.2 8.3 7 9.5-2.8 1.4-5.2 1.4-7 0-1.8 1.4-4.2 1.4-7 0z"/><path d="M11 5.2 12 8l1-2.8"/>',
  ),
  waterfall: svg(
    '<path d="M4 4h16"/><path d="M7 4c0 3.5 1.8 4.5 1.8 8S7 16.5 7 20"/><path d="M12 4c0 3.5 1.8 4.5 1.8 8S12 16.5 12 20"/><path d="M17 4c0 3.5-1.8 4.5-1.8 8S17 16.5 17 20"/>',
  ),
  thunder: svg(
    '<path d="M7.2 15H16.5a3.2 3.2 0 0 0 .3-6.4 4.6 4.6 0 0 0-8.7-1.1A3.5 3.5 0 0 0 7.2 15z"/><path d="M11.2 13.5 9.5 18h3.2L11 22"/>',
  ),
  lake: svg(
    '<ellipse cx="12" cy="14" rx="8" ry="3.2"/><path d="M5.5 13.2c1.6-3.8 3.8-6.2 6.5-7.7 2.7 1.5 4.9 3.9 6.5 7.7"/>',
  ),
  river: svg(
    '<path d="M3 7c2.8 1.6 4.8 1.6 7.2 0s4.4-1.6 7.2 0"/><path d="M3 12c2.8 1.6 4.8 1.6 7.2 0s4.4-1.6 7.2 0"/><path d="M3 17c2.8 1.6 4.8 1.6 7.2 0s4.4-1.6 7.2 0"/>',
  ),
  leaves: svg(
    '<path d="M12 20.5V11"/><path d="M12 11c-4.2-1.2-6.8-4.2-7.5-8 4.2.4 7.2 2.6 8.5 5.8"/><path d="M12 11c4.2-1.2 6.8-4.2 7.5-8-4.2.4-7.2 2.6-8.5 5.8"/>',
  ),
  cave: svg(
    '<path d="M4 20V11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5V20"/><path d="M9 20v-4.2a3 3 0 0 1 6 0V20"/>',
  ),
  beach: svg(
    '<circle cx="17" cy="7" r="2.4"/><path d="M3 15.5c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.4-2"/><path d="M3 19.5c2.2 0 2.2 1.4 4.4 1.4s2.2-1.4 4.4-1.4 2.2 1.4 4.4 1.4 2.2-1.4 4.4-1.4"/>',
  ),
  frogs: svg(
    '<ellipse cx="12" cy="14.5" rx="6.5" ry="4"/><circle cx="9.2" cy="10.2" r="1.6"/><circle cx="14.8" cy="10.2" r="1.6"/><path d="M5.5 16.5 3.8 19M18.5 16.5l1.7 2.5"/>',
  ),
  snow: svg(
    '<path d="M12 3.5v17"/><path d="M5.2 7.2 18.8 16.8"/><path d="M18.8 7.2 5.2 16.8"/><circle cx="12" cy="12" r="1.4"/>',
  ),
  meadow: svg(
    '<path d="M5 19c0-4 1.8-7 3.5-7S12 15 12 19"/><path d="M12 19c0-5 2-8.5 4-8.5S20 14 20 19"/><path d="M8.5 10.5c0-2.2 1.2-4 2.5-4s2.5 1.8 2.5 4"/><circle cx="11" cy="5.5" r="1.3"/>',
  ),
  fountain: svg(
    '<path d="M12 4v6"/><path d="M8 7c1.2 1.5 2.5 2.5 4 2.5S14.8 8.5 16 7"/><path d="M6 14h12"/><path d="M7.5 14c0 3 2 5.5 4.5 5.5S16.5 17 16.5 14"/>',
  ),
  cicadas: svg(
    '<ellipse cx="12" cy="13" rx="5.5" ry="3.5"/><path d="M7.5 11.5 4.8 8.2M16.5 11.5l2.7-3.3"/><path d="M9.5 16.5 8 19.5M14.5 16.5 16 19.5"/><circle cx="10" cy="12.5" r="0.7"/><circle cx="14" cy="12.5" r="0.7"/>',
  ),
  night: svg(
    '<path d="M14.5 4.2A6.5 6.5 0 1 0 19.8 14 5 5 0 0 1 14.5 4.2z"/><path d="M7.2 6.2l.55 1.5 1.55.05-1.2 1 .4 1.5-1.3-.85-1.3.85.4-1.5-1.2-1 1.55-.05z"/>',
  ),
  quiet: svg(
    '<path d="M13 4.2a6.8 6.8 0 1 0 6.6 10.2A8.2 8.2 0 0 1 13 4.2z"/><path d="M18.2 4.2v3.2M16.6 5.8h3.2"/>',
  ),
};

function playIcon() {
  return svg('<path d="M8 5.5v13l11-6.5z"/>', { filled: true, sizeClass: '' });
}

function pauseIcon() {
  return svg(
    '<rect x="7" y="5.5" width="3.5" height="13" rx="1"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1"/>',
    { filled: true, sizeClass: '' },
  );
}

function stopIcon() {
  return svg('<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/>', {
    filled: true,
    sizeClass: '',
  });
}

function sleepIcon() {
  return svg('<path d="M16.8 14.2A6.4 6.4 0 0 1 9.8 5.4 7 7 0 1 0 18.6 16a6.2 6.2 0 0 1-1.8-1.8z"/>', {
    sizeClass: '',
  });
}

function speakerLow() {
  return svg('<path d="M4.5 9.5v5h3.2L12 18.5v-13l-4.3 4H4.5z"/>', { sizeClass: '' });
}

function speakerHigh() {
  return svg(
    '<path d="M4.5 9.5v5h3.2L12 18.5v-13l-4.3 4H4.5z"/><path d="M15.2 9.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.4 6.8a6.2 6.2 0 0 1 0 10.4"/>',
    { sizeClass: '' },
  );
}

function caretIcon() {
  return svg('<path d="M6 9.5 12 15.5 18 9.5"/>', { sizeClass: 'dock__meta-caret' });
}

function starIcon(on) {
  return svg(
    '<path d="M12 3.8l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.5l.9-5L4.8 9l5-.7z"/>',
    { filled: on, sizeClass: '' },
  );
}

function sunIcon() {
  return svg(
    '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6.1 6.1l1.3 1.3M16.6 16.6l1.3 1.3M17.9 6.1l-1.3 1.3M7.4 16.6l-1.3 1.3"/>',
    { sizeClass: '' },
  );
}

function moonIcon() {
  return svg('<path d="M16.8 14.2A6.4 6.4 0 0 1 9.8 5.4 7 7 0 1 0 18.6 16a6.2 6.2 0 0 1-1.8-1.8z"/>', {
    sizeClass: '',
  });
}

function installIcon() {
  return svg(
    '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M12 7.5v6M9 10.5h6"/><path d="M8 20.5h8"/>',
    { sizeClass: '' },
  );
}

function copyIcon() {
  return svg(
    '<rect x="8" y="8" width="10" height="12" rx="1.5"/><path d="M6 16V5.5A1.5 1.5 0 0 1 7.5 4H15"/>',
    { sizeClass: '' },
  );
}

function heartIcon() {
  return svg(
    '<path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 8.2a3.8 3.8 0 0 1 7 2.6C19 15.6 12 20 12 20z"/>',
    { filled: true, sizeClass: '' },
  );
}

function formatKaspiCard(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

async function copyKaspiCard() {
  const digits = DONATE_KASPI_CARD.replace(/\D/g, '');
  try {
    await navigator.clipboard.writeText(digits);
    showCenterNotice('Карта скопирована', 'Спасибо, что поддерживаете зону 🤍');
  } catch {
    showCenterNotice('Не удалось скопировать', 'Попробуйте ещё раз');
  }
}

function shareIosIcon() {
  return svg(
    '<path d="M12 3.5v10"/><path d="M8.5 7 12 3.5 15.5 7"/><path d="M6.5 11.5v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-7"/>',
    { sizeClass: '' },
  );
}

function navSoundsIcon() {
  return svg('<path d="M4 10v4M8 7v10M12 4.5v15M16 7v10M20 10v4"/>', { sizeClass: '' });
}

function navFavIcon() {
  return svg(
    '<path d="M12 3.8l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.5l.9-5L4.8 9l5-.7z"/>',
    { sizeClass: '' },
  );
}

function navSettingsIcon() {
  return svg(
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    { sizeClass: '' },
  );
}

function plusIcon() {
  return svg('<path d="M12 6v12M6 12h12"/>', { sizeClass: '' });
}

function trashIcon() {
  return svg(
    '<path d="M5.5 8h13M9.5 8V6.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V8M10 11v5.5M14 11v5.5M7.5 8l.7 11a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-11"/>',
    { sizeClass: '' },
  );
}

function titleById(id) {
  return mixer.getCatalog().find((s) => s.id === id)?.title ?? id;
}

function soundCardHtml(s, i) {
  const fav = favorites.has(s.id);
  return `
    <div class="sound-tile" data-id="${s.id}" style="--i:${i}">
      <div
        class="sound-card"
        role="button"
        tabindex="0"
        data-id="${s.id}"
        aria-pressed="false"
        aria-busy="false"
      >
        <button
          type="button"
          class="fav-btn${fav ? ' is-on' : ''}"
          data-fav="${s.id}"
          aria-label="Избранное"
          aria-pressed="${fav}"
        >${starIcon(fav)}</button>
        <span class="sound-card__loader" aria-hidden="true"></span>
        ${ICONS[s.id] || ICONS.ocean}
        <p class="sound-card__title">
          <a href="${soundPagePath(s)}" data-sound-href="${s.id}">${s.title}</a>
        </p>
      </div>
      <div class="volume">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value="0.7"
          data-volume="${s.id}"
          aria-label="Громкость: ${s.title}"
        />
      </div>
    </div>
  `;
}

function renderSoundGrid(sounds, instant = false) {
  if (!sounds.length) {
    return `
      <div class="empty-state">
        <h2>Пока пусто</h2>
        <p>Звуки появятся здесь.</p>
      </div>
    `;
  }

  return `
    <div class="sound-grid${instant ? ' is-instant' : ''}" role="list">
      ${sounds.map((s, i) => soundCardHtml(s, i)).join('')}
    </div>
  `;
}

function renderPresetsView() {
  const list = presets.length
    ? `<div class="preset-list" role="list">
        ${presets.map((preset) => presetCardHtml(preset)).join('')}
      </div>`
    : `<div class="empty-state">
        <h2>Нет пресетов</h2>
        <p>Нажми +, выбери звуки и сохрани свой микс.</p>
      </div>`;

  const favSounds = mixer.getCatalog().filter((s) => favorites.has(s.id));
  const favGrid = favSounds.length
    ? `<section class="sound-group">
        <h2 class="sound-group__title">Звуки</h2>
        <div class="sound-grid is-instant" role="list">
          ${favSounds.map((s, i) => soundCardHtml(s, i)).join('')}
        </div>
      </section>`
    : '';

  return `
    <div class="presets">
      <div class="presets__toolbar">
        <h2 class="presets__title">Пресеты</h2>
        <button type="button" class="preset-add" id="btn-preset-add" aria-label="Создать пресет">
          ${plusIcon()}
        </button>
      </div>
      ${list}
      ${favGrid}
    </div>
  `;
}

function presetCardHtml(preset) {
  const icons = preset.sounds
    .slice(0, 4)
    .map((s) => `<span class="preset-card__icon">${ICONS[s.id] || ICONS.ocean}</span>`)
    .join('');
  const extra = preset.sounds.length > 4 ? `<span class="preset-card__more">+${preset.sounds.length - 4}</span>` : '';
  return `
    <article class="preset-card" role="listitem" data-preset-id="${preset.id}">
      <button type="button" class="preset-card__main" data-preset-play="${preset.id}">
        <div class="preset-card__icons">${icons}${extra}</div>
        <div class="preset-card__body">
          <p class="preset-card__name">${preset.name}</p>
          <p class="preset-card__meta">${preset.sounds.length} ${pluralSounds(preset.sounds.length)}</p>
        </div>
      </button>
      <button type="button" class="preset-card__delete" data-preset-delete="${preset.id}" aria-label="Удалить пресет">
        ${trashIcon()}
      </button>
    </article>
  `;
}

function pluralSounds(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'звук';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'звука';
  return 'звуков';
}

/** @type {Set<string>} */
let presetDraft = new Set();

function renderSettingsView() {
  return `
    <div class="settings">
      <h2 class="settings__title">Настройки</h2>
      <div class="settings-card">
        <div class="settings-row settings-row--inline">
          <div class="settings-row__label">
            <span>Тема</span>
          </div>
          <div class="theme-switch" role="group" aria-label="Тема" data-theme-active="${currentTheme}">
            <span class="theme-switch__thumb" aria-hidden="true"></span>
            <button
              type="button"
              class="theme-switch__btn${currentTheme === 'light' ? ' is-on' : ''}"
              data-theme-set="light"
              aria-label="Светлая"
              aria-pressed="${currentTheme === 'light'}"
            >${sunIcon()}<span>Светлая</span></button>
            <button
              type="button"
              class="theme-switch__btn${currentTheme === 'dark' ? ' is-on' : ''}"
              data-theme-set="dark"
              aria-label="Тёмная"
              aria-pressed="${currentTheme === 'dark'}"
            >${moonIcon()}<span>Тёмная</span></button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row__label">
            <span>Приложение</span>
          </div>
          <button type="button" class="install-btn" id="btn-install" hidden>
            ${installIcon()}
            <span>На экран</span>
          </button>
          <p class="settings-hint">Добавьте «Белый шум» на главный экран для быстрого доступа без браузера.</p>
        </div>
      </div>
    </div>
  `;
}

function renderDonateBlock() {
  const card = formatKaspiCard(DONATE_KASPI_CARD);
  return `
    <section class="donate" aria-labelledby="donate-title">
      <div class="donate__glow" aria-hidden="true"></div>
      <div class="donate__head">
        <span class="donate__badge">${heartIcon()} Поддержка</span>
        <h3 class="donate__title" id="donate-title">Поддержите проект</h3>
        <p class="donate__lead">
          «Белый шум» бесплатный и без рекламы. Если дождь помогает уснуть —
          киньте кофе на сервер: так зона останется живой и тихой.
        </p>
      </div>

      <button type="button" class="donate-card" id="btn-copy-kaspi" aria-label="Скопировать номер Kaspi Gold">
        <div class="donate-card__top">
          <span class="donate-card__chip" aria-hidden="true"></span>
          <span class="donate-card__brand">Kaspi Gold</span>
        </div>
        <p class="donate-card__number">${card}</p>
        <div class="donate-card__bottom">
          <div>
            <p class="donate-card__hint">${DONATE_KASPI_HINT}</p>
            <p class="donate-card__name">${DONATE_KASPI_HOLDER}</p>
          </div>
          <span class="donate-card__copy">${copyIcon()} Копировать</span>
        </div>
      </button>

      <p class="donate__foot">Любая сумма — уже жест. Спасибо, что слышите.</p>
    </section>
  `;
}

function openDonateSheet() {
  const sheet = document.getElementById('donate-sheet');
  if (sheet) sheet.hidden = false;
}

function closeDonateSheet() {
  const sheet = document.getElementById('donate-sheet');
  if (sheet) sheet.hidden = true;
}

function renderTopbar() {
  let root = document.getElementById('topbar-root');
  if (!root) {
    root = document.createElement('header');
    root.id = 'topbar-root';
    document.body.prepend(root);
  }
  // Never keep a duplicate topbar inside the scroll area
  document.querySelector('#app header.topbar')?.remove();
  root.className = 'topbar';
  root.innerHTML = `
    <a href="${pathForTab('sounds')}" class="topbar__brand" data-tab="sounds">Белый шум</a>
    <nav class="topbar__nav" aria-label="Навигация">
      <a
        href="${pathForTab('sounds')}"
        class="nav-item${currentTab === 'sounds' ? ' is-active' : ''}"
        data-tab="sounds"
        aria-label="Звуки"
        title="Звуки"
      >${navSoundsIcon()}</a>
      <a
        href="${pathForTab('favorites')}"
        class="nav-item${currentTab === 'favorites' ? ' is-active' : ''}"
        data-tab="favorites"
        aria-label="Избранное"
        title="Избранное"
      >${navFavIcon()}</a>
      <a
        href="${pathForTab('settings')}"
        class="nav-item${currentTab === 'settings' ? ' is-active' : ''}"
        data-tab="settings"
        aria-label="Настройки"
        title="Настройки"
      >${navSettingsIcon()}</a>
      ${
        DONATE_VISIBLE
          ? `
      <button type="button" class="nav-item nav-item--donate" id="btn-donate-open" aria-label="Поддержать" title="Поддержать">
        ${heartIcon()}
      </button>`
          : ''
      }
    </nav>
  `;
}

function renderDock() {
  let root = document.getElementById('dock-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'dock-root';
    document.body.appendChild(root);
  }
  document.querySelector('#app .dock')?.remove();
  root.className = 'dock';
  root.innerHTML = `
    <div class="dock__panel${sheetOpen ? ' is-open' : ''}" id="dock-panel">
      <div class="active-sheet" id="active-sheet" role="dialog" aria-label="Активные звуки"></div>
      <div class="dock__bar">
        <button type="button" class="dock__meta" id="btn-active" aria-expanded="${sheetOpen}" aria-label="Активные звуки">
          <span class="now-playing" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <strong id="active-count">0</strong>
          ${caretIcon()}
        </button>
        <div class="controls">
          <button type="button" class="btn btn--sleep" id="btn-sleep" aria-label="Таймер сна" title="Таймер сна">
            <span class="sleep-btn__icon">${sleepIcon()}</span>
            <span class="sleep-btn__time" hidden>0:00</span>
          </button>
          <button type="button" class="btn" id="btn-stop" aria-label="Стоп" title="Стоп">
            ${stopIcon()}
          </button>
          <button type="button" class="btn btn--primary" id="btn-play" aria-label="Пауза" title="Пауза / продолжить">
            ${pauseIcon()}
          </button>
        </div>
      </div>
      <div class="sleep-menu" id="sleep-menu" aria-hidden="true">
        <button type="button" class="sleep-menu__opt" data-sleep="15">15 мин</button>
        <button type="button" class="sleep-menu__opt" data-sleep="30">30 мин</button>
        <button type="button" class="sleep-menu__opt" data-sleep="60">60 мин</button>
        <button type="button" class="sleep-menu__opt" data-sleep="0">Выкл</button>
      </div>
      <div class="master">
        ${speakerLow()}
        <input type="range" id="master-volume" min="0" max="1" step="0.01" value="${mixer.masterVolume}" aria-label="Общая громкость" />
        ${speakerHigh()}
      </div>
    </div>
  `;
}

function render() {
  const app = document.querySelector('#app');
  const all = mixer.getCatalog();

  renderTopbar();
  renderDock();

  app.innerHTML = `
    <div class="ambient" aria-hidden="true"></div>

    <div class="app-shell">
      <div class="view-stack">
        <section
          class="view${currentTab === 'sounds' ? ' is-active' : ''}"
          data-view="sounds"
          id="view-sounds"
          aria-hidden="${currentTab !== 'sounds'}"
        >
          ${renderSoundGrid(all)}
        </section>

        <section
          class="view${currentTab === 'favorites' ? ' is-active' : ''}"
          data-view="favorites"
          id="view-favorites"
          aria-hidden="${currentTab !== 'favorites'}"
        >
          ${renderPresetsView()}
        </section>

        <section
          class="view${currentTab === 'settings' ? ' is-active' : ''}"
          data-view="settings"
          id="view-settings"
          aria-hidden="${currentTab !== 'settings'}"
        >
          ${renderSettingsView()}
        </section>
      </div>
    </div>

    <div class="preset-sheet" id="preset-sheet" hidden>
      <div class="preset-sheet__card" role="dialog" aria-modal="true" aria-labelledby="preset-sheet-title">
        <div class="preset-sheet__head">
          <h2 id="preset-sheet-title">Новый пресет</h2>
          <button type="button" class="preset-sheet__close" id="btn-preset-close" aria-label="Закрыть">
            ${svg('<path d="M7 7l10 10M17 7 7 17"/>', { sizeClass: '' })}
          </button>
        </div>
        <p class="preset-sheet__hint">Выбери звуки для микса</p>
        <div class="preset-sheet__body" id="preset-sheet-body"></div>
        <div class="preset-sheet__foot">
          <button type="button" class="preset-sheet__cancel" id="btn-preset-cancel">Отмена</button>
          <button type="button" class="preset-sheet__save" id="btn-preset-save" disabled>Сохранить</button>
        </div>
      </div>
    </div>

    <div class="confirm-sheet" id="delete-preset-sheet" hidden>
      <div class="confirm-sheet__card" role="dialog" aria-modal="true" aria-labelledby="delete-preset-title">
        <h2 id="delete-preset-title">Удалить пресет?</h2>
        <p class="confirm-sheet__text" id="delete-preset-text"></p>
        <div class="confirm-sheet__foot">
          <button type="button" class="confirm-sheet__cancel" id="btn-delete-preset-cancel">Отмена</button>
          <button type="button" class="confirm-sheet__ok" id="btn-delete-preset-ok">Удалить</button>
        </div>
      </div>
    </div>

    <div class="install-sheet" id="install-sheet" hidden>
      <div class="install-sheet__card" role="dialog" aria-labelledby="install-sheet-title">
        <h2 id="install-sheet-title">На главный экран</h2>
        <ol class="install-sheet__steps">
          <li>Нажмите ${shareIosIcon()} <strong>Поделиться</strong></li>
          <li>Выберите <strong>На экран «Домой»</strong></li>
        </ol>
        <p class="install-sheet__hint">В Chrome: меню браузера → «Установить приложение».</p>
        <button type="button" class="install-sheet__ok" id="btn-install-ok">Понятно</button>
      </div>
    </div>

    ${
      DONATE_VISIBLE
        ? `
    <div class="donate-sheet" id="donate-sheet" hidden>
      <div class="donate-sheet__card" role="dialog" aria-modal="true" aria-labelledby="donate-title">
        <button type="button" class="donate-sheet__close" id="btn-donate-close" aria-label="Закрыть">
          ${svg('<path d="M7 7l10 10M17 7 7 17"/>', { sizeClass: '' })}
        </button>
        ${renderDonateBlock()}
      </div>
    </div>`
        : ''
    }

    <div class="toast" id="toast" hidden role="status" aria-live="polite"></div>

    <div class="center-notice" id="center-notice" hidden role="status" aria-live="polite">
      <div class="center-notice__card">
        <span class="center-notice__icon" aria-hidden="true">${heartIcon()}</span>
        <p class="center-notice__title"></p>
        <p class="center-notice__sub" hidden></p>
      </div>
    </div>
  `;

  syncAllCards();
  updateChrome();
  renderActiveSheet();
  syncSleepUi();
  syncInstallButton();
  syncThemeSwitch();
  document.querySelector('.dock')?.classList.remove('is-hidden');
  highlightFocusedSound();
  syncDocumentMeta({ history: 'none' });
}

function refreshFavoritesView() {
  const view = document.getElementById('view-favorites');
  if (!view) return;
  view.innerHTML = renderPresetsView();
}

function setTab(tab, { history = 'push' } = {}) {
  const next = tab === 'favorites' || tab === 'settings' ? tab : 'sounds';
  if (next !== 'sounds') {
    focusedSoundId = null;
  } else if (history === 'push') {
    const ids = mixer.getActiveIds();
    if (ids.length === 1) focusedSoundId = ids[0];
    else if (ids.length > 1) focusedSoundId = null;
  }
  writeHistory(next, history);
  syncDocumentMeta({ history: 'none' });
  highlightFocusedSound();

  if (next === currentTab) {
    showDock();
    return;
  }

  currentTab = next;
  setSheetOpen(false);
  showDock();
  getScrollRoot().scrollTo({ top: 0, behavior: 'smooth' });

  document.querySelectorAll('.nav-item[data-tab]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === next);
  });

  if (next === 'favorites') refreshFavoritesView();
  if (next === 'settings') {
    syncInstallButton();
    syncThemeSwitch();
  }

  document.querySelectorAll('.view').forEach((el) => {
    const on = el.dataset.view === next;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-hidden', String(!on));
  });
}

function bindRouting() {
  writeHistory(currentTab, 'replace');
  syncDocumentMeta({ history: 'none' });
  window.addEventListener('popstate', () => {
    const route = parseRoute(location.pathname);
    focusedSoundId = route.sound?.id ?? null;
    setTab(route.tab, { history: 'none' });
    highlightFocusedSound();
  });
}

function openSoundPage(id) {
  const sound = getSoundById(id);
  if (!sound) return;
  focusedSoundId = sound.id;
  setTab('sounds', { history: 'push' });
  highlightFocusedSound();
  document.querySelector(`.sound-tile[data-id="${sound.id}"]`)?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function showCenterNotice(title, subtitle = '') {
  const notice = document.getElementById('center-notice');
  if (!notice) return;

  const titleEl = notice.querySelector('.center-notice__title');
  const subEl = notice.querySelector('.center-notice__sub');
  if (titleEl) titleEl.textContent = title;
  if (subEl) {
    subEl.textContent = subtitle;
    subEl.hidden = !subtitle;
  }

  clearTimeout(showCenterNotice._hideTimer);
  clearTimeout(showCenterNotice._doneTimer);
  notice.hidden = false;
  notice.classList.remove('is-out');
  // force reflow so enter animation restarts
  void notice.offsetWidth;
  notice.classList.add('is-on');

  showCenterNotice._hideTimer = setTimeout(() => {
    notice.classList.add('is-out');
    notice.classList.remove('is-on');
    showCenterNotice._doneTimer = setTimeout(() => {
      notice.hidden = true;
      notice.classList.remove('is-out');
    }, 420);
  }, 2000);
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();

  const on = favorites.has(id);
  document.querySelectorAll(`[data-fav="${id}"]`).forEach((btn) => {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = starIcon(on);
  });

  if (currentTab === 'favorites') {
    refreshFavoritesView();
    syncAllCards();
  }
}

function createPresetFromDraft() {
  const selected = [...presetDraft];
  if (!selected.length) {
    showToast('Выбери хотя бы один звук');
    return;
  }

  const sounds = selected.map((id) => ({ id, volume: 0.7 }));
  const preset = {
    id: makePresetId(),
    name: presetNameFromSounds(sounds),
    createdAt: Date.now(),
    sounds,
  };

  presets.unshift(preset);
  savePresets();
  closePresetBuilder();
  refreshFavoritesView();
  showToast('Пресет сохранён');
}

function renderPresetPickerBody() {
  const body = document.getElementById('preset-sheet-body');
  if (!body) return;

  const catalog = mixer.getCatalog();
  body.innerHTML = `
    <div class="preset-pick-grid">
      ${catalog
        .map((s) => {
          const on = presetDraft.has(s.id);
          return `
            <button
              type="button"
              class="preset-pick${on ? ' is-on' : ''}"
              data-preset-pick="${s.id}"
              aria-pressed="${on}"
            >
              <span class="preset-pick__icon">${ICONS[s.id] || ICONS.ocean}</span>
              <span class="preset-pick__title">${s.title}</span>
            </button>
          `;
        })
        .join('')}
    </div>
  `;

  syncPresetSaveButton();
}

function syncPresetSaveButton() {
  const btn = document.getElementById('btn-preset-save');
  if (!btn) return;
  btn.disabled = presetDraft.size === 0;
  btn.textContent = presetDraft.size
    ? `Сохранить · ${presetDraft.size}`
    : 'Сохранить';
}

function openPresetBuilder() {
  presetDraft = new Set();
  const sheet = document.getElementById('preset-sheet');
  if (!sheet) return;
  renderPresetPickerBody();
  sheet.hidden = false;
  showDock();
  setSheetOpen(false);
}

function closePresetBuilder() {
  const sheet = document.getElementById('preset-sheet');
  if (sheet) sheet.hidden = true;
  presetDraft = new Set();
}

function togglePresetPick(id) {
  if (presetDraft.has(id)) presetDraft.delete(id);
  else presetDraft.add(id);

  const btn = document.querySelector(`[data-preset-pick="${id}"]`);
  if (btn) {
    const on = presetDraft.has(id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  syncPresetSaveButton();
}

function stopPlayback() {
  playingPresetId = null;
  focusedSoundId = null;
  mixer.stopAll();
  syncAllCards();
  updateChrome();
  renderActiveSheet();
  setSheetOpen(false);
  highlightFocusedSound();
  syncDocumentMeta({ history: 'replace' });
}

function askDeletePreset(id) {
  const preset = presets.find((p) => p.id === id);
  if (!preset) return;

  pendingDeletePresetId = id;
  const sheet = document.getElementById('delete-preset-sheet');
  const text = document.getElementById('delete-preset-text');
  const playing = playingPresetId === id && mixer.activeCount() > 0;

  if (text) {
    text.textContent = playing
      ? `«${preset.name}» сейчас играет. Удаление остановит звук.`
      : `«${preset.name}» будет удалён без возможности восстановления.`;
  }
  if (sheet) sheet.hidden = false;
}

function closeDeletePresetSheet() {
  pendingDeletePresetId = null;
  const sheet = document.getElementById('delete-preset-sheet');
  if (sheet) sheet.hidden = true;
}

function confirmDeletePreset() {
  const id = pendingDeletePresetId;
  if (!id) {
    closeDeletePresetSheet();
    return;
  }

  const wasPlaying = playingPresetId === id && mixer.activeCount() > 0;
  presets = presets.filter((p) => p.id !== id);
  savePresets();
  closeDeletePresetSheet();

  if (wasPlaying) {
    stopPlayback();
    showToast('Пресет удалён, звук остановлен');
  } else {
    if (playingPresetId === id) playingPresetId = null;
    showToast('Пресет удалён');
  }

  refreshFavoritesView();
}

function syncVolumesFromLayers(layers) {
  for (const layer of layers) {
    document.querySelectorAll(`input[data-volume="${layer.id}"]`).forEach((el) => {
      el.value = String(layer.volume);
    });
  }
}

async function playPreset(id) {
  const preset = presets.find((p) => p.id === id);
  if (!preset) return;

  const storedFlags = await Promise.all(preset.sounds.map((s) => mixer.isStoredOffline(s.id)));
  const missingOffline = preset.sounds.filter((_, i) => !storedFlags[i]);
  if (!navigator.onLine && missingOffline.length) {
    showToast('Нет сети. Сначала загрузите эти звуки онлайн.');
    return;
  }

  const needsLoad = preset.sounds.filter((s, i) => !mixer.isPrepared(s.id) && !storedFlags[i]);
  for (const s of needsLoad) setCardLoading(s.id, true);
  try {
    await mixer.applyPreset(preset.sounds);
    playingPresetId = id;
    focusedSoundId = null;
  } finally {
    for (const s of needsLoad) setCardLoading(s.id, false);
  }

  syncAllCards();
  syncVolumesFromLayers(preset.sounds);
  updateChrome();
  renderActiveSheet();
  highlightFocusedSound();
  syncDocumentMeta({ history: 'replace' });
}

function setDockHidden(_hidden) {
  dockHidden = false;
  document.querySelector('.dock')?.classList.remove('is-hidden');
}

function showDock() {
  setDockHidden(false);
}

function getScrollRoot() {
  return document.querySelector('.app-shell') || document.getElementById('app') || document.documentElement;
}

function getScrollY() {
  return getScrollRoot().scrollTop || 0;
}

function bindDockScroll() {
  /* Header and dock are outside #app; only .app-shell can scroll. */
}

function setSheetOpen(open) {
  sheetOpen = open;
  if (open) {
    sleepMenuOpen = false;
    showDock();
  }
  document.getElementById('dock-panel')?.classList.toggle('is-open', open);
  document.getElementById('btn-active')?.setAttribute('aria-expanded', String(open));
  syncSleepUi();
  if (open) renderActiveSheet();
}

function formatSleepLeft(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clearSleepTimer() {
  sleepEndsAt = 0;
  sleepChosenMinutes = 0;
  if (sleepTick) {
    clearInterval(sleepTick);
    sleepTick = null;
  }
  syncSleepUi();
}

function finishSleepTimer() {
  clearSleepTimer();
  sleepMenuOpen = false;
  stopPlayback();
  showToast('Таймер сна: звук выключен');
}

function setSleepMinutes(mins) {
  const minutes = Number(mins) || 0;
  if (minutes <= 0) {
    clearSleepTimer();
    sleepMenuOpen = false;
    syncSleepUi();
    showToast('Таймер сна выключен');
    return;
  }

  sleepChosenMinutes = minutes;
  sleepEndsAt = Date.now() + minutes * 60 * 1000;
  if (sleepTick) clearInterval(sleepTick);
  sleepTick = setInterval(() => {
    if (Date.now() >= sleepEndsAt) {
      finishSleepTimer();
      return;
    }
    syncSleepUi();
  }, 1000);

  sleepMenuOpen = false;
  setSheetOpen(false);
  syncSleepUi();
  showToast(`Таймер сна: ${minutes} мин`);
}

function syncSleepUi() {
  const btn = document.getElementById('btn-sleep');
  const menu = document.getElementById('sleep-menu');
  const active = sleepEndsAt > Date.now();

  if (menu) {
    menu.classList.toggle('is-open', sleepMenuOpen);
    menu.setAttribute('aria-hidden', String(!sleepMenuOpen));
    menu.querySelectorAll('[data-sleep]').forEach((el) => {
      const v = Number(el.dataset.sleep);
      const on = active ? v === sleepChosenMinutes : v === 0;
      el.classList.toggle('is-on', on);
      el.tabIndex = sleepMenuOpen ? 0 : -1;
    });
  }

  if (!btn) return;
  btn.setAttribute('aria-expanded', String(sleepMenuOpen));
  btn.classList.toggle('is-expanded', sleepMenuOpen);
  btn.classList.toggle('is-on', active);

  const icon = btn.querySelector('.sleep-btn__icon');
  const time = btn.querySelector('.sleep-btn__time');

  if (active) {
    const left = formatSleepLeft(sleepEndsAt - Date.now());
    if (time) {
      time.hidden = false;
      time.textContent = left;
    }
    if (icon) icon.hidden = true;
    btn.setAttribute('aria-label', `Таймер сна: осталось ${left}`);
  } else {
    if (time) time.hidden = true;
    if (icon) icon.hidden = false;
    btn.setAttribute('aria-label', 'Таймер сна');
  }
}

const ACTIVE_LEAVE_MS = 280;

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setCardLoading(id, loading) {
  document.querySelectorAll(`.sound-card[data-id="${id}"]`).forEach((card) => {
    card.classList.toggle('is-loading', loading);
    card.setAttribute('aria-busy', String(loading));
  });
  document.querySelectorAll(`.sound-tile[data-id="${id}"]`).forEach((tile) => {
    tile.classList.toggle('is-loading', loading);
  });
}

async function toggleSound(id) {
  if (mixer.isLoading(id)) return;

  const turningOn = !mixer.isActive(id);
  if (turningOn) {
    const stored = await mixer.isStoredOffline(id);
    if (mixer.isLoading(id)) return;
    if (!navigator.onLine && !stored) {
      showToast('Нет сети. Этот звук ещё не сохранялся на устройство.');
      return;
    }
    if (!mixer.isPrepared(id)) setCardLoading(id, true);
  }

  try {
    await mixer.toggle(id);
    playingPresetId = null;
    const ids = mixer.getActiveIds();
    focusedSoundId = ids.length === 1 ? ids[0] : null;
  } finally {
    setCardLoading(id, false);
  }
  syncCard(id);
  updateChrome();
  renderActiveSheet();
  highlightFocusedSound();
  syncDocumentMeta({ history: 'replace' });
}

async function muteActiveItem(item, id) {
  if (item.classList.contains('is-leaving')) return;

  item.classList.add('is-leaving');
  const btn = item.querySelector('[data-off]');
  if (btn) btn.disabled = true;

  await mixer.toggle(id);
  playingPresetId = null;
  const ids = mixer.getActiveIds();
  focusedSoundId = ids.length === 1 ? ids[0] : null;
  syncCard(id);
  updateChrome();
  await waitMs(ACTIVE_LEAVE_MS);

  item.remove();
  if (mixer.activeCount() === 0) setSheetOpen(false);
  highlightFocusedSound();
  syncDocumentMeta({ history: 'replace' });
}

function renderActiveSheet() {
  const sheet = document.getElementById('active-sheet');
  if (!sheet) return;

  const ids = mixer.getActiveIds();
  if (!ids.length) {
    sheet.innerHTML = `<div class="active-sheet__empty">Нет активных звуков</div>`;
    return;
  }

  sheet.innerHTML = ids
    .map(
      (id) => `
      <div class="active-item" data-active-id="${id}">
        <span class="active-item__icon">${ICONS[id] || ICONS.ocean}</span>
        <p class="active-item__title">${titleById(id)}</p>
        <button type="button" class="active-item__off" data-off="${id}" aria-label="Выключить ${titleById(id)}">
          ${stopIcon()}
        </button>
      </div>
    `,
    )
    .join('');
}

function syncMasterUi(value, source) {
  mixer.setMasterVolume(value);
  const master = document.getElementById('master-volume');
  if (master && master !== source) master.value = String(value);
}

function bindAudioUnlock() {
  const unlock = () => mixer.unlock();
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('touchstart', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') mixer.unlock();
  });
  window.addEventListener('pageshow', unlock);
}

function bindViewportLock() {
  document.addEventListener(
    'gesturestart',
    (e) => {
      e.preventDefault();
    },
    { passive: false },
  );

  let startX = 0;
  let startY = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (e.target.closest('input[type="range"]')) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > dy && dx > 10) e.preventDefault();
    },
    { passive: false },
  );
}

function bindEvents() {
  if (bound) return;
  bound = true;
  bindAudioUnlock();
  bindViewportLock();
  bindDockScroll();
  bindRouting();

  document.body.addEventListener('click', async (e) => {
    const themeBtn = e.target.closest('[data-theme-set]');
    if (themeBtn?.dataset.themeSet) {
      applyTheme(themeBtn.dataset.themeSet);
      return;
    }

    if (e.target.closest('#btn-install')) {
      await installPwa();
      return;
    }

    if (e.target.closest('#btn-donate-open')) {
      openDonateSheet();
      return;
    }

    if (
      e.target.closest('#btn-donate-close') ||
      e.target.closest('#donate-sheet') === e.target
    ) {
      closeDonateSheet();
      return;
    }

    if (e.target.closest('#btn-copy-kaspi')) {
      await copyKaspiCard();
      return;
    }

    if (e.target.closest('#btn-install-ok') || e.target.closest('#install-sheet') === e.target) {
      hideInstallSheet();
      return;
    }

    if (e.target.closest('#btn-preset-add')) {
      openPresetBuilder();
      return;
    }

    if (
      e.target.closest('#btn-preset-close') ||
      e.target.closest('#btn-preset-cancel') ||
      e.target.closest('#preset-sheet') === e.target
    ) {
      closePresetBuilder();
      return;
    }

    if (e.target.closest('#btn-preset-save')) {
      createPresetFromDraft();
      return;
    }

    const pick = e.target.closest('[data-preset-pick]');
    if (pick?.dataset.presetPick) {
      togglePresetPick(pick.dataset.presetPick);
      return;
    }

    const favBtn = e.target.closest('[data-fav]');
    if (favBtn?.dataset.fav) {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.fav);
      return;
    }

    const presetDelete = e.target.closest('[data-preset-delete]');
    if (presetDelete?.dataset.presetDelete) {
      e.preventDefault();
      e.stopPropagation();
      askDeletePreset(presetDelete.dataset.presetDelete);
      return;
    }

    if (
      e.target.closest('#btn-delete-preset-cancel') ||
      e.target.closest('#delete-preset-sheet') === e.target
    ) {
      closeDeletePresetSheet();
      return;
    }

    if (e.target.closest('#btn-delete-preset-ok')) {
      confirmDeletePreset();
      return;
    }

    const presetPlay = e.target.closest('[data-preset-play]');
    if (presetPlay?.dataset.presetPlay) {
      await playPreset(presetPlay.dataset.presetPlay);
      return;
    }

    const soundLink = e.target.closest('[data-sound-href]');
    if (soundLink?.dataset.soundHref) {
      e.preventDefault();
      e.stopPropagation();
      openSoundPage(soundLink.dataset.soundHref);
      return;
    }

    const nav = e.target.closest('.nav-item, .topbar__brand[data-tab]');
    if (nav?.dataset.tab) {
      e.preventDefault();
      setTab(nav.dataset.tab);
      return;
    }

    if (e.target.closest('#btn-active')) {
      setSheetOpen(!sheetOpen);
      return;
    }

    if (e.target.closest('#btn-sleep')) {
      sleepMenuOpen = !sleepMenuOpen;
      if (sleepMenuOpen) {
        showDock();
        setSheetOpen(false);
      } else syncSleepUi();
      return;
    }

    const sleepOpt = e.target.closest('[data-sleep]');
    if (sleepOpt && sleepOpt.dataset.sleep != null) {
      setSleepMinutes(sleepOpt.dataset.sleep);
      return;
    }

    const off = e.target.closest('[data-off]');
    if (off) {
      const item = off.closest('.active-item');
      const id = off.dataset.off;
      if (item && mixer.isActive(id)) await muteActiveItem(item, id);
      return;
    }

    if (e.target.closest('#btn-play')) {
      if (mixer.activeCount() === 0) return;
      if (mixer.playing) mixer.pauseAll();
      else await mixer.resumeAll();
      updateChrome();
      return;
    }

    if (e.target.closest('#btn-stop')) {
      clearSleepTimer();
      sleepMenuOpen = false;
      stopPlayback();
      return;
    }

    if (e.target.matches('input[type="range"]')) return;

    const card = e.target.closest('.sound-card');
    if (card?.dataset.id) {
      void toggleSound(card.dataset.id);
    }
  });

  document.body.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.sound-card');
    if (!card || e.target.matches('input, button')) return;
    e.preventDefault();
    await toggleSound(card.dataset.id);
  });

  document.body.addEventListener('input', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.matches('#master-volume')) {
      syncMasterUi(Number(input.value), input);
      return;
    }
    if (input.matches('input[data-volume]')) {
      mixer.setTrackVolume(input.dataset.volume, Number(input.value));
      document
        .querySelectorAll(`input[data-volume="${input.dataset.volume}"]`)
        .forEach((el) => {
          if (el !== input) el.value = input.value;
        });
    }
  });

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!sheetOpen) return;
      const panel = document.getElementById('dock-panel');
      if (panel && !panel.contains(e.target)) setSheetOpen(false);
    },
    true,
  );
}

function syncCard(id) {
  const on = mixer.isActive(id);
  document.querySelectorAll(`.sound-tile[data-id="${id}"]`).forEach((tile) => {
    tile.classList.toggle('is-on', on);
  });
  document.querySelectorAll(`.sound-card[data-id="${id}"]`).forEach((card) => {
    card.classList.toggle('is-on', on);
    card.setAttribute('aria-pressed', String(on));
  });
}

function syncAllCards() {
  for (const s of mixer.getCatalog()) syncCard(s.id);
}

function updateChrome() {
  const count = mixer.activeCount();
  const countEl = document.getElementById('active-count');
  if (countEl) countEl.textContent = String(count);

  const meta = document.getElementById('btn-active');
  if (meta) {
    const live = count > 0;
    const playing = live && mixer.playing;
    meta.classList.toggle('is-live', live);
    meta.classList.toggle('is-playing', playing);
    meta.setAttribute(
      'aria-label',
      live
        ? playing
          ? `${count} активных, играет`
          : `${count} активных, пауза`
        : 'Нет активных звуков',
    );
  }

  const btn = document.getElementById('btn-play');
  if (btn) {
    if (mixer.playing) {
      btn.innerHTML = pauseIcon();
      btn.setAttribute('aria-label', 'Пауза');
    } else {
      btn.innerHTML = playIcon();
      btn.setAttribute('aria-label', 'Продолжить');
    }
  }

  syncSleepUi();
}

applyTheme(currentTheme);
bindEvents();
render();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.update();
  });
}
if (focusedSoundId) {
  requestAnimationFrame(() => {
    document.querySelector(`.sound-tile[data-id="${focusedSoundId}"]`)?.scrollIntoView({
      block: 'center',
    });
  });
}
