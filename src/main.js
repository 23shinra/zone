import './style.css';
import { SoundMixer } from './mixer.js';

const mixer = new SoundMixer();

function svg(body, { filled = false, sizeClass = 'sound-card__icon' } = {}) {
  const fill = filled ? 'currentColor' : 'none';
  const stroke = filled ? 'none' : 'currentColor';
  const sw = filled ? '' : ' stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="${sizeClass}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}"${sw} aria-hidden="true">${body}</svg>`;
}

const ICONS = {
  // equal bars — balanced / pink-ish noise
  balanced: svg(
    '<rect x="4" y="10" width="3" height="8" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="17" y="8" width="3" height="10" rx="1"/>',
  ),
  // sun — bright noise
  bright: svg(
    '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"/>',
  ),
  // crescent — dark noise
  dark: svg(
    '<path d="M19 13.2A7 7 0 1 1 10.8 5 5.5 5.5 0 0 0 19 13.2z"/>',
  ),
  // waves — ocean
  ocean: svg(
    '<path d="M3 9c2.2 0 2.2 2 4.4 2S9.6 9 11.8 9s2.2 2 4.4 2S18.4 9 21 9"/><path d="M3 14c2.2 0 2.2 2 4.4 2s2.2-2 4.4-2 2.2 2 4.4 2 2.2-2 4.8-2"/>',
  ),
  // cloud + drops — rain
  rain: svg(
    '<path d="M7.2 16H17a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5-1.2A3.8 3.8 0 0 0 7.2 16z"/><path d="M9 19v2M12.5 19v2M16 19v2"/>',
  ),
  // flowing lines — stream
  stream: svg(
    '<path d="M4 8c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/><path d="M4 12.5c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/><path d="M4 17c2.5 2.5 5.5 2.5 8 0s5.5-2.5 8 0"/>',
  ),
  // moon + star — night
  night: svg(
    '<path d="M14.5 4.2A6.5 6.5 0 1 0 19.8 14 5 5 0 0 1 14.5 4.2z"/><path d="M7.2 6.2l.55 1.5 1.55.05-1.2 1 .4 1.5-1.3-.85-1.3.85.4-1.5-1.2-1 1.55-.05z"/>',
  ),
  // flame — fire
  fire: svg(
    '<path d="M12 3.5c1.8 2.4.2 3.8 1.4 5.8 1.1 1.8 3.1 2.2 3.1 5.2a4.5 4.5 0 0 1-9 0c0-2.4 1.4-3.6 2.4-5.4C11.2 7.2 10.2 5.8 12 3.5z"/><path d="M12 18.5c1.4 0 2.4-1 2.4-2.3 0-1.2-.8-1.8-2.4-3.2-1.6 1.4-2.4 2-2.4 3.2 0 1.3 1 2.3 2.4 2.3z"/>',
  ),
  // speech bubbles — chatter
  chatter: svg(
    '<path d="M4.5 6.5h9a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9l-3 2.2V14.5h-1.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/><path d="M11.5 15.5h3.5l2.5 1.8V15.5H18a1.8 1.8 0 0 0 1.8-1.8V11"/>',
  ),
  // rising vapor — steam
  steam: svg(
    '<path d="M8 20h8"/><path d="M9 17c0-1.6 1.2-2.4 1.2-4S9 10.6 9 9"/><path d="M12 17c0-1.6 1.2-2.4 1.2-4S12 10.6 12 9"/><path d="M15 17c0-1.6 1.2-2.4 1.2-4S15 10.6 15 9"/><path d="M9.5 7.5c0-1.2.9-1.8.9-3"/><path d="M14.5 7.5c0-1.2.9-1.8.9-3"/>',
  ),
  // airplane
  plane: svg(
    '<path d="M10.5 13.5 4 11.2l1.2-1.5 5.8 1.1L17.5 4l1.8.9-2.2 7.8 4.4 2.1-.9 1.4-5.5-1.2L11.5 20l-1.6-.7 1.2-4.3-2.6-1.2z"/>',
  ),
  // sailboat
  boat: svg(
    '<path d="M3.5 16.5h17"/><path d="M5 16.5c1.2 2.2 3.8 3.5 7 3.5s5.8-1.3 7-3.5"/><path d="M12 4v12.5"/><path d="M12 5.5 18 14H12z"/><path d="M12 8 7.5 14H12"/>',
  ),
  // bus
  bus: svg(
    '<rect x="3.5" y="5" width="17" height="11" rx="2.5"/><path d="M3.5 12h17"/><path d="M7 16v2.5M17 16v2.5"/><circle cx="7.5" cy="9.2" r="1"/><circle cx="12" cy="9.2" r="1"/><circle cx="16.5" cy="9.2" r="1"/>',
  ),
  // train
  train: svg(
    '<rect x="5" y="3.5" width="14" height="12.5" rx="2.5"/><path d="M5 10h14"/><path d="M8.5 16l-2 3.5M15.5 16l2 3.5"/><path d="M9 20.5h6"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
  ),
  // house + rain — rain on roof
  roof: svg(
    '<path d="M4 12.5 12 5l8 7.5"/><path d="M7 11.5V19h10v-7.5"/><path d="M9.5 16.5v2M12 16.5v2M14.5 16.5v2"/>',
  ),
  // soft moon disc — quiet night
  quiet: svg(
    '<circle cx="12" cy="12" r="7.5"/><path d="M12 8.5v3.2l2 1.3"/>',
  ),
};

