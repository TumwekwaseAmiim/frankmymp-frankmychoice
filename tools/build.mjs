
/* ==========================================================
   #FrankMyMP #FrankMyChoice
   COMPLETE NEWS BUILD SYSTEM

   Features:
   - Cloudflare Pages deployment
   - Firestore published articles
   - Individual article landing pages
   - Branded static WhatsApp preview images
   - Actual first uploaded photograph
   - NEWS banner, headline and description
   - Open Graph and Twitter metadata
   - Homepage metadata
   - Sitemap generation
   - 10-day publication window
   - PWA and service worker preservation

   Designed for:
   frankmymp-frankmychoice.pages.dev
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

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

const COLORS = {
  yellow: "#FFE15C",
  red: "#C91727",
  black: "#171717",
  white: "#FFFFFF",
  ivory: "#FFFDF5",
  gray: "#59616A",
  photoBackground: "#E8E8E4"
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
// TEXT CLEANING
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

  const shortened = text
    .slice(0, maximum - 1)
    .replace(/\s+\S*$/, "")
    .trim();

  return (
    (shortened || text.slice(0, maximum - 1)) +
    "…"
  );
}

// ==========================================================
// TIMESTAMP HANDLING
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
// FIRST CLOUDINARY PHOTOGRAPH
// ==========================================================

function imageUrl(post) {
  const pictures =
    Array.isArray(post?.images)
      ? post.images
      : [];

  for (const item of pictures) {
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
// XML / SVG TEXT WRAPPING
// ==========================================================

function wrapLines(
  value,
  maximumCharacters,
  maximumLines
) {
  const original = cleanText(value);

  if (!original) {
    return [];
  }

  const words = original.split(" ");
  const lines = [];

  let current = "";
  let processedWords = 0;

  for (const word of words) {
    const candidate =
      current
        ? current + " " + word
        : word;

    if (
      candidate.length <= maximumCharacters
    ) {
      current = candidate;
      processedWords++;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (lines.length >= maximumLines) {
      current = "";
      break;
    }

    if (word.length > maximumCharacters) {
      current = word.slice(
        0,
        maximumCharacters - 1
      );
    } else {
      current = word;
    }

    processedWords++;
  }

  if (
    current &&
    lines.length < maximumLines
  ) {
    lines.push(current);
  }

  if (
    lines.length &&
    (
      processedWords < words.length ||
      lines.join(" ").length < original.length
    )
  ) {
    const last = lines.length - 1;

    lines[last] =
      lines[last]
        .slice(0, maximumCharacters - 1)
        .replace(/[.,;:\s]+$/, "") +
      "…";
  }

  return lines;
}

// ==========================================================
// SVG TEXT RENDERING
// ==========================================================

function svgTextLines({
  text,
  x,
  y,
  size,
  lineHeight,
  maxChars,
  maxLines,
  weight = 400,
  color = COLORS.black
}) {
  const lines = wrapLines(
    text,
    maxChars,
    maxLines
  );

  return lines.map((line, index) => `
    <text
      x="${x}"
      y="${y + index * lineHeight}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${size}"
      font-weight="${weight}"
      fill="${color}"
    >${htmlEscape(line)}</text>
  `).join("\n");
}

// ==========================================================
// DOWNLOAD CLOUDINARY PHOTOGRAPH
// ==========================================================

async function downloadPhoto(url) {
  if (!url) {
    throw new Error(
      "Article has no photograph"
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

  if (
    !contentType.startsWith("image/")
  ) {
    throw new Error(
      "Cloudinary URL did not return an image"
    );
  }

  const declaredSize = Number(
    response.headers.get("content-length") || 0
  );

  if (declaredSize > 15 * 1024 * 1024) {
    throw new Error(
      "Photograph is too large for preview generation"
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
      "Invalid preview photograph size"
    );
  }

  return buffer;
}

// ==========================================================
// BUILD BRANDED ARTICLE PREVIEW
//
// Output:
// 1200 × 630 JPEG
//
// Layout:
// 0–70       Yellow NEWS masthead
// 70–368     Real uploaded photograph
// 368–584    Headline and description
// 584–630    Website footer
//
// The photograph is added AFTER the background
// and BEFORE the transparent foreground.
// ==========================================================

async function generateShareCard(
  post,
  outputFile
) {
  const originalPhoto =
    imageUrl(post);

  if (!originalPhoto) {
    throw new Error(
      "No uploaded photograph"
    );
  }

  const sourceBuffer =
    await downloadPhoto(originalPhoto);

  const photo = await sharp(
    sourceBuffer,
    {
      limitInputPixels: 40000000
    }
  )
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: 298,
      fit: "contain",
      background: COLORS.photoBackground
    })
    .jpeg({
      quality: 88
    })
    .toBuffer();

  const headline = cleanText(
    post.title || "News Update"
  );

  const summary = cleanText(
    post.excerpt ||
    post.body ||
    DESCRIPTION
  );

  // ========================================
  // STAGE 1: BASE WITH PHOTOGRAPH
  // ========================================

  const photoBase = await sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 3,
      background: COLORS.white
    }
  })
    .composite([
      {
        input: photo,
        left: 0,
        top: 70
      }
    ])
    .png()
    .toBuffer();

  // ========================================
  // STAGE 2: TRANSPARENT FOREGROUND
  //
  // Crucial: no opaque rectangle over the
  // photo area, so photographs stay visible.
  // ========================================

  const headlineSVG = svgTextLines({
    text: headline,
    x: 38,
    y: 415,
    size: 34,
    lineHeight: 42,
    maxChars: 59,
    maxLines: 2,
    weight: 800,
    color: COLORS.black
  });

  const summarySVG = svgTextLines({
    text: summary,
    x: 39,
    y: 515,
    size: 21,
    lineHeight: 27,
    maxChars: 100,
    maxLines: 2,
    weight: 400,
    color: COLORS.gray
  });

  const overlaySVG = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1200"
    height="630"
    viewBox="0 0 1200 630"
  >

    <!-- YELLOW TOP MASTHEAD -->

    <rect
      x="0"
      y="0"
      width="1200"
      height="70"
      fill="${COLORS.yellow}"
    />

    <!-- RED NEWS LABEL -->

    <rect
      x="0"
      y="0"
      width="146"
      height="70"
      fill="${COLORS.red}"
    />

    <text
      x="73"
      y="46"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="29"
      font-weight="800"
      fill="${COLORS.white}"
    >NEWS</text>

    <!-- WEBSITE BRANDING -->

    <text
      x="170"
      y="45"
      font-family="Arial, Helvetica, sans-serif"
      font-size="28"
      font-weight="800"
    >
      <tspan fill="${COLORS.red}">#Frank</tspan><tspan fill="${COLORS.black}">MyMP</tspan>
      <tspan fill="${COLORS.black}">   #Frank</tspan><tspan fill="${COLORS.red}">MyChoice</tspan>
    </text>

    <!--
      PHOTO AREA: Y=70 TO Y=368
      Intentionally transparent.
      Do not add a background rectangle.
    -->

    <!-- ARTICLE INFORMATION PANEL -->

    <rect
      x="0"
      y="368"
      width="1200"
      height="216"
      fill="${COLORS.white}"
    />

    <!-- HEADLINE -->

    ${headlineSVG}

    <!-- DESCRIPTION -->

    ${summarySVG}

    <!-- YELLOW WEBSITE FOOTER -->

    <rect
      x="0"
      y="584"
      width="1200"
      height="46"
      fill="${COLORS.yellow}"
    />

    <text
      x="38"
      y="613"
      font-family="Arial, Helvetica, sans-serif"
      font-size="21"
      font-weight="700"
      fill="${COLORS.black}"
    >frankmymp-frankmychoice.pages.dev</text>

    <text
      x="1160"
      y="613"
      text-anchor="end"
      font-family="Arial, Helvetica, sans-serif"
      font-size="16"
      font-weight="700"
      fill="${COLORS.red}"
    >RWAMWANJA • KAMWENGE • UGANDA</text>

  </svg>
  `;

  await sharp(photoBase)
    .composite([
      {
        input: Buffer.from(
          overlaySVG
        ),
        left: 0,
        top: 0
      }
    ])
    .jpeg({
      quality: 88,
      mozjpeg: true
    })
    .toFile(outputFile);

  return outputFile;
}

// ==========================================================
// SOCIAL MEDIA METADATA
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

<meta property="og:url" content="${url}">

${image ? `
<meta property="og:image" content="${image}">

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
  content="1200"
>

<meta
  property="og:image:height"
  content="630"
>
` : ""}

<meta
  property="og:image:alt"
  content="${title}"
>

<meta name="twitter:image" content="${image}">
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
// REMOVE STALE METADATA AND INJECT NEW TAGS
// ==========================================================

function inject(html, metadata) {
  html = html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    ""
  );

  html = html.replace(
    /<meta\b[^>]*>/gi,
    tag => {
      const match = tag.match(
        /\b(?:name|property)\s*=\s*["']([^"']+)["']/i
      );

      const property =
        match?.[1]?.toLowerCase() || "";

      if (
        property === "description" ||
        property.startsWith("og:") ||
        property.startsWith("twitter:")
      ) {
        return "";
      }

      return tag;
    }
  );

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
// COPY EXISTING PUBLIC WEBSITE FILES
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

fs.mkdirSync(
  SHARE_DIR,
  {
    recursive: true
  }
);

// ==========================================================
// FIREBASE BUILD CREDENTIALS
// ==========================================================

if (
  !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
) {
  if (
    process.env.BUILD_WITHOUT_FIREBASE === "1"
  ) {
    console.warn(
      "Local diagnostic build only: no Firebase articles or branded share images generated."
    );

    process.exit(0);
  }

  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Set it as a Cloudflare Pages build secret."
  );
}

// ==========================================================
// CONNECT FIREBASE
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
// LOAD PUBLISHED NEWS ARTICLES
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
    const ms = timestamp(
      post.publishedAt ||
      post.createdAt
    );

    return (
      ms > 0 &&
      ms <= now &&
      now - ms < TEN_DAYS_MS
    );
  })
  .sort(
    (a, b) =>
      timestamp(
        b.publishedAt ||
        b.createdAt
      ) -
      timestamp(
        a.publishedAt ||
        a.createdAt
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
// GENERATE EVERY PUBLISHED ARTICLE
// ==========================================================

for (const post of posts) {
  if (
    !ARTICLE_ID_VALID(post.id)
  ) {
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

  let previewImage = originalPhoto;
  let brandedImage = false;

  // ========================================
  // GENERATE CUSTOM 1200 × 630 NEWS IMAGE
  // ========================================

  if (originalPhoto) {
    const destination =
      path.join(
        SHARE_DIR,
        `${post.id}.jpg`
      );

    try {
      await generateShareCard(
        post,
        destination
      );

      previewImage =
        `${SITE_URL}/assets/share/${encodeURIComponent(post.id)}.jpg`;

      brandedImage = true;
      brandedCount++;

    } catch (error) {
      // Keep the original photograph
      // rather than publish a blank card.

      console.warn(
        `Branded image unavailable for ${post.id}:`,
        error.message
      );

      previewImage = originalPhoto;
    }
  }

  // ========================================
  // ARTICLE-SPECIFIC OG META
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

  const articleFolder =
    path.join(
      DIST,
      "post",
      post.id
    );

  fs.mkdirSync(
    articleFolder,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    path.join(
      articleFolder,
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
    `Generated ${post.id}: ${brandedImage ? "branded preview" : previewImage ? "original photo fallback" : "no photo"}`
  );
}

// ==========================================================
// ARTICLE ID VALIDATOR
// ==========================================================

function ARTICLE_ID_VALID(id) {
  return (
    typeof id === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(id)
  );
}

// ==========================================================
// HOMEPAGE METADATA
// ==========================================================

const homepageTemplate =
  fs.readFileSync(
    path.join(ROOT, "index.html"),
    "utf8"
  );

const homepageMeta = {
  title: SITE_NAME,
  description: DESCRIPTION,
  image: homepageImage,
  brandedImage: homepageImageBranded,
  url: `${SITE_URL}/`,
  type: "website"
};

fs.writeFileSync(
  path.join(
    DIST,
    "index.html"
  ),
  inject(
    homepageTemplate,
    homepageMeta
  )
);

// ==========================================================
// SITEMAP
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
