
/* ==========================================================
   #FrankMyMP #FrankMyChoice
   COMPLETE NEWS BUILD SYSTEM

   LARGE-BRANDING EDITION

   Developer: Eng. Amiim Tumwekwase

   Features:
   - Large, readable NEWS branding
   - Two prominent branded hashtags
   - One clear article photograph
   - No blurred or duplicate image
   - Headline below photograph
   - Short excerpt below headline
   - Automatic branded JPEG creation
   - Firebase Firestore news
   - Static article landing pages
   - Open Graph / WhatsApp metadata
   - Twitter / X metadata
   - 10-day publication window
   - XML sitemap
   - Existing PWA/admin files preserved

   IMPORTANT:
   Extended WhatsApp caption text is handled
   by js/ui.js and js/post.js. It is unchanged.
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

const SITE_NAME =
  "#FrankMyMP #FrankMyChoice";

const DESCRIPTION =
  "Latest news and development updates from Rwamwanja, Kamwenge, Uganda.";

const TEN_DAYS_MS =
  10 * 24 * 60 * 60 * 1000;

// ==========================================================
// FINAL IMAGE LAYOUT
// ==========================================================

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

// Must match js/ui.js.
const DESIGN_VERSION = "brand100-v4";

const HEADER_HEIGHT = 100;

const PHOTO_TOP = 100;
const PHOTO_HEIGHT = 340;

const CONTENT_TOP = 440;
const CONTENT_HEIGHT = 155;

const FOOTER_TOP = 595;
const FOOTER_HEIGHT = 35;

const COLORS = {
  yellow: "#FFE15C",
  red: "#C91727",
  black: "#171717",
  white: "#FFFFFF",
  gray: "#525A63",
  photoBackground: "#F3F0E8"
};

// ==========================================================
// HTML AND TEXT HELPERS
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
// VALID ARTICLE ID
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
// TEXT WRAPPING
// ==========================================================

function wrapText(
  value,
  maximumCharacters = 56,
  maximumLines = 2
) {
  const original = cleanText(value);

  if (!original) {
    return [];
  }

  const words = original.split(" ");
  const lines = [];

  let current = "";
  let index = 0;

  for (
    ;
    index < words.length;
    index++
  ) {
    const word = words[index];

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
      current = "";
    }

    if (
      lines.length >= maximumLines
    ) {
      break;
    }

    current =
      word.length > maximumCharacters
        ? word.slice(0, maximumCharacters)
        : word;
  }

  if (
    current &&
    lines.length < maximumLines
  ) {
    lines.push(current);
  }

  if (!lines.length) {
    lines.push(
      original.slice(0, maximumCharacters)
    );
  }

  const displayed =
    lines.join(" ");

  if (
    displayed.length < original.length
  ) {
    const last =
      lines.length - 1;

    lines[last] =
      lines[last]
        .slice(0, maximumCharacters - 1)
        .replace(/[\s,;:.]+$/, "") +
      "…";
  }

  return lines;
}

// ==========================================================
// SVG ARTICLE HEADLINE
// ==========================================================

function headlineSVG(title) {
  const lines = wrapText(
    title,
    52,
    2
  );

  const fontSize =
    lines.length === 1 ? 37 : 33;

  const lineHeight = 39;

  const startY =
    lines.length === 1 ? 490 : 475;

  return lines.map(
    (line, index) => `
      <text
        x="34"
        y="${startY + index * lineHeight}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="800"
        fill="${COLORS.black}"
      >${htmlEscape(line)}</text>
    `
  ).join("\n");
}

// ==========================================================
// DOWNLOAD CLOUDINARY PHOTOGRAPH
// ==========================================================

async function downloadPhoto(url) {
  if (!url) {
    throw new Error(
      "Article photograph is missing"
    );
  }

  const response = await fetch(
    url,
    {
      signal: AbortSignal.timeout(20000)
    }
  );

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
      "Photo URL did not return an image"
    );
  }

  const declaredSize = Number(
    response.headers.get("content-length") || 0
  );

  if (
    declaredSize > 15 * 1024 * 1024
  ) {
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
      "Invalid photograph size"
    );
  }

  return buffer;
}

// ==========================================================
// GENERATE FINAL NEWS CARD
//
// 1200 x 630
//
// 100px - LARGE BRAND HEADER
// 340px - CLEAR PHOTOGRAPH
// 155px - HEADLINE AND EXCERPT
//  35px - WEBSITE FOOTER
//
// No blur.
// No duplicate photograph.
// No text over the main photograph.
// ==========================================================

async function generateShareCard(
  post,
  outputFile
) {
  const originalPhoto =
    imageUrl(post);

  if (!originalPhoto) {
    throw new Error(
      "No photograph attached to article"
    );
  }

  const sourceBuffer =
    await downloadPhoto(originalPhoto);

  // ========================================
  // STEP 1: PREPARE SINGLE CLEAR PHOTO
  //
  // "contain" prevents cropping.
  // Empty space receives a solid color.
  // No blur and no second image.
  // ========================================

  const photoArea = await sharp(
    sourceBuffer,
    {
      limitInputPixels: 40000000
    }
  )
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: PHOTO_HEIGHT,
      fit: "contain",
      background: COLORS.photoBackground
    })
    .flatten({
      background: COLORS.photoBackground
    })
    .png()
    .toBuffer();

  // ========================================
  // STEP 2: CREATE BASE CANVAS
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
  // STEP 3: ARTICLE TEXT
  // ========================================

  const headline = cleanText(
    post.title || "News Update"
  );

  const shortDescription = excerpt(
    post.excerpt ||
    post.body ||
    "",
    125
  );

  const headlineLines =
    wrapText(headline, 52, 2);

  const descriptionLines =
    wrapText(shortDescription, 105, 2);

  // Adjust excerpt position depending
  // on whether headline uses one or two lines.

  const descriptionY =
    headlineLines.length === 1
      ? 526
      : 548;

  const descriptionSize =
    headlineLines.length === 1
      ? 21
      : 18;

  const descriptionSVG =
    descriptionLines.map(
      (line, index) => `
        <text
          x="35"
          y="${descriptionY + index * 23}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${descriptionSize}"
          font-weight="500"
          fill="${COLORS.gray}"
        >${htmlEscape(line)}</text>
      `
    ).join("\n");

  // ========================================
  // STEP 4: LARGE BRANDING
  //
  // NEWS is large on the left.
  // Hashtags are large on two lines.
  //
  // Designed to improve legibility
  // in WhatsApp previews.
  // ========================================

  const overlaySVG = `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="${CARD_WIDTH}"
    height="${CARD_HEIGHT}"
    viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"
  >

    <!-- LARGE YELLOW HEADER -->

    <rect
      x="0"
      y="0"
      width="${CARD_WIDTH}"
      height="${HEADER_HEIGHT}"
      fill="${COLORS.yellow}"
    />

    <!-- RED NEWS LABEL -->

    <rect
      x="0"
      y="0"
      width="230"
      height="${HEADER_HEIGHT}"
      fill="${COLORS.red}"
    />

    <text
      x="115"
      y="65"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="59"
      font-weight="900"
      fill="${COLORS.white}"
    >NEWS</text>

    <!-- BRAND: LINE 1 -->

    <text
      x="270"
      y="46"
      font-family="Arial, Helvetica, sans-serif"
      font-size="44"
      font-weight="900"
      fill="${COLORS.black}"
    >#FrankMyMP</text>

    <!-- BRAND: LINE 2 -->

    <text
      x="270"
      y="90"
      font-family="Arial, Helvetica, sans-serif"
      font-size="44"
      font-weight="900"
      fill="${COLORS.red}"
    >#FrankMyChoice</text>

    <!-- CLEAR PHOTO IS AT Y=100 TO Y=440 -->

    <!-- WHITE HEADLINE PANEL -->

    <rect
      x="0"
      y="${CONTENT_TOP}"
      width="${CARD_WIDTH}"
      height="${CONTENT_HEIGHT}"
      fill="${COLORS.white}"
    />

    <!-- THIN RED ACCENT -->

    <rect
      x="0"
      y="${CONTENT_TOP}"
      width="${CARD_WIDTH}"
      height="5"
      fill="${COLORS.red}"
    />

    <!-- ARTICLE HEADLINE -->

    ${headlineSVG(headline)}

    <!-- SHORT EXCERPT -->

    ${descriptionSVG}

    <!-- FOOTER -->

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
  // STEP 5: EXPORT BRANDED JPEG
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
      quality: 90,
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

<meta
  property="og:type"
  content="${type}"
>

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

<link
  rel="canonical"
  href="${url}"
>
`.trim();
}

// ==========================================================
// INJECT PAGE METADATA
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
      "HTML template does not contain </head>"
    );
  }

  return html.replace(
    /<\/head>/i,
    socialMeta(metadata) + "\n</head>"
  );
}

// ==========================================================
// CREATE CLEAN OUTPUT DIRECTORY
// ==========================================================

fs.rmSync(DIST, {
  recursive: true,
  force: true
});

fs.mkdirSync(DIST, {
  recursive: true
});

// ==========================================================
// PRESERVE PUBLIC WEBSITE AND ADMIN
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
  const source = path.join(ROOT, item);

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
// FIREBASE SERVICE ACCOUNT
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
// FETCH RECENT PUBLISHED NEWS
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
// GENERATE ARTICLES AND NEWS IMAGES
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

  let previewImage =
    originalPhoto;

  let brandedImage = false;

  // ========================================
  // GENERATE LARGE-BRANDING NEWS IMAGE
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
      console.warn(
        `Share image failed for ${post.id}:`,
        error.message
      );

      previewImage =
        originalPhoto;
    }
  }

  // ========================================
  // CREATE ARTICLE HTML
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
        ? "large branding NEWS preview"
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
  path.join(DIST, "sitemap.xml"),
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
  "Design:",
  "LARGE BRANDING NEWS CARD"
);

console.log(
  "Header height:",
  HEADER_HEIGHT + "px"
);

console.log(
  "Photo height:",
  PHOTO_HEIGHT + "px"
);

console.log(
  "Blur:",
  "NONE"
);

console.log(
  "Duplicate photo:",
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
  "Website:",
  SITE_URL
);

console.log(
  "Output:",
  DIST
);

console.log(
  "=========================================="
);
