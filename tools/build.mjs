import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE_URL = (process.env.SITE_URL || 'https://frankmymp-frankmychoice.pages.dev').replace(/\/+$/, '');
const SITE_NAME = '#FrankMyMP #FrankMyChoice';
const DESCRIPTION = 'Latest news and development updates from Rwamwanja, Kamwenge, Uganda.';
const TEN_DAYS_MS = 10 * 86400000;

const htmlEscape = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const excerpt = (value, n=160) => {
  const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length <= n ? text : text.slice(0,n-1).replace(/\s+\S*$/, '').trim() + '…';
};
function timestamp(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  return 0;
}
function imageUrl(post) {
  for (const item of Array.isArray(post.images) ? post.images : []) {
    const src = typeof item === 'string' ? item : (item?.secure_url || item?.url || item?.src || '');
    if (typeof src === 'string' && /^https:\/\//i.test(src.trim())) return src.trim();
  }
  return '';
}
function socialMeta(data) {
  const title = htmlEscape(data.title), desc = htmlEscape(data.description), url = htmlEscape(data.url), img = htmlEscape(data.image || '');
  return `\n<title>${title}</title>\n<meta name="description" content="${desc}">\n<meta property="og:site_name" content="${htmlEscape(SITE_NAME)}">\n<meta property="og:type" content="${data.type}">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${desc}">\n<meta property="og:url" content="${url}">\n${img ? `<meta property="og:image" content="${img}">\n<meta property="og:image:secure_url" content="${img}">\n<meta property="og:image:alt" content="${title}">\n<meta name="twitter:image" content="${img}">` : ''}\n<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">\n<meta name="twitter:title" content="${title}">\n<meta name="twitter:description" content="${desc}">\n<link rel="canonical" href="${url}">\n`;
}
function inject(html, meta) {
  // Strip stale OG, Twitter, canonical, and document title before injecting authoritative new values.
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '');
  html = html.replace(/<meta\b[^>]*>/gi, tag => {
    const match = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i);
    const prop = match?.[1]?.toLowerCase() || '';
    return prop === 'description' || prop.startsWith('og:') || prop.startsWith('twitter:') ? '' : tag;
  });
  html = html.replace(/<link\b[^>]*>/gi, tag => /\brel\s*=\s*["']canonical["']/i.test(tag) ? '' : tag);
  if (!/<\/head>/i.test(html)) throw new Error('Missing closing head in HTML template');
  return html.replace(/<\/head>/i, `${socialMeta(meta)}\n</head>`);
}

fs.rmSync(DIST, {recursive:true, force:true});
fs.mkdirSync(DIST, {recursive:true});
for (const item of ['index.html','post.html','manifest.webmanifest','sw.js','assets','css','js','admin']) {
  const src = path.join(ROOT,item);
  if (!fs.existsSync(src)) throw new Error(`Missing essential website file: ${item}`);
  fs.cpSync(src, path.join(DIST,item), {recursive:true});
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  if (process.env.BUILD_WITHOUT_FIREBASE === '1') {
    console.warn('Local diagnostic build only: Firebase previews were not generated.');
    process.exit(0);
  }
  throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON as a Cloudflare Pages build secret; refusing to publish missing news previews.');
}
const {default: admin} = await import('firebase-admin');
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!admin.apps.length) admin.initializeApp({credential:admin.credential.cert(credentials)});
const snapshot = await admin.firestore().collection('posts').where('status','==','published').get();
const now = Date.now();
const posts = snapshot.docs.map(doc => ({...doc.data(), id:doc.id})).filter(post => {
  const ms = timestamp(post.publishedAt || post.createdAt);
  return ms > 0 && ms <= now && now-ms < TEN_DAYS_MS;
}).sort((a,b) => timestamp(b.publishedAt || b.createdAt) - timestamp(a.publishedAt || a.createdAt));

const featured = posts.find(p => imageUrl(p));
const homeMeta = featured ? {
  title: excerpt(featured.title || SITE_NAME,110),
  description: excerpt(featured.excerpt || featured.body || DESCRIPTION,150),
  image: imageUrl(featured),url:`${SITE_URL}/`,type:'website'
} : {title:SITE_NAME, description:DESCRIPTION, image:'',url:`${SITE_URL}/`,type:'website'};
fs.writeFileSync(path.join(DIST,'index.html'),inject(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),homeMeta));
const articleTemplate = fs.readFileSync(path.join(ROOT,'post.html'),'utf8');
const urls = ['/'];
let count=0, withPhoto=0;
for (const post of posts) {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(post.id)) { console.warn('Skipped unsupported post ID',post.id); continue; }
  const url = `${SITE_URL}/post/${encodeURIComponent(post.id)}/`;
  const photo = imageUrl(post);
  const html = inject(articleTemplate, {
    title:excerpt(post.title || 'News Update',115),
    description:excerpt(post.excerpt || post.body || DESCRIPTION,160),
    image:photo,url,type:'article'
  });
  const dir = path.join(DIST,'post',post.id); fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),html);
  urls.push(`/post/${encodeURIComponent(post.id)}/`);
  count++; if(photo) withPhoto++;
  console.log(`Generated ${post.id}: ${photo ? 'image included' : 'NO IMAGE IN ARTICLE'}`);
}
fs.writeFileSync(path.join(DIST,'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${htmlEscape(SITE_URL+u)}</loc></url>`).join('')+'</urlset>');
console.log(`Build finished: ${count} articles; ${withPhoto} with photos. Homepage photo: ${homeMeta.image || '(none)'}`);
