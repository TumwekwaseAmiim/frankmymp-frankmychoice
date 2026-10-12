
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

// ==========================================
// CONFIGURATION
// ==========================================

const root = path.resolve(
  import.meta.dirname,
  ".."
);

const dist = path.join(root, "dist");

const SITE_URL = (
  process.env.SITE_URL ||
  "https://frankmymp-frankmychoice.pages.dev"
).replace(/\/+$/, "");

const SITE_TITLE =
  "#FrankMyMP #FrankMyChoice";

const DEFAULT_DESCRIPTION =
  "Latest news and development updates from Rwamwanja, Kamwenge, Uganda.";

const TEN_DAYS =
  10 * 24 * 60 * 60 * 1000;

// ==========================================
// TEXT HELPERS
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

function shortText(value, max = 150) {
  const text = plainText(value);

  if (text.length <= max) {
    return text;
  }

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

// ==========================================
// CLOUDINARY PHOTOGRAPHS
// ==========================================

function imageURL(image) {
  if (!image) return "";

  if (typeof image === "string") {
    return image.trim();
  }

  if (typeof image === "object") {
    return (
      image.url ||
      image.secure_url ||
      image.secureUrl ||
      image.src ||
      ""
    ).trim();
  }

  return "";
}

function originalPhoto(post) {
  const images = Array.isArray(post.images)
    ? post.images
    : [];

  for (const image of images) {
    const url = imageURL(image);

    if (/^https:\/\//i.test(url)) {
      return url;
    }
  }

  return "";
}

// Convert ordinary public Cloudinary images
// to JPEG for better social-preview support.
//
// This does not modify the uploaded original.
//
// A transformed URL must still be publicly
// accessible. Check it after deployment.

function socialPhoto(post) {
  const original = originalPhoto(post);

  if (!original) return "";

  try {
    const parsed = new URL(original);

    const isCloudinary =
      parsed.hostname === "res.cloudinary.com";

    const isImage =
      parsed.pathname.includes("/image/upload/");

    if (isCloudinary && isImage) {
      parsed.pathname = parsed.pathname.replace(
        "/image/upload/",
        "/image/upload/f_jpg,q_auto,c_limit,w_1200/"
      );

      return parsed.toString();
    }

    // Other HTTPS photo sources are
    // used without modifications.
    return original;

  } catch {
    return original;
  }
}

// ==========================================
// REMOVE EXISTING OG METADATA
// ==========================================

function removeExistingSocialTags(html) {
  const names = new Set([
    "description",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image"
  ]);

  const properties = new Set([
    "og:type",
    "og:title",
    "og:description",
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "og:image:type",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
    "og:url",
    "og:site_name"
  ]);

  html = html.replace(
    /<meta\b[^>]*>/gi,
    tag => {
      const match = tag.match(
        /\b(name|property)\s*=\s*["']([^"']+)["']/i
      );

      if (!match) return tag;

      const kind = match[1].toLowerCase();
      const value = match[2].toLowerCase();

      if (
        kind === "name" &&
        names.has(value)
      ) {
        return "";
      }

      if (
        kind === "property" &&
        properties.has(value)
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

// ==========================================
// SOCIAL PREVIEW METADATA
// ==========================================

function generateSocialHead({
  title,
  description,
  image,
  url,
  type = "website"
}) {
  const t = escapeHTML(title);
  const d = escapeHTML(description);
  const u = escapeHTML(url);

  let imageTags = "";

  if (image) {
    const i = escapeHTML(image);

    const isJPEG =
      image.includes("/f_jpg,") ||
      /\.jpe?g(?:[?#]|$)/i.test(image);

    imageTags = `
  <meta property="og:image"
        content="${i}">

  <meta property="og:image:secure_url"
        content="${i}">

  <meta property="og:image:alt"
        content="${t}">

  ${isJPEG
    ? '<meta property="og:image:type" content="image/jpeg">'
    : ""}

  <meta name="twitter:image"
        content="${i}">
`;
  }

  return `
  <!-- Automatically generated news metadata -->

  <title>${t}</title>

  <meta
    name="description"
    content="${d}"
  >

  <meta
    property="og:type"
    content="${escapeHTML(type)}"
  >

  <meta
    property="og:site_name"
    content="${escapeHTML(SITE_TITLE)}"
  >

  <meta
    property="og:title"
    content="${t}"
  >

  <meta
    property="og:description"
    content="${d}"
  >

  <meta
    property="og:url"
    content="${u}"
  >

  ${imageTags}

  <meta
    name="twitter:card"
    content="${image
      ? "summary_large_image"
      : "summary"}"
  >

  <meta
    name="twitter:title"
    content="${t}"
  >

  <meta
    name="twitter:description"
    content="${d}"
  >

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
    throw new Error(
      "HTML template has no closing head tag."
    );
  }

  return html.replace(
    /<\/head>/i,
    `${generateSocialHead(data)}\n</head>`
  );
}

// ==========================================
// PREPARE OUTPUT DIRECTORY
// ==========================================

fs.rmSync(dist, {
  recursive: true,
  force: true
});

fs.mkdirSync(dist, {
  recursive: true
});

const staticFiles = [
  "index.html",
  "post.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "css",
  "js",
  "admin"
];

for (const name of staticFiles) {
  const source = path.join(root, name);
  const target = path.join(dist, name);

  if (fs.existsSync(source)) {
    fs.cpSync(source, target, {
      recursive: true
    });
  } else {
    console.warn(
      "Optional file not found:",
      name
    );
  }
}

// ==========================================
// CONNECT TO FIREBASE
// ==========================================

const credentials =
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!credentials) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_JSON is missing. " +
    "Check the Cloudflare build secret."
  );
}

const serviceAccount =
  JSON.parse(credentials);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      serviceAccount
    )
  });
}

const db = admin.firestore();

// ==========================================
// RETRIEVE PUBLISHED ARTICLES
// ==========================================

console.log(
  "Loading published news from Firestore..."
);

const snapshot = await db
  .collection("posts")
  .where("status", "==", "published")
  .get();

const now = Date.now();

const activePosts = snapshot.docs
  .map(document => {
    const post = document.data();

    return {
      ...post,
      id: document.id,
      publishedMillis: timestampMillis(
        post.publishedAt || post.createdAt
      )
    };
  })
  .filter(post => {
    return (
      post.publishedMillis > 0 &&
      post.publishedMillis <= now &&
      now - post.publishedMillis < TEN_DAYS
    );
  })
  .sort(
    (a, b) =>
      b.publishedMillis - a.publishedMillis
  );

console.log(
  "Active articles:",
  activePosts.length
);

// ==========================================
// DYNAMIC HOMEPAGE PREVIEW
// ==========================================

const latestWithPhoto =
  activePosts.find(post => originalPhoto(post));

const homepagePreview = latestWithPhoto
  ? {
      title: shortText(
        latestWithPhoto.title,
        110
      ),

      description: shortText(
        latestWithPhoto.excerpt ||
        latestWithPhoto.body ||
        DEFAULT_DESCRIPTION,
        140
      ),

      image: socialPhoto(latestWithPhoto),

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

fs.writeFileSync(
  path.join(dist, "index.html"),
  injectSocialHead(
    homepageTemplate,
    homepagePreview
  )
);

console.log(
  "Homepage preview:",
  homepagePreview.title
);

console.log(
  "Homepage image:",
  homepagePreview.image || "No photograph"
);

// ==========================================
// GENERATE INDIVIDUAL ARTICLE PAGES
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
      "Unsupported article identifier:",
      slug
    );
    continue;
  }

  const articleURL =
    `${SITE_URL}/post/${encodeURIComponent(slug)}/`;

  const original = originalPhoto(post);
  const previewImage = socialPhoto(post);

  if (!original) {
    console.warn(
      "No uploaded photo for article:",
      slug
    );
  }

  const articlePreview = {
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

    image: previewImage,
    url: articleURL,
    type: "article"
  };

  const page = injectSocialHead(
    articleTemplate,
    articlePreview
  );

  const folder = path.join(
    dist,
    "post",
    slug
  );

  fs.mkdirSync(folder, {
    recursive: true
  });

  fs.writeFileSync(
    path.join(folder, "index.html"),
    page
  );

  sitemap.push(
    `/post/${encodeURIComponent(slug)}/`
  );

  articleCount++;

  console.log(
    `Article ${articleCount}: ${slug}`
  );

  console.log(
    "  Original photo:",
    original || "None"
  );

  console.log(
    "  WhatsApp photo:",
    previewImage || "None"
  );
}

// ==========================================
// SITEMAP
// ==========================================

const sitemapXML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  sitemap.map(item =>
    '<url><loc>' +
    escapeHTML(SITE_URL + item) +
    '</loc></url>'
  ).join("") +
  "</urlset>";

fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  sitemapXML
);

// ==========================================
// BUILD SUMMARY
// ==========================================

console.log("------------------------------");
console.log("Frank News build complete");
console.log("Website:", SITE_URL);
console.log("Articles generated:", articleCount);
console.log(
  "Latest homepage photograph:",
  homepagePreview.image || "None"
);
console.log("Output directory:", dist);
console.log("------------------------------");
