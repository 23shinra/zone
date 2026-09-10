import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://zone.esl.kz';
const image = `${origin}/icons/icon-512.png`;

function parseCatalog(src) {
  const blocks = [
    ...src.matchAll(
      /\{ id: '([^']+)', title: '([^']+)', kind: '[^']+', category: '[^']+', slug: '([^']+)', description: '([^']+)' \}/g,
    ),
  ];
  return blocks.map(([, id, title, slug, description]) => ({ id, title, slug, description }));
}

function escapeAttr(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function replaceAttr(html, attr, value) {
  const encoded = escapeAttr(value);
  const nameRe = new RegExp(`(<meta\\s+name="${attr}"\\s+content=")[^"]*(")`);
  const propRe = new RegExp(`(<meta\\s+property="${attr}"\\s+content=")[^"]*(")`);
  if (nameRe.test(html)) return html.replace(nameRe, `$1${encoded}$2`);
  if (propRe.test(html)) return html.replace(propRe, `$1${encoded}$2`);
  return html;
}

function replaceTag(html, tag, value) {
  const re = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`);
  return html.replace(re, `$1${value}$3`);
}

function applyPageMeta(template, { title, description, url, jsonLd }) {
  let html = template;
  html = replaceTag(html, 'title', escapeAttr(title));
  html = replaceAttr(html, 'description', description);
  html = replaceAttr(html, 'og:title', title);
  html = replaceAttr(html, 'og:description', description);
  html = replaceAttr(html, 'og:url', url);
  html = replaceAttr(html, 'twitter:title', title);
  html = replaceAttr(html, 'twitter:description', description);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeAttr(url)}$2`);
  if (jsonLd) {
    html = html.replace(
      /(<script type="application\/ld\+json" id="schema-ld">)([\s\S]*?)(<\/script>)/,
      `$1${JSON.stringify(jsonLd)}$3`,
    );
  }
  return html;
}

function jsonLdSound(sound) {
  const url = `${origin}/sounds/${sound.id}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['WebApplication', 'SoftwareApplication'],
        '@id': `${origin}/#app`,
        name: 'Белый шум',
        alternateName: 'Зона',
        url: `${origin}/`,
        description: 'Спокойные звуки. Наложи несколько — слушай свой микс.',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        inLanguage: 'ru',
        image,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'KZT' },
        mainEntity: { '@id': `${url}#sound` },
      },
      {
        '@type': 'AudioObject',
        '@id': `${url}#sound`,
        name: sound.title,
        description: sound.description,
        url,
        encodingFormat: 'audio/mpeg',
        inLanguage: 'ru',
        isPartOf: { '@id': `${origin}/#app` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Белый шум', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: 'Sounds', item: `${origin}/sounds` },
          { '@type': 'ListItem', position: 3, name: sound.title, item: url },
        ],
      },
    ],
  };
}

function loc(path) {
  return origin + path.split('/').map((seg) => (seg ? encodeURIComponent(seg) : '')).join('/');
}

function writeSitemap(catalog) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/sounds', changefreq: 'weekly', priority: '0.9' },
    { path: '/favorites', changefreq: 'weekly', priority: '0.7' },
    { path: '/settings', changefreq: 'monthly', priority: '0.5' },
    ...catalog.map((s) => ({
      path: `/sounds/${s.id}`,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (p) => `  <url>
    <loc>${loc(p.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  writeFileSync(join(root, 'public/sitemap.xml'), xml);
  writeFileSync(join(root, 'dist/sitemap.xml'), xml);
}

function redirectHtml(to) {
  const abs = `${origin}${to}`;
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${to}" />
    <link rel="canonical" href="${escapeAttr(abs)}" />
    <title>Redirect</title>
    <script>location.replace(${JSON.stringify(to)});</script>
  </head>
  <body>
    <a href="${to}">Continue</a>
  </body>
</html>
`;
}

const catalog = parseCatalog(readFileSync(join(root, 'src/sounds.js'), 'utf8'));
if (catalog.length < 20) {
  throw new Error(`SEO pages: expected catalog, got ${catalog.length}`);
}

const template = readFileSync(join(root, 'dist/index.html'), 'utf8');

const tabs = [
  {
    file: 'sounds.html',
    title: 'Звуки природы · Белый шум',
    description: 'Спокойные звуки. Наложи несколько — слушай свой микс.',
    url: `${origin}/sounds`,
  },
  {
    file: 'favorites.html',
    title: 'Избранное · Белый шум',
    description: 'Избранные звуки и пресеты. Соберите свой микс белого шума и слушайте офлайн.',
    url: `${origin}/favorites`,
  },
  {
    file: 'settings.html',
    title: 'Настройки · Белый шум',
    description: 'Тема оформления и установка Белого шума на экран. PWA для спокойных звуков природы.',
    url: `${origin}/settings`,
  },
];

for (const tab of tabs) {
  writeFileSync(
    join(root, 'dist', tab.file),
    applyPageMeta(template, {
      title: tab.title,
      description: tab.description,
      url: tab.url,
    }),
  );
}

mkdirSync(join(root, 'dist/sounds'), { recursive: true });
for (const sound of catalog) {
  const url = `${origin}/sounds/${sound.id}`;
  const title = `${sound.title} — белый шум для сна · Белый шум`;
  writeFileSync(
    join(root, 'dist/sounds', `${sound.id}.html`),
    applyPageMeta(template, {
      title,
      description: sound.description,
      url,
      jsonLd: jsonLdSound(sound),
    }),
  );
}

rmSync(join(root, 'dist/звуки'), { recursive: true, force: true });
mkdirSync(join(root, 'dist/звуки'), { recursive: true });
writeFileSync(join(root, 'dist/звуки.html'), redirectHtml('/sounds'));
writeFileSync(join(root, 'dist/избранное.html'), redirectHtml('/favorites'));
writeFileSync(join(root, 'dist/настройки.html'), redirectHtml('/settings'));
for (const sound of catalog) {
  writeFileSync(join(root, 'dist/звуки', `${sound.slug}.html`), redirectHtml(`/sounds/${sound.id}`));
}

writeSitemap(catalog);
console.log(`SEO pages: ${catalog.length} sound URLs → /sounds/{id}`);
