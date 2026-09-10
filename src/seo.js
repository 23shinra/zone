import { SOUND_CATALOG, getSoundById, soundPagePath } from './sounds.js';

export const SITE_NAME = 'Белый шум';
export const BASE_DESCRIPTION = 'Спокойные звуки. Наложи несколько — слушай свой микс.';
export const OG_IMAGE_PATH = '/icons/icon-512.png';

export function siteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://zone.esl.kz';
}

function joinTitles(titles) {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} и ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} и ${titles.at(-1)}`;
}

function absUrl(path) {
  return new URL(path, `${siteOrigin()}/`).href;
}

function ensureMeta(selector, attrs) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== 'content') el.setAttribute(key, value);
    }
    document.head.appendChild(el);
  }
  return el;
}

function setNamedMeta(name, content) {
  const el = ensureMeta(`meta[name="${name}"]`, { name });
  el.setAttribute('content', content);
}

function setPropertyMeta(property, content) {
  const el = ensureMeta(`meta[property="${property}"]`, { property });
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(data) {
  let el = document.getElementById('schema-ld');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'schema-ld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function webApplicationNode() {
  const origin = siteOrigin();
  return {
    '@type': ['WebApplication', 'SoftwareApplication'],
    '@id': `${origin}/#app`,
    name: SITE_NAME,
    alternateName: 'Зона',
    url: `${origin}/`,
    description: BASE_DESCRIPTION,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    inLanguage: 'ru',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    image: absUrl(OG_IMAGE_PATH),
    screenshot: absUrl(OG_IMAGE_PATH),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KZT',
    },
    featureList: [
      'Микшер звуков природы',
      'Пресеты и избранное',
      'Таймер сна',
      'Офлайн PWA',
    ],
  };
}

function audioObjectNode(sound) {
  const origin = siteOrigin();
  const path = soundPagePath(sound);
  return {
    '@type': 'AudioObject',
    '@id': `${origin}${path}#sound`,
    name: sound.title,
    description: sound.description,
    url: absUrl(path),
    encodingFormat: 'audio/mpeg',
    inLanguage: 'ru',
    isPartOf: { '@id': `${origin}/#app` },
  };
}

function soundsItemListNode() {
  return {
    '@type': 'ItemList',
    '@id': `${siteOrigin()}/#sounds`,
    name: 'Звуки природы',
    numberOfItems: SOUND_CATALOG.length,
    itemListElement: SOUND_CATALOG.map((sound, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absUrl(soundPagePath(sound)),
      name: sound.title,
      item: audioObjectNode(sound),
    })),
  };
}

function breadcrumbNode(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

/**
 * @param {{
 *   tab: 'sounds' | 'favorites' | 'settings',
 *   activeSounds: typeof SOUND_CATALOG,
 *   focusedSound: (typeof SOUND_CATALOG)[number] | null,
 *   preset: { name: string, sounds: { id: string }[] } | null,
 * }} state
 */
export function buildPageSeo(state) {
  const { tab, activeSounds, focusedSound, preset } = state;
  const origin = siteOrigin();

  let title = `Звуки природы · ${SITE_NAME}`;
  let description = BASE_DESCRIPTION;
  let path = '/sounds';
  /** @type {object | null} */
  let extraEntity = null;
  /** @type {{ name: string, path: string }[]} */
  let crumbs = [
    { name: SITE_NAME, path: '/' },
    { name: 'Звуки', path: '/sounds' },
  ];

  if (tab === 'settings') {
    title = `Настройки · ${SITE_NAME}`;
    description = 'Тема оформления и установка Белого шума на экран. PWA для спокойных звуков природы.';
    path = '/settings';
    crumbs = [
      { name: SITE_NAME, path: '/' },
      { name: 'Настройки', path: '/settings' },
    ];
  } else if (tab === 'favorites') {
    path = '/favorites';
    crumbs = [
      { name: SITE_NAME, path: '/' },
      { name: 'Избранное', path: '/favorites' },
    ];
    if (preset) {
      const names = preset.sounds
        .map((layer) => getSoundById(layer.id)?.title)
        .filter(Boolean);
      const mix = joinTitles(names);
      title = `${preset.name} — пресет · ${SITE_NAME}`;
      description = mix
        ? `Пресет «${preset.name}»: ${mix}. Сохранённый микс спокойных звуков в Белом шуме.`
        : `Пресет «${preset.name}». Сохранённый микс спокойных звуков в Белом шуме.`;
    } else {
      title = `Избранное · ${SITE_NAME}`;
      description = 'Избранные звуки и пресеты. Соберите свой микс белого шума и слушайте офлайн.';
    }
  } else if (activeSounds.length > 1) {
    const mix = joinTitles(activeSounds.map((s) => s.title));
    title = `${mix} — микс · ${SITE_NAME}`;
    description = `Микс: ${mix}. Наложите свои слои в микшере Белый шум и слушайте уникальную зону.`;
    path = '/sounds';
  } else {
    const sound = activeSounds[0] ?? focusedSound;
    if (sound) {
      title = `${sound.title} — белый шум для сна · ${SITE_NAME}`;
      description = sound.description;
      path = soundPagePath(sound);
      extraEntity = audioObjectNode(sound);
      crumbs.push({ name: sound.title, path });
    }
  }

  const list = soundsItemListNode();
  const app = webApplicationNode();
  app.mainEntity = extraEntity ? { '@id': extraEntity['@id'] } : { '@id': list['@id'] };

  const graph = [app, list, breadcrumbNode(crumbs)];
  if (extraEntity) graph.push(extraEntity);

  return {
    title,
    description,
    path,
    canonical: absUrl(path),
    image: absUrl(OG_IMAGE_PATH),
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export function applyPageSeo(page) {
  document.title = page.title;
  setNamedMeta('description', page.description);
  setNamedMeta('twitter:card', 'summary');
  setNamedMeta('twitter:title', page.title);
  setNamedMeta('twitter:description', page.description);
  setNamedMeta('twitter:image', page.image);
  setPropertyMeta('og:type', 'website');
  setPropertyMeta('og:site_name', SITE_NAME);
  setPropertyMeta('og:locale', 'ru_RU');
  setPropertyMeta('og:title', page.title);
  setPropertyMeta('og:description', page.description);
  setPropertyMeta('og:url', page.canonical);
  setPropertyMeta('og:image', page.image);
  setCanonical(page.canonical);
  setJsonLd(page.jsonLd);
}