function checkIcon() {
  return svg('<path d="M5 12.5 9.5 17 19 7.5"/>', { sizeClass: '' });
}

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

function speakerLow() {
  return svg(
    '<path d="M4.5 9.5v5h3.2L12 18.5v-13l-4.3 4H4.5z"/>',
    { sizeClass: '' },
  );
}

function speakerHigh() {
  return svg(
    '<path d="M4.5 9.5v5h3.2L12 18.5v-13l-4.3 4H4.5z"/><path d="M15.2 9.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.4 6.8a6.2 6.2 0 0 1 0 10.4"/>',
    { sizeClass: '' },
  );
}

function render() {
  const app = document.querySelector('#app');
  const sounds = mixer.getCatalog();

  app.innerHTML = `
    <div class="ambient" aria-hidden="true"></div>
    <div class="app-shell">
      <header class="header">
        <h1 class="brand">Зона</h1>
        <span class="badge" id="mix-badge">микс</span>
      </header>
      <div class="sound-grid" id="sound-grid" role="list">
        ${sounds
          .map(
            (s, i) => `
          <button
            type="button"
            class="sound-card"
            role="listitem"
            data-id="${s.id}"
            style="--i:${i}"
            aria-pressed="false"
          >
            <div class="sound-card__top">
              ${ICONS[s.id] || ICONS.balanced}
              <span class="sound-card__check">${checkIcon()}</span>
            </div>
            <p class="sound-card__title">${s.title}</p>
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
          </button>
        `,
          )
          .join('')}
      </div>
    </div>
    <div class="dock">
      <div class="dock__panel">
        <div class="dock__row">
          <div class="dock__meta"><strong id="active-count">0</strong> активных</div>
          <div class="controls">
            <button type="button" class="btn" id="btn-stop" aria-label="Стоп" title="Стоп">
              ${stopIcon()}
            </button>
            <button type="button" class="btn btn--primary" id="btn-play" aria-label="Пауза" title="Пауза / продолжить">
              ${pauseIcon()}
            </button>
          </div>
        </div>
        <div class="master">
          ${speakerLow()}
          <input type="range" id="master-volume" min="0" max="1" step="0.01" value="0.85" aria-label="Общая громкость" />
          ${speakerHigh()}
        </div>
      </div>
      <p class="install-hint" id="install-hint">Добавь на экран «Домой» — откроется как приложение</p>
    </div>
  `;

  bindEvents();
  updateChrome();
}

function bindEvents() {
  const grid = document.getElementById('sound-grid');

  grid.addEventListener('click', async (e) => {
    const card = e.target.closest('.sound-card');
    if (!card) return;
    if (e.target.matches('input[type="range"]')) return;

    const id = card.dataset.id;
    await mixer.toggle(id);
    syncCard(id);
    updateChrome();
  });

  grid.addEventListener('input', (e) => {
    const input = e.target;
    if (!input.matches('input[data-volume]')) return;
    e.stopPropagation();
    mixer.setTrackVolume(input.dataset.volume, Number(input.value));
  });

  // Prevent card toggle when interacting with slider
  grid.addEventListener(
    'pointerdown',
    (e) => {
      if (e.target.matches('input[data-volume]')) e.stopPropagation();
    },
    true,
  );

  document.getElementById('btn-play').addEventListener('click', async () => {
    if (mixer.activeCount() === 0) return;
    if (mixer.playing) {
      mixer.pauseAll();
    } else {
      await mixer.resumeAll();
    }
    updateChrome();
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    mixer.stopAll();
    for (const s of mixer.getCatalog()) syncCard(s.id);
    updateChrome();
  });

  document.getElementById('master-volume').addEventListener('input', (e) => {
    mixer.setMasterVolume(Number(e.target.value));
  });
}

function syncCard(id) {
  const card = document.querySelector(`.sound-card[data-id="${id}"]`);
  if (!card) return;
  const on = mixer.isActive(id);
  card.classList.toggle('is-on', on);
  card.setAttribute('aria-pressed', String(on));
}

function updateChrome() {
  const count = mixer.activeCount();
  document.getElementById('active-count').textContent = String(count);

  const btn = document.getElementById('btn-play');
  if (mixer.playing) {
    btn.innerHTML = pauseIcon();
    btn.setAttribute('aria-label', 'Пауза');
  } else {
    btn.innerHTML = playIcon();
    btn.setAttribute('aria-label', 'Продолжить');
  }

  const badge = document.getElementById('mix-badge');
  badge.textContent = count > 1 ? `${count} слоя` : count === 1 ? '1 слой' : 'микс';
}

// iOS / install hint
function maybeShowInstallHint() {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (!isStandalone && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    document.getElementById('install-hint')?.classList.add('is-visible');
  }
}

render();
maybeShowInstallHint();

if ('serviceWorker' in navigator) {
  // vite-plugin-pwa injects registration in production build
}
