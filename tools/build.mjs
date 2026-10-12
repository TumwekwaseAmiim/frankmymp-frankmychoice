
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");

const SITE_URL = (
  process.env.SITE_URL ||
  "https://frankmymp-frankmychoice.pages.dev"
).replace(/\/+$/, "");

const SITE_TITLE = "#FrankMyMP #FrankMyChoice";

const DEFAULT_DESCRIPTION =
  "Latest news and development updates from Rwamwanja, Kamwenge, Uganda.";

const TEN_DAYS = 10 * 24 * 60 * 60 * 1000;

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortText(value, max = 140) {
  const text = plainText(value);

  if (text.length <= max) return text;

  return (
    text.slice(0, max - 1)
      .replace(/\s+\S*$/, "")
      .trimEnd() + "…"
  );
}

function timestampMillis(value) {
  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Date.parse(value) || 0;
  }

  return 0;
}

function firstImage(post) {
  const images = Array.isArray(post.images)
    ? post.images
    : [];

  for (const image of images) {
    const url = typeof image === "string"
      ? image
      : image?.url ||
        image?.secure_url ||
        image?.src;

    if (
      typeof url === "string" &&
      /^https:\/\//i.test(url)
    ) {
      return url;
    }
  }

  return "";
}

function removeExistingSocialTags(html) {
  const socialNames = [
    "description",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image"
  ];

  const socialProperties = [
    "og:title",
    "og:description",
    "og:image",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
    "og:type",
    "og:url",
    "og:site_name"
  ];

  html = html.replace(
    /<meta\b[^>]*>/gi,
    tag => {
      const attr = tag.match(
        /\b(name|property)\s*=\s*["']([^"']+)["']/i
      );

      if (!attr) return tag;

      const type = attr[1].toLowerCase();
      const name = attr[2].toLowerCase();

      if (
        type === "name" &&
        socialNames.includes(name)
      ) {
        return "";
      }

      if (
        type === "property" &&
        socialProperties.includes(name)
      ) {
        return "";
      }

      return tag;
    }
  );

  html = html.replace(
    /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi,
    ""
  );

  return html;
}

function createSocialHead({
  title,
  description,
  image,
  url,
  type = "website"
}) {
  const t = escapeHTML(title);
  const d = escapeHTML(description);
  const u = escapeHTML(url);

  const imageTags = image
    ? `
  <meta property="og:image"
        content="${escapeHTML(image)}">
  <meta property="og:image:alt"
        content="${t}">
  <meta name="twitter:image"
        content="${escapeHTML(image)}">`
    : "";

  return `
  <!-- Generated news sharing metadata -->

  <title>${t}</title>

  <meta name="description"
        content="${d}">

  <meta property="og:type"
        content="${escapeHTML(type)}">

  <meta property="og:site_name"
        content="${escapeHTML(SITE_TITLE)}">

  <meta property="og:title"
        content="${t}">

  <meta property="og:description"
        content="${d}">

  <meta property="og:url"
        content="${u}">

  ${imageTags}

  <meta name="twitter:card"
        content="${image ? "summary_large_image" : "summary"}">

  <meta name="twitter:title"
        content="${t}">

  <meta name="twitter:description"
        content="${d}">

  <link rel="canonical" href="${u}">
`;
}

function injectSocialHead(html, data) {
  html = removeExistingSocialTags(html);

  html = html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/i,
    ""
  );

  if (!/<\/head>/i.test(html)) {
    throw new Error("HTML document has no closing head tag.");
  }

  return html.replace(
    /<\/head>/i,
    `${createSocialHead(data)}\n</head>`
  );
}

// ==========================================
// PREPARE PUBLISHING FOLDER
// ==========================================

fs.rmSync(dist, {
  recursive: true,
  force: true
});

fs.mkdirSync(dist, {
  recursive: true
});

const staticPaths = [
  "index.html",
  "post.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "css",
  "js",
  "admin"
];

for (const name of staticPaths) {
  const source = path.join(root, name);
  const destination = path.join(dist, name);

  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, {
      recursive: true
    });
  } else {
    console.warn("Missing optional file:", name);
  }
}

// ==========================================
// FIREBASE ADMIN
// ==========================================

