
/* ==========================================================
   #FrankMyMP #FrankMyChoice
   COMPLETE NEWS BUILD SYSTEM

   PHOTO-FIRST SOCIAL PREVIEW DESIGN

   Features:
   - Cloudflare Pages static build
   - Firebase Firestore news
   - Individual article landing pages
   - 1200 x 630 branded JPEG previews
   - Photograph occupies approximately 70%
   - Yellow NEWS header
   - Red and black website branding
   - Article headline and website footer
   - Blurred background for portrait photographs
   - Open Graph / WhatsApp metadata
   - Twitter / X metadata
   - Full descriptions in metadata
   - Sitemap
   - 10-day publication window
   - PWA and admin files preserved

   Designed for:
   https://frankmymp-frankmychoice.pages.dev

========================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ==========================================================
// PATHS
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
// WEBSITE SETTINGS
// ==========================================================

const SITE_URL = (
  process.env.SITE_URL ||
  "https://frankmymp-frankmychoice.pages.dev"
).replace(/\/+$/, "");

const SITE_NAME = "#FrankMyMP #FrankMyChoice";

const DESCRIPTION =
  "Latest news and development updates from Rwamwanja, Kamwenge, Uganda.";

const TEN_DAYS_MS = 10 * 86400000;

// ==========================================================
// IMAGE SIZE AND DESIGN
// ==========================================================

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Total = 630px
// Header:   54px
// Photo:   440px (approximately 70%)
// Headline: 100px
// Footer:   36px

const HEADER_HEIGHT = 54;

const PHOTO_TOP = 54;
const PHOTO_HEIGHT = 440;

const HEADLINE_TOP = 494;
const HEADLINE_HEIGHT = 100;

const FOOTER_TOP = 594;
const FOOTER_HEIGHT = 36;

// A new image filename prevents old social
// previews from being reused unnecessarily.

const DESIGN_VERSION = "photo70-v2";

const COLORS = {
  yellow: "#FFE15C",
  red: "#C91727",
  black: "#171717",
  white: "#FFFFFF",
  gray: "#59616A",
  photoBackground: "#D8D8D8"
};

// ==========================================================
// CLEAN AND ESCAPE TEXT
// ==========================================================

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
// ARTICLE IDENTIFIER VALIDATION
// ==========================================================

function validArticleId(value) {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,160}$/.test(value)
  );
}

// ==========================================================
// FIRST ARTICLE PHOTOGRAPH
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
// WRAP HEADLINE FOR THE NEWS IMAGE
// ==========================================================

function wrapText(
  value,
  maxCharacters = 62,
  maxLines = 2
) {
  const original = cleanText(value);

  if (!original) {
    return [];
  }

  const words = original.split(" ");
  const lines = [];

  let current = "";
  let index = 0;

  for (; index < words.length; index++) {
    const word = words[index];

    const candidate = current
      ? current + " " + word
      : word;

    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (lines.length >= maxLines) {
      break;
    }

    if (word.length > maxCharacters) {
      current = word.slice(0, maxCharacters);
    } else {
      current = word;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(
      original.slice(0, maxCharacters)
    );
  }

  const displayed = lines.join(" ");

  if (displayed.length < original.length) {
    const last = lines.length - 1;

    lines[last] =
      lines[last]
        .slice(0, maxCharacters - 1)
        .replace(/[\s,;:.]+$/, "") +
      "…";
  }

  return lines;
}

// ==========================================================
// SVG HEADLINE RENDERER
// ==========================================================

function headlineSVG(title) {
  const lines = wrapText(
    title,
    64,
    2
  );

  const fontSize = 32;
  const lineHeight = 38;

  const firstY =
    lines.length === 1
      ? 554
      : 529;

  return lines.map((line, index) => `
    <text
      x="32"
      y="${firstY + index * lineHeight}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}"
      font-weight="800"
      fill="${COLORS.black}"
    >${htmlEscape(line)}</text>
  `).join("\n");
}

// ==========================================================
// DOWNLOAD CLOUDINARY IMAGE
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
      "Image download failed: HTTP " +
      response.status
    );
  }

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(
      "Photo URL did not return an image"
    );
  }

  const declaredSize = Number(
    response.headers.get("content-length") || 0
  );

  if (declaredSize > 15 * 1024 * 1024) {
    throw new Error(
      "Photograph exceeds 15 MB limit"
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
      "Photograph size is invalid"
    );
  }

  return buffer;
}

// ==========================================================
// GENERATE PHOTO-FIRST BRANDED NEWS IMAGE
//
// IMPORTANT:
//
// The upper photograph occupies 440px
// of the 630px image.
//
// Landscape images fill the photograph area.
//
// Portrait/square images remain fully visible,
// with a blurred enlargement behind them.
//
// This preserves the original photo without
// cutting off people's faces or other details.
//
// ==========================================================

async function generateShareCard(
  post,
  outputFile
) {
  const originalPhoto = imageUrl(post);

  if (!originalPhoto) {
    throw new Error(
      "No photograph attached to article"
    );
  }

  const originalBuffer =
    await downloadPhoto(originalPhoto);

  // ========================================
  // STEP 1: CREATE BLURRED PHOTO BACKGROUND
  // ========================================

  const blurredBackground = await sharp(
    originalBuffer,
    {
      limitInputPixels: 40000000
    }
  )
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: PHOTO_HEIGHT,
      fit: "cover"
    })
    .blur(18)
    .modulate({
      brightness: 0.70
    })
    .png()
    .toBuffer();

  // ========================================
  // STEP 2: RESIZE ORIGINAL WITHOUT CROPPING
  // ========================================

  const originalResized = await sharp(
    originalBuffer,
    {
      limitInputPixels: 40000000
    }
  )
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: PHOTO_HEIGHT,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();

  const photoMetadata = await sharp(
    originalResized
  ).metadata();

  const photoWidth = photoMetadata.width;
  const photoHeight = photoMetadata.height;

  const photoLeft = Math.floor(
    (CARD_WIDTH - photoWidth) / 2
  );

  const photoVertical = Math.floor(
    (PHOTO_HEIGHT - photoHeight) / 2
  );

  // ========================================
  // STEP 3: COMPOSITE PHOTOGRAPHS
  // ========================================

  const photoArea = await sharp(
    blurredBackground
  )
    .composite([
      {
        input: originalResized,
        left: photoLeft,
        top: photoVertical
      }
    ])
    .png()
    .toBuffer();

  // ========================================
  // STEP 4: PLACE PHOTO INTO 1200x630 CARD
  // ========================================

  const imageBase = await sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: COLORS.white
    }
  })
    .composite([
      {
        input: photoArea,
        left: 0,
        top: PHOTO_TOP
      }
    ])
    .png()
    .toBuffer();

  // ========================================
  // STEP 5: NEWS BRAND AND HEADLINE
  // ========================================

  const headline =
    cleanText(post.title || "News Update");

  const articleHeadline =
    headlineSVG(headline);

  const overlaySVG = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
  >

    <!-- ===================================
         YELLOW TOP BAR
    ==================================== -->

    <rect
      x="0"
      y="0"
      width="${CARD_WIDTH}"
      height="${HEADER_HEIGHT}"
      fill="${COLORS.yellow}"
    />

    <!-- ===================================
         RED NEWS LABEL
    ==================================== -->

    <rect
      x="0"
      y="0"
      width="128"
      height="${HEADER_HEIGHT}"
      fill="${COLORS.red}"
    />

    <text
      x="64"
      y="36"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-weight="800"
      font-size="26"
      fill="${COLORS.white}"
    >NEWS</text>

    <!-- ===================================
         NEWS WEBSITE BRANDING
    ==================================== -->

    <text
      x="152"
      y="36"
      font-family="Arial, Helvetica, sans-serif"
      font-size="26"
      font-weight="800"
    >
      <tspan fill="${COLORS.red}">#Frank</tspan><tspan fill="${COLORS.black}">MyMP</tspan>
      <tspan fill="${COLORS.black}">   #Frank</tspan><tspan fill="${COLORS.red}">MyChoice</tspan>
    </text>

    <!-- ===================================
         MAIN PHOTO AREA

         Transparent from Y=54 to Y=494.
         Original photograph remains visible.
    ==================================== -->

    <!-- ===================================
         ARTICLE HEADLINE PANEL
    ==================================== -->

    <rect
      x="0"
      y="${HEADLINE_TOP}"
      width="${CARD_WIDTH}"
      height="${HEADLINE_HEIGHT}"
      fill="${COLORS.white}"
    />

    ${articleHeadline}

    <!-- ===================================
         WEBSITE FOOTER
    ==================================== -->

    <rect
      x="0"
      y="${FOOTER_TOP}"
      width="${CARD_WIDTH}"
      height="${FOOTER_HEIGHT}"
      fill="${COLORS.yellow}"
    />

    <text
      x="30"
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
  // STEP 6: EXPORT FINAL JPEG
  // ========================================

  await sharp(imageBase)
    .composite([
      {
        input: Buffer.from(overlaySVG),
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
// SOCIAL META TAGS
//
// These control the information supplied
// to WhatsApp, Facebook and X.
//
// The full article description remains
// available here even though the picture
// focuses mainly on photography.
//
// ==========================================================

function socialMeta(data) {
  const title = htmlEscape(data.title);

  const description =
    htmlEscape(data.description);

  const url = htmlEscape(data.url);

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
// INJECT SERVER-SIDE META TAGS
// ==========================================================

function inject(html, metadata) {
  // Remove old document titles.

  html = html.replace(
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    ""
  );

  // Remove old descriptions / OG / Twitter tags.

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

  // Remove previous canonical URL.

  html = html.replace(
    /<link\b[^>]*>/gi,
    tag =>
      /\brel\s*=\s*["']canonical["']/i.test(tag)
        ? ""
        : tag
  );

  if (!/<\/head>/i.test(html)) {
    throw new Error(
      "HTML template does not contain </head>"
    );
  }

  return html.replace(
    /<\/head>/i,
    socialMeta(metadata) + "\n</head>"
  );
}

// ==========================================================
// PREPARE OUTPUT DIRECTORY
// ==========================================================

fs.rmSync(DIST, {
  recursive: true,
  force: true
});

fs.mkdirSync(DIST, {
  recursive: true
});

// ==========================================================
// COPY EXISTING WEBSITE FILES
//
// Do not remove or change:
// - Admin dashboard
// - PWA
// - Service worker
// - Frontend JavaScript
// - CSS
// - Photographs / icons
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
// SHARE IMAGE OUTPUT FOLDER
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
      "Local diagnostic build only: Firebase articles and branded images were not generated."
    );

    process.exit(0);
  }

  throw new Error(
    "Missing FIREBASE_SERVICE_ACCOUNT_JSON. Configure it in Cloudflare Pages."
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
// FETCH ALL PUBLISHED NEWS
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
// ARTICLE TEMPLATE
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
// GENERATE ALL ARTICLE LANDING PAGES
// ==========================================================

for (const post of posts) {
  if (!validArticleId(post.id)) {
    console.warn(
      "Skipping unsupported article ID:",
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
  // GENERATE NEWS SOCIAL IMAGE
  // ========================================

  if (originalPhoto) {
    const filename =
      `${post.id}-${DESIGN_VERSION}.jpg`;

    const destination = path.join(
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
      // Preserve original Cloudinary photo
      // if branded image generation fails.

      console.warn(
        `Share image failed for ${post.id}:`,
        error.message
      );

      previewImage = originalPhoto;
    }
  }

  // ========================================
  // GENERATE STATIC ARTICLE HTML
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

  const articleDirectory = path.join(
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

  if (!homepageImage && previewImage) {
    homepageImage = previewImage;
    homepageImageBranded = brandedImage;
  }

  articleCount++;

  console.log(
    `Generated ${post.id}: ${
      brandedImage
        ? "photo-first branded preview"
        : previewImage
          ? "original photo fallback"
          : "no image"
    }`
  );
}

// ==========================================================
// HOMEPAGE META TAGS
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
  path.join(DIST, "index.html"),
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
  path.join(DIST, "sitemap.xml"),
  sitemap
);

// ==========================================================
// BUILD RESULTS
// ==========================================================

console.log(
  "=========================================="
);

console.log(
  "FRANK NEWS BUILD COMPLETE"
);

console.log(
  "Design:",
  "Photo-first NEWS card"
);

console.log(
  "Photo area:",
  PHOTO_HEIGHT + "px"
);

console.log(
  "Photo percentage:",
  (
    PHOTO_HEIGHT /
    CARD_HEIGHT *
    100
  ).toFixed(1) + "%"
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
  "Output:",
  DIST
);

console.log(
  "=========================================="
);
