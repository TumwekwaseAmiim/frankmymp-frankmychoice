import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, {
  recursive: true,
  force: true
});

fs.mkdirSync(dist, {
  recursive: true
});

// ==========================================
// COPY PUBLIC WEBSITE FILES
// ==========================================

for (const name of [
  'index.html',
  'post.html',
  'assets',
  'css',
  'js',
  'admin',
  'manifest.webmanifest'
]) {
  const from = path.join(root, name);

  if (fs.existsSync(from)) {
    fs.cpSync(from, path.join(dist, name), {
      recursive: true
    });
  }
}

// ==========================================
// SITE SETTINGS
// ==========================================

const base = (
  process.env.SITE_URL || ''
).replace(/\/$/, '');

const domain =
  process.env.SITE_DOMAIN || '';

if (domain) {
  fs.writeFileSync(
    path.join(dist, 'CNAME'),
    domain.trim()
  );
}

// ==========================================
// HELPERS
// ==========================================

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(url) {
  if (!url) return '';

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!base) return url;

  return base + (
    url.startsWith('/') ? url : '/' + url
  );
}

function firstImageUrl(post) {
  const images = Array.isArray(post?.images)
    ? post.images
    : [];

  for (const item of images) {
    if (
      typeof item === 'string' &&
      /^https?:\/\//i.test(item)
    ) {
      return item;
    }

    const candidate =
      item?.url ||
      item?.secure_url ||
      item?.src ||
      '';

    if (
      typeof candidate === 'string' &&
      /^https?:\/\//i.test(candidate)
    ) {
      return candidate;
    }
  }

  return absoluteUrl('/assets/placeholder.svg');
}

function shortDescription(post) {
  const raw =
    post?.excerpt ||
    post?.summary ||
    post?.content ||
    'Latest public update from #FrankMyMP #FrankMyChoice.';

  const cleaned = String(raw)
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 160
    ? cleaned.slice(0, 157) + '...'
    : cleaned;
}

function isRecent(post) {
  const publishedMs =
    post?.publishedAt?.toMillis?.() ||
    post?.createdAt?.toMillis?.() ||
    0;

  if (!publishedMs) return false;
  if (publishedMs > Date.now()) return false;

  const TEN_DAYS_MS =
    10 * 24 * 60 * 60 * 1000;

  return (
    Date.now() - publishedMs < TEN_DAYS_MS
  );
}

// ==========================================
// IF NO FIREBASE SECRET, JUST DEPLOY SITE
// ==========================================

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.warn(
    'No Firebase service credentials: deployed homepage, no prerendered stories.'
  );
  process.exit(0);
}

// ==========================================
// BUILD ARTICLE PREVIEW PAGES
// ==========================================

try {
  const account = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  admin.initializeApp({
    credential: admin.credential.cert(account)
  });

  const snapshot = await admin
    .firestore()
    .collection('posts')
    .where('status', '==', 'published')
    .get();

  const sitemap = ['/'];

  const template = fs.readFileSync(
    path.join(root, 'post.html'),
    'utf8'
  );

  for (const doc of snapshot.docs) {
    const post = doc.data();
    const slug = doc.id;

    if (!isRecent(post)) continue;

    if (!/^[-a-z0-9]{1,160}$/i.test(slug)) {
      continue;
    }

    const titleText =
      post?.title ||
      'News Update';

    const pageTitle =
      esc(titleText) +
      ' | #FrankMyMP #FrankMyChoice';

    const description =
      esc(shortDescription(post));

    const url =
      base +
      '/post/' +
      encodeURIComponent(slug) +
      '/';

    const image =
      esc(firstImageUrl(post));

    const headBlock = `
<title>${pageTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${esc(url)}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="#FrankMyMP #FrankMyChoice">
<meta property="og:title" content="${pageTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${image}">
<meta property="og:image:secure_url" content="${image}">
<meta property="og:image:alt" content="${esc(titleText)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
`.trim();

    const page = template.replace(
      /<title>[\s\S]*?<\/title>[\s\S]*?<link[\s\S]*?href="\/css\/style\.css"\s*>/i,
      `${headBlock}\n\n  <link rel="stylesheet" href="/css/style.css">`
    );

    const folder = path.join(
      dist,
      'post',
      slug
    );

    fs.mkdirSync(folder, {
      recursive: true
    });

    fs.writeFileSync(
      path.join(folder, 'index.html'),
      page
    );

    sitemap.push('/post/' + slug + '/');
  }

  if (base) {
    const sitemapXml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      sitemap
        .map(
          url =>
            '<url><loc>' +
            esc(base + url) +
            '</loc></url>'
        )
        .join('') +
      '</urlset>';

    fs.writeFileSync(
      path.join(dist, 'sitemap.xml'),
      sitemapXml
    );
  }

  console.log(
    'Built article preview pages successfully.'
  );
} catch (error) {
  console.error('Build failed:', error);
  process.exitCode = 1;
}