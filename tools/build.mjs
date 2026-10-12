
/* ==========================================================
   #FrankMyMP #FrankMyChoice
   FINAL NEWS BUILD SYSTEM

   FULL-CLEAR-PHOTO EDITION

   FEATURES
   ----------------------------------------------------------
   - Full-size, clear article photographs
   - No blurred background
   - No smaller foreground photograph
   - Yellow/red NEWS branding
   - Headline displayed over the photograph
   - Automatic 1200 x 630 JPEG creation
   - Firebase Firestore published news
   - Individual static article landing pages
   - WhatsApp, Facebook and X Open Graph metadata
   - Article summaries preserved
   - 10-day publication window
   - Homepage metadata and sitemap
   - Cloudflare Pages deployment
   - Existing PWA, admin, CSS and JS preserved

   Long WhatsApp text is handled by js/ui.js and js/post.js.
   This build does not shorten those sharing messages.

   Developer: Eng. Amiim Tumwekwase
========================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ==========================================================
// DIRECTORIES
// ==========================================================

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const DIST = path.join(ROOT, "dist");

const SHARE_DIR = path.join(
  DIST,
  "assets",
  "share"
);

// ==========================================================
// WEBSITE CONFIGURATION
// ==========================================================

const SITE_URL = (
  process.env.SITE_URL ||
  "https://frankmymp-frankmychoice.pages.dev"
).replace(/\/+$/, "");

const SITE_NAME =
  "#FrankMyMP #FrankMyChoice";

const DESCRIPTION =
  "Latest news and development updates from Rwamwanja, Kamwenge, Uganda.";

const TEN_DAYS_MS =
  10 * 24 * 60 * 60 * 1000;

// ==========================================================
// IMAGE CONFIGURATION
// ==========================================================

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Must match js/ui.js.
const DESIGN_VERSION = "fullphoto-v3";

const COLORS = {
  yellow: "#FFE15C",
  red: "#C91727",
  black: "#171717",
  white: "#FFFFFF"
};

// ==========================================================
// HTML ESCAPING
// ==========================================================

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ==========================================================
// TEXT HELPERS
// ==========================================================

function cleanText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value, maximum = 160) {
  const text = cleanText(value);

  if (text.length <= maximum) {
    return text;
  }

  const cut = text
    .slice(0, maximum - 1)
    .replace(/\s+\S*$/, "")
    .trim();

  return (
    (cut || text.slice(0, maximum - 1)) +
    "…"
  );
}

// ==========================================================
// FIRESTORE TIMESTAMPS
// ==========================================================

function timestamp(value) {
  if (
    value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value.seconds === "number"
  ) {
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

// ==========================================================
// ARTICLE IDENTIFIER
// ==========================================================

function validArticleId(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(value)
  );
}

// ==========================================================
// FIRST UPLOADED PHOTOGRAPH
// ==========================================================

function imageUrl(post) {
  const images = Array.isArray(post?.images)
    ? post.images
    : [];

  for (const item of images) {
    const source =
      typeof item === "string"
        ? item
        : (
            item?.secure_url ||
            item?.url ||
            item?.src ||
            ""
          );

    if (
      typeof source === "string" &&
      /^https:\/\//i.test(source.trim())
    ) {
      return source.trim();
    }
  }

  return "";
}

// ==========================================================
// WRAP HEADLINE
// ==========================================================

function wrapHeadline(
  value,
  maximumCharacters = 50,
  maximumLines = 2
) {
  const text = cleanText(value);

  if (!text) {
    return ["News Update"];
  }

  const words = text.split(" ");
  const lines = [];

  let current = "";

  for (const word of words) {
    const candidate = current
      ? current + " " + word
      : word;

    if (
      candidate.length <= maximumCharacters
    ) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (lines.length >= maximumLines) {
      current = "";
      break;
    }

    current = word;
  }

  if (
    current &&
    lines.length < maximumLines
  ) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(
      text.slice(0, maximumCharacters)
    );
  }

  const displayed = lines.join(" ");

  if (displayed.length < text.length) {
    const index = lines.length - 1;

    lines[index] =
      lines[index]
        .slice(0, maximumCharacters - 1)
        .replace(/[.,;:\s]+$/, "") +
      "…";
  }

  return lines;
}

// ==========================================================
// SVG HEADLINE
// ==========================================================

function headlineSVG(title) {
  const lines = wrapHeadline(
    title,
    48,
    2
  );

  const fontSize =
    lines.length === 1 ? 42 : 37;

  const startY =
    lines.length === 1 ? 531 : 489;

  const lineHeight = 46;

  return lines.map(
    (line, index) => `
      <text
        x="38"
        y="${startY + index * lineHeight}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="800"
        fill="${COLORS.white}"
        stroke="#000000"
        stroke-opacity="0.28"
        stroke-width="1.3"
        paint-order="stroke"
      >${htmlEscape(line)}</text>
    `
  ).join("\n");
}

// ==========================================================
// DOWNLOAD ARTICLE PHOTOGRAPH
// ==========================================================

async function downloadPhoto(url) {
  if (!url) {
    throw new Error(
      "Article photograph is missing"
    );
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(
      "Photograph download failed: HTTP " +
      response.status
    );
  }

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(
      "The photograph URL returned non-image content"
    );
  }

  const length = Number(
    response.headers.get("content-length") || 0
  );

  if (length > 15 * 1024 * 1024) {
    throw new Error(
      "Photograph exceeds 15 MB"
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  if (
    !buffer.length ||
    buffer.length > 15 * 1024 * 1024
  ) {
    throw new Error(
      "Invalid photograph size"
    );
  }

  return buffer;
}

// ==========================================================
// GENERATE FULL-PHOTO NEWS CARD
//
// ONE PHOTOGRAPH ONLY
//
// - Full canvas photographic background
// - No blur
// - No second foreground image
// - Thin NEWS branding at top
// - Dark gradient behind headline for readability
// - Slim website footer
//
// fit: cover fills the canvas.
// It can crop edges of portrait or square photos,
// but does not blur or stretch the photograph.
// ==========================================================

async function generateShareCard(
  post,
  outputFile
) {
  const sourceURL = imageUrl(post);

  if (!sourceURL) {
    throw new Error(
      "No uploaded photograph"
    );
  }

  const sourceBuffer =
    await downloadPhoto(sourceURL);

  // ========================================
  // FULL-CANVAS SHARP PHOTOGRAPH
  // ========================================

  const background = await sharp(
    sourceBuffer,
    {
      limitInputPixels: 40000000
    }
  )
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fit: "cover",
      position: "attention"
    })
    .jpeg({
      quality: 90
    })
    .toBuffer();

  // ========================================
  // ARTICLE HEADLINE
  // ========================================

  const title =
    post.title || "News Update";

  const renderedHeadline =
    headlineSVG(title);

  // ========================================
  // BRANDING OVERLAY
  //
  // The middle photo area stays clear.
  // The dark gradient only improves
  // headline readability near the bottom.
  // ========================================

  const overlaySVG = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
  >

    <defs>
      <linearGradient
        id="headlineShade"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="#000000"
          stop-opacity="0"
        />
        <stop
          offset="48%"
          stop-color="#000000"
          stop-opacity="0.12"
        />
        <stop
          offset="100%"
          stop-color="#000000"
          stop-opacity="0.86"
        />
      </linearGradient>
    </defs>

    <!-- BOTTOM HEADLINE GRADIENT -->

    <rect
      x="0"
      y="315"
      width="${CARD_WIDTH}"
      height="279"
      fill="url(#headlineShade)"
    />

    <!-- YELLOW NEWS MASTHEAD -->

    <rect
      x="0"
      y="0"
      width="${CARD_WIDTH}"
      height="55"
      fill="${COLORS.yellow}"
    />

    <!-- RED NEWS LABEL -->

    <rect
      x="0"
      y="0"
      width="136"
      height="55"
      fill="${COLORS.red}"
    />

    <text
      x="68"
      y="37"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="27"
      font-weight="800"
      fill="${COLORS.white}"
    >NEWS</text>

    <!-- WEBSITE BRAND -->

    <text
      x="160"
      y="37"
      font-family="Arial, Helvetica, sans-serif"
      font-size="27"
      font-weight="800"
    >
      <tspan fill="${COLORS.red}">#Frank</tspan><tspan fill="${COLORS.black}">MyMP</tspan>
      <tspan fill="${COLORS.black}">   #Frank</tspan><tspan fill="${COLORS.red}">MyChoice</tspan>
    </text>

    <!-- ARTICLE HEADLINE -->

    ${renderedHeadline}

    <!-- WEBSITE FOOTER -->

    <rect
      x="0"
      y="594"
      width="${CARD_WIDTH}"
      height="36"
      fill="${COLORS.yellow}"
    />

    <text
      x="32"
      y="618"
      font-family="Arial, Helvetica, sans-serif"
      font-size="18"
      font-weight="700"
      fill="${COLORS.black}"
    >frankmymp-frankmychoice.pages.dev</text>

    <text
      x="1170"
      y="618"
      text-anchor="end"
      font-family="Arial, Helvetica, sans-serif"
      font-size="15"
      font-weight="700"
      fill="${COLORS.red}"
    >RWAMWANJA • KAMWENGE • UGANDA</text>

  </svg>
  `;

  // ========================================
  // COMPOSITE AND EXPORT JPEG
  // ========================================

  await sharp(background)
    .composite([
      {
        input: Buffer.from(overlaySVG),
        top: 0,
        left: 0
      }
    ])
    .jpeg({
      quality: 85,
      mozjpeg: true
    })
    .toFile(outputFile);

  return outputFile;
}

// ==========================================================
// OPEN GRAPH METADATA
//
// Preserves article headline,
// short description and clickable link.
//
// WhatsApp's message text is separate and
// remains controlled by js/ui.js and js/post.js.
// ==========================================================

function socialMeta(data) {
  const title =
    htmlEscape(data.title);

  const description =
    htmlEscape(data.description);

  const url =
    htmlEscape(data.url);

  const image =
    htmlEscape(data.image || "");

  const type =
    data.type === "article"
      ? "article"
      : "website";

  return `
<title>${title} | ${htmlEscape(SITE_NAME)}</title>

<meta
  name="description"
  content="${description}"
>

<meta property="og:type" content="${type}">

<meta
  property="og:site_name"
  content="${htmlEscape(SITE_NAME)}"
>

<meta
  property="og:title"
  content="${title}"
>

<meta
  property="og:description"
  content="${description}"
>

<meta
  property="og:url"
  content="${url}"
>

${image ? `
<meta
  property="og:image"
  content="${image}"
>

<meta
  property="og:image:secure_url"
  content="${image}"
>

${data.brandedImage ? `
<meta
  property="og:image:type"
  content="image/jpeg"
>

<meta
  property="og:image:width"
  content="${CARD_WIDTH}"
>

<meta
  property="og:image:height"
  content="${CARD_HEIGHT}"
>
` : ""}

<meta
  property="og:image:alt"
  content="${title}"
>

<meta
  name="twitter:image"
  content="${image}"
>
` : ""}

<meta
  name="twitter:card"
  content="${image ? "summary_large_image" : "summary"}"
>

<meta
  name="twitter:title"
  content="${title}"
>

<meta
  name="twitter:description"
  content="${description}"
>

<link rel="canonical" href="${url}">
`.trim();
}

// ==========================================================
// INJECT AUTHORITATIVE ARTICLE META TAGS
// ==========================================================

function inject(html, metadata) {
  // Remove old title tags.

  html = html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    ""
  );

  // Remove old description and social tags.

  html = html.replace(
    /<meta\b[^>]*>/gi,
    tag => {
      const match = tag.match(
        /\b(?:name|property)\s*=\s*["']([^"']+)["']/i
      );

      const property =
        match?.[1]?.toLowerCase() || "";

      return (
        property === "description" ||
        property.startsWith("og:") ||
        property.startsWith("twitter:")
      )
        ? ""
        : tag;
    }
  );

  // Remove outdated canonical tags.

  html = html.replace(
    /<link\b[^>]*>/gi,
    tag =>
      /\brel\s*=\s*["']canonical["']/i.test(tag)
        ? ""
        : tag
  );

  if (!/<\/head>/i.test(html)) {
    throw new Error(
      "HTML template is missing </head>"
    );
  }

  return html.replace(
    /<\/head>/i,
    socialMeta(metadata) + "\n</head>"
  );
}

// ==========================================================
// PREPARE DIST FOLDER
// ==========================================================

fs.rmSync(DIST, {
  recursive: true,
  force: true
});

fs.mkdirSync(DIST, {
  recursive: true
});

// ==========================================================
// COPY WEBSITE AND PWA FILES
// ==========================================================

const essentialFiles = [
  "index.html",
  "post.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "css",
  "js",
  "admin"
];

for (const item of essentialFiles) {
  const source = path.join(
    ROOT,
    item
  );

  if (!fs.existsSync(source)) {
    throw new Error(
      `Missing essential website file: ${item}`
    );
  }

  fs.cpSync(
    source,
    path.join(DIST, item),
    {
      recursive: true
    }
  );
}

// ==========================================================
// GENERATED IMAGE DIRECTORY
// ==========================================================

fs.mkdirSync(
  SHARE_DIR,
  {
    recursive: true
  }
);

// ==========================================================
// FIREBASE CREDENTIAL CHECK
// ==========================================================

if (
  !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
) {
  if (
    process.env.BUILD_WITHOUT_FIREBASE === "1"
  ) {
    console.warn(
      "Local diagnostic build only: Firebase articles and share images were not generated."
    );

    process.exit(0);
  }

  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Configure it in Cloudflare Pages."
  );
}

// ==========================================================
// CONNECT FIREBASE ADMIN
// ==========================================================

const { default: admin } =
  await import("firebase-admin");

const credentials = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential:
      admin.credential.cert(credentials)
  });
}

// ==========================================================
// LOAD PUBLISHED NEWS
// ==========================================================

const snapshot = await admin
  .firestore()
  .collection("posts")
  .where("status", "==", "published")
  .get();

const now = Date.now();

const posts = snapshot.docs
  .map(document => ({
    ...document.data(),
    id: document.id
  }))
  .filter(post => {
    const date = timestamp(
      post.publishedAt ||
      post.createdAt
    );

    return (
      date > 0 &&
      date <= now &&
      now - date < TEN_DAYS_MS
    );
  })
  .sort(
    (a, b) =>
      timestamp(
        b.publishedAt || b.createdAt
      ) -
      timestamp(
        a.publishedAt || a.createdAt
      )
  );

// ==========================================================
// ARTICLE LANDING-PAGE TEMPLATE
// ==========================================================

const articleTemplate =
  fs.readFileSync(
    path.join(ROOT, "post.html"),
    "utf8"
  );

const sitemapURLs = ["/"];

let articleCount = 0;
let brandedCount = 0;

let homepageImage = "";
let homepageImageBranded = false;

// ==========================================================
// GENERATE EVERY ARTICLE
// ==========================================================

for (const post of posts) {
  if (!validArticleId(post.id)) {
    console.warn(
      "Skipping invalid article ID:",
      post.id
    );

    continue;
  }

  const articleURL =
    `${SITE_URL}/post/${encodeURIComponent(post.id)}/`;

  const originalPhoto =
    imageUrl(post);

  const headline =
    excerpt(
      post.title || "News Update",
      150
    );

  const description =
    excerpt(
      post.excerpt ||
      post.body ||
      DESCRIPTION,
      160
    );

  let previewImage =
    originalPhoto;

  let brandedImage = false;

  // ========================================
  // GENERATE FULL-PHOTO SOCIAL IMAGE
  // ========================================

  if (originalPhoto) {
    const filename =
      `${post.id}-${DESIGN_VERSION}.jpg`;

    const destination =
      path.join(
        SHARE_DIR,
        filename
      );

    try {
      await generateShareCard(
        post,
        destination
      );

      previewImage =
        `${SITE_URL}/assets/share/${encodeURIComponent(filename)}`;

      brandedImage = true;
      brandedCount++;

    } catch (error) {
      console.warn(
        `NEWS image generation failed for ${post.id}:`,
        error.message
      );

      // Keep original photo as fallback.

      previewImage =
        originalPhoto;
    }
  }

  // ========================================
  // INDIVIDUAL ARTICLE HTML
  // ========================================

  const articleHTML = inject(
    articleTemplate,
    {
      title: headline,
      description,
      image: previewImage,
      brandedImage,
      url: articleURL,
      type: "article"
    }
  );

  const articleDirectory =
    path.join(
      DIST,
      "post",
      post.id
    );

  fs.mkdirSync(
    articleDirectory,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    path.join(
      articleDirectory,
      "index.html"
    ),
    articleHTML
  );

  sitemapURLs.push(
    `/post/${encodeURIComponent(post.id)}/`
  );

  if (
    !homepageImage &&
    previewImage
  ) {
    homepageImage = previewImage;
    homepageImageBranded =
      brandedImage;
  }

  articleCount++;

  console.log(
    `Generated ${post.id}: ${
      brandedImage
        ? "FULL CLEAR PHOTO"
        : previewImage
          ? "original photo fallback"
          : "no photo"
    }`
  );
}

// ==========================================================
// HOMEPAGE SOCIAL META
// ==========================================================

const homepageTemplate =
  fs.readFileSync(
    path.join(ROOT, "index.html"),
    "utf8"
  );

const homepageHTML = inject(
  homepageTemplate,
  {
    title: SITE_NAME,
    description: DESCRIPTION,
    image: homepageImage,
    brandedImage: homepageImageBranded,
    url: `${SITE_URL}/`,
    type: "website"
  }
);

fs.writeFileSync(
  path.join(
    DIST,
    "index.html"
  ),
  homepageHTML
);

// ==========================================================
// XML SITEMAP
// ==========================================================

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',

  ...sitemapURLs.map(
    relativeURL =>
      `<url><loc>${htmlEscape(
        SITE_URL + relativeURL
      )}</loc></url>`
  ),

  '</urlset>'
].join("");

fs.writeFileSync(
  path.join(
    DIST,
    "sitemap.xml"
  ),
  sitemap
);

// ==========================================================
// BUILD SUMMARY
// ==========================================================

console.log(
  "=========================================="
);

console.log(
  "FRANK NEWS BUILD COMPLETE"
);

console.log(
  "Image design:",
  "FULL CLEAR PHOTO"
);

console.log(
  "Blurred backgrounds:",
  "NONE"
);

console.log(
  "Foreground duplicate photos:",
  "NONE"
);

console.log(
  "Article landing pages:",
  articleCount
);

console.log(
  "Branded social images:",
  brandedCount
);

console.log(
  "Website URL:",
  SITE_URL
);

console.log(
  "Output directory:",
  DIST
);

console.log(
  "=========================================="
);