const credentials =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!credentials) {
  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_JSON. " +
    "Configure it securely in Cloudflare Pages " +
    "build environment variables."
  );
}

const serviceAccount = JSON.parse(credentials);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      serviceAccount
    )
  });
}

const db = admin.firestore();

// ==========================================
// FETCH ACTIVE PUBLISHED NEWS
// ==========================================

console.log("Loading published news from Firebase...");

const snapshot = await db
  .collection("posts")
  .where("status", "==", "published")
  .get();

const now = Date.now();

const activePosts = snapshot.docs
  .map(document => {
    const post = document.data();

    return {
      id: document.id,
      ...post,
      publishedMillis: timestampMillis(
        post.publishedAt || post.createdAt
      )
    };
  })
  .filter(post => {
    if (!post.publishedMillis) return false;

    if (post.publishedMillis > now) return false;

    if (
      now - post.publishedMillis >= TEN_DAYS
    ) {
      return false;
    }

    return true;
  })
  .sort(
    (a, b) =>
      b.publishedMillis - a.publishedMillis
  );

console.log(
  "Active published posts:",
  activePosts.length
);

// ==========================================
// HOMEPAGE WHATSAPP PREVIEW
// ==========================================

// Choose the newest active article with
// an uploaded photograph.

const latestWithPhoto = activePosts.find(
  post => firstImage(post)
);

const homepageData = latestWithPhoto
  ? {
      title: shortText(
        latestWithPhoto.title || SITE_TITLE,
        100
      ),

      description: shortText(
        latestWithPhoto.excerpt ||
        latestWithPhoto.body ||
        DEFAULT_DESCRIPTION,
        140
      ),

      image: firstImage(latestWithPhoto),

      url: SITE_URL + "/",

      type: "website"
    }
  : {
      title: SITE_TITLE,

      description: DEFAULT_DESCRIPTION,

      image: "",

      url: SITE_URL + "/",

      type: "website"
    };

const homepageTemplate = fs.readFileSync(
  path.join(root, "index.html"),
  "utf8"
);

const homepageHTML = injectSocialHead(
  homepageTemplate,
  homepageData
);

fs.writeFileSync(
  path.join(dist, "index.html"),
  homepageHTML
);

console.log(
  "Homepage preview:",
  homepageData.title
);

// ==========================================
// INDIVIDUAL ARTICLE PREVIEWS
// ==========================================

const articleTemplate = fs.readFileSync(
  path.join(root, "post.html"),
  "utf8"
);

const sitemap = ["/"];

let articleCount = 0;

for (const post of activePosts) {
  const slug = post.id;

  if (!/^[a-zA-Z0-9_-]{1,150}$/.test(slug)) {
    console.warn(
      "Skipping unsupported article ID:",
      slug
    );
    continue;
  }

  const articleURL =
    `${SITE_URL}/post/${encodeURIComponent(slug)}/`;

  const articleData = {
    title: shortText(
      post.title || "News Article",
      110
    ),

    description: shortText(
      post.excerpt ||
      post.body ||
      DEFAULT_DESCRIPTION,
      150
    ),

    image: firstImage(post),

    url: articleURL,

    type: "article"
  };

  const articleHTML = injectSocialHead(
    articleTemplate,
    articleData
  );

  const articleFolder = path.join(
    dist,
    "post",
    slug
  );

  fs.mkdirSync(articleFolder, {
    recursive: true
  });

  fs.writeFileSync(
    path.join(articleFolder, "index.html"),
    articleHTML
  );

  sitemap.push(
    `/post/${encodeURIComponent(slug)}/`
  );

  articleCount++;
}

// ==========================================
// SITEMAP
// ==========================================

const sitemapXML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  sitemap.map(item => {
    return (
      `<url><loc>` +
      escapeHTML(SITE_URL + item) +
      `</loc></url>`
    );
  }).join("") +
  "</urlset>";

fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  sitemapXML
);

// ==========================================
// BUILD COMPLETE
// ==========================================

console.log("--------------------------------");

console.log("Frank News build successful");

console.log("Website:", SITE_URL);

console.log("Article previews:", articleCount);

console.log(
  "Latest homepage photograph:",
  homepageData.image || "None"
);

console.log("Output folder:", dist);

console.log("--------------------------------");
