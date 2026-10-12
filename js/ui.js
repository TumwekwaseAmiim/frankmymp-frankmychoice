
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PUBLIC INTERFACE UTILITIES

   Features:
   - Public news cards
   - Full article links
   - Original uploaded photographs
   - Share NEWS Card as actual JPEG file
   - Share Link with extended article text
   - Native mobile sharing
   - WhatsApp sharing fallback
   - Download NEWS Card fallback
   - Copy article caption
   - Mobile navigation
   - Date formatting
   - Article paragraph utilities

   Eng. Amiim Tumwekwase
===================================================== */

// ==========================================
// DOM HELPERS
// ==========================================

export const $ = (
  selector,
  root = document
) => root.querySelector(selector);

export function el(
  tag,
  className = "",
  text = ""
) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (
    text !== null &&
    text !== undefined
  ) {
    node.textContent = String(text);
  }

  return node;
}

// ==========================================
// WEBSITE CONFIGURATION
// ==========================================

const PUBLIC_SITE_URL =
  "https://frankmymp-frankmychoice.pages.dev";

const SHARE_SUMMARY_LENGTH = 500;

// Must match tools/build.mjs.
const SHARE_DESIGN_VERSION = "photo70-v2";

// ==========================================
// LOCAL DEVELOPMENT
// ==========================================

function isLocalDevelopment() {
  return [
    "localhost",
    "127.0.0.1",
    "0.0.0.0"
  ].includes(window.location.hostname);
}

// ==========================================
// DATE FORMATTING
// ==========================================

export const fmtDate = value => {
  const date =
    value?.toDate?.() ||
    (
      typeof value?.seconds === "number"
        ? new Date(value.seconds * 1000)
        : value
          ? new Date(value)
          : new Date()
    );

  const safeDate =
    date instanceof Date &&
    !Number.isNaN(date.getTime())
      ? date
      : new Date();

  return safeDate.toLocaleDateString(
    "en-UG",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
};

// ==========================================
// ORIGINAL ARTICLE PHOTOGRAPHS
// ==========================================

export function imageOf(post) {
  const images = Array.isArray(post?.images)
    ? post.images
    : [];

  for (const item of images) {
    const url =
      typeof item === "string"
        ? item
        : (
            item?.secure_url ||
            item?.url ||
            item?.src ||
            ""
          );

    if (
      typeof url === "string" &&
      url.startsWith("https://")
    ) {
      return url;
    }
  }

  return "/assets/placeholder.svg";
}

// ==========================================
// ARTICLE IDENTIFIER
// ==========================================

function articleIdentifier(post) {
  return String(
    post?.id ||
    post?.slug ||
    ""
  ).trim();
}

// ==========================================
// ARTICLE PAGE LINK
// ==========================================

export function articleUrl(post) {
  const identifier = articleIdentifier(post);

  if (!identifier) {
    return "/";
  }

  if (isLocalDevelopment()) {
    return (
      "/post.html?slug=" +
      encodeURIComponent(identifier)
    );
  }

  return (
    "/post/" +
    encodeURIComponent(identifier) +
    "/"
  );
}

// ==========================================
// PUBLIC ABSOLUTE ARTICLE URL
// ==========================================

export function publicArticleUrl(post) {
  const identifier = articleIdentifier(post);

  if (!identifier) {
    return PUBLIC_SITE_URL + "/";
  }

  return (
    PUBLIC_SITE_URL +
    "/post/" +
    encodeURIComponent(identifier) +
    "/"
  );
}

// ==========================================
// CLEAN ARTICLE TEXT FOR SHARING
// ==========================================

function cleanShareText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ==========================================
// ARTICLE SUMMARY FOR WHATSAPP
// ==========================================

export function shareSummary(
  post,
  maxLength = SHARE_SUMMARY_LENGTH
) {
  const source =
    post?.body ||
    post?.excerpt ||
    post?.summary ||
    "";

  const cleaned = cleanShareText(source);

  if (!cleaned) {
    return "";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const limit = Math.max(
    1,
    maxLength - 1
  );

  const cut = cleaned.slice(0, limit);

  const lastSpace = Math.max(
    cut.lastIndexOf(" "),
    cut.lastIndexOf("\n")
  );

  const shortened =
    lastSpace > limit * 0.6
      ? cut.slice(0, lastSpace).trim()
      : cut.trim();

  return shortened + "…";
}

// ==========================================
// COMPLETE ARTICLE SHARING MESSAGE
// ==========================================

export function shareMessage(
  url,
  title = "",
  articleText = ""
) {
  const headline =
    String(title || "").trim();

  const summary =
    cleanShareText(articleText);

  const sections = [
    "📰 #FrankMyMP #FrankMyChoice | NEWS UPDATE"
  ];

  if (headline) {
    sections.push(headline);
  }

  if (summary) {
    sections.push(summary);
  }

  sections.push(
    "Read the full story:\n" + url
  );

  return sections.join("\n\n");
}

// ==========================================
// SHARE LINK
//
// Shares longer article text and URL.
//
// The article URL contains the original
// server-generated Open Graph preview.
//
// ==========================================

export async function share(
  url,
  title = "",
  articleText = ""
) {
  if (!url) {
    return;
  }

  const text = shareMessage(
    url,
    title,
    articleText
  );

  // Native mobile Share API.

  if (
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        text
      });

      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      console.warn(
        "Native link sharing failed:",
        error
      );
    }
  }

  // WhatsApp link sharing.

  const whatsappURL =
    "https://wa.me/?text=" +
    encodeURIComponent(text);

  // Navigate rather than rely on a popup
  // that browsers may block.

  window.location.href = whatsappURL;
}

// ==========================================
// BRANDED NEWS IMAGE URL
//
// Matches the current tools/build.mjs:
//
// /assets/share/POST_ID-photo70-v2.jpg
//
// ==========================================

export function newsCardUrl(post) {
  const identifier = articleIdentifier(post);

  if (!identifier) {
    return "";
  }

  return (
    PUBLIC_SITE_URL +
    "/assets/share/" +
    encodeURIComponent(
      identifier +
      "-" +
      SHARE_DESIGN_VERSION +
      ".jpg"
    )
  );
}

// ==========================================
// COPY TEXT
// ==========================================

async function copyText(value) {
  if (!value) {
    return false;
  }

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error(
        "Clipboard unavailable"
      );
    }

    await navigator.clipboard.writeText(
      value
    );

    return true;

  } catch (error) {
    window.prompt(
      "Copy this article text:",
      value
    );

    return false;
  }
}

// ==========================================
// DOWNLOAD IMAGE FILE
// ==========================================

function downloadNewsImage(
  imageURL,
  filename
) {
  const link = document.createElement("a");

  link.href = imageURL;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  document.body.append(link);
  link.click();
  link.remove();
}

// ==========================================
// SHARE ACTUAL NEWS IMAGE
//
// Device behavior:
//
// 1. Download published branded JPEG.
//
// 2. Convert it to a File object.
//
// 3. Check whether native file sharing
//    is supported.
//
// 4. If supported, pass JPEG + caption
//    to the device's share menu.
//
// 5. If unsupported, provide the image
//    and caption for manual sharing.
//
// Important:
// Apps such as WhatsApp may choose to
// omit text supplied with an image file.
// That is controlled by the receiving app.
//
// ==========================================

export async function shareNewsCard(
  post
) {
  const identifier = articleIdentifier(post);

  if (!identifier) {
    alert(
      "This news article does not have a valid link."
    );

    return;
  }

  const imageURL = newsCardUrl(post);

  const articleLink = publicArticleUrl(post);

  const title =
    post?.title || "News Update";

  const summary = shareSummary(
    post,
    SHARE_SUMMARY_LENGTH
  );

  const caption = shareMessage(
    articleLink,
    title,
    summary
  );

  const filename =
    "FrankNews-" +
    identifier +
    ".jpg";

  try {
    // Fetch the generated image.
    // We only use the official published URL.

    const response = await fetch(
      imageURL,
      {
        mode: "cors",
        cache: "no-cache"
      }
    );

    if (!response.ok) {
      throw new Error(
        "NEWS image unavailable: HTTP " +
        response.status
      );
    }

    const type = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    if (!type.includes("image/jpeg")) {
      throw new Error(
        "Published NEWS card is not a JPEG image"
      );
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error(
        "The NEWS image is empty"
      );
    }

    const file = new File(
      [blob],
      filename,
      {
        type: "image/jpeg"
      }
    );

    // Check native file sharing.

    const canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({
        files: [file]
      });

    if (canShareFile) {
      try {
        // Some receiving apps preserve
        // caption + URL; others omit them.

        await navigator.share({
          files: [file],
          text: caption
        });

        return;

      } catch (error) {
        if (
          error?.name === "AbortError"
        ) {
          return;
        }

        console.warn(
          "NEWS card native sharing failed:",
          error
        );
      }
    }

    // ======================================
    // FALLBACK FOR UNSUPPORTED DEVICES
    // ======================================

    // First copy the caption so the reader
    // can paste it into WhatsApp.

    const copied = await copyText(
      caption
    );

    // Then initiate the image download.

    downloadNewsImage(
      imageURL,
      filename
    );

    alert(
      copied
        ? "NEWS card opened for saving and article caption copied. Share the image in WhatsApp, then paste the caption."
        : "NEWS card opened for saving. Share it in WhatsApp and copy the article text from the prompt."
    );

  } catch (error) {
    console.warn(
      "NEWS card sharing unavailable:",
      error
    );

    // If the branded image is not available,
    // preserve the working link-sharing route.

    const useLink = window.confirm(
      "The NEWS image is not available yet. Share the article text and link instead?"
    );

    if (useLink) {
      await share(
        articleLink,
        title,
        summary
      );
    }
  }
}

// ==========================================
// PUBLIC NEWS CARD
// ==========================================

export function card(
  post,
  compact = false
) {
  const wrapper = el(
    "article",
    "card" + (compact ? " compact" : "")
  );

  const articleLink = articleUrl(post);

  // ======================================
  // CLICKABLE ARTICLE CONTENT
  // ======================================

  const link = el(
    "a",
    "card-link"
  );

  link.href = articleLink;

  link.setAttribute(
    "aria-label",
    "Read: " +
      (post.title || "News article")
  );

  // ======================================
  // PHOTOGRAPH
  // ======================================

  const image = el(
    "img",
    "card-cover"
  );

  image.src = imageOf(post);
  image.alt =
    post.title || "News photograph";

  image.loading = "lazy";
  image.decoding = "async";

  link.append(image);

  // ======================================
  // ARTICLE CONTENT
  // ======================================

  const body = el(
    "div",
    "card-body"
  );

  // Category.

  const category =
    typeof post.category === "string"
      ? post.category.trim()
      : "";

  if (
    category &&
    category.toLowerCase() !== "none"
  ) {
    body.append(
      el(
        "div",
        "category",
        category
      )
    );
  }

  // Headline.

  body.append(
    el(
      "h3",
      "",
      post.title || "Untitled"
    )
  );

  // Description.

  if (post.excerpt) {
    body.append(
      el(
        "p",
        "summary",
        post.excerpt
      )
    );
  }

  // Publication date.

  body.append(
    el(
      "div",
      "meta",
      fmtDate(
        post.publishedAt ||
        post.createdAt
      )
    )
  );

  link.append(body);

  wrapper.append(link);

  // ======================================
  // SHARING BUTTON AREA
  // ======================================

  const shareArea = el(
    "div",
    "card-share-area"
  );

  shareArea.style.display = "flex";
  shareArea.style.flexWrap = "wrap";
  shareArea.style.gap = "8px";

  // ======================================
  // BUTTON 1: SHARE NEWS CARD
  // ======================================

  const cardButton = el(
    "button",
    "card-share-btn",
    "🖼 Share NEWS Card"
  );

  cardButton.type = "button";

  cardButton.setAttribute(
    "aria-label",
    "Share NEWS photograph and article: " +
      (post.title || "News")
  );

  cardButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      cardButton.disabled = true;

      const previousText =
        cardButton.textContent;

      cardButton.textContent =
        "Preparing NEWS Card…";

      try {
        await shareNewsCard(post);
      } finally {
        cardButton.disabled = false;

        cardButton.textContent =
          previousText;
      }
    }
  );

  // ======================================
  // BUTTON 2: SHARE ARTICLE LINK
  // ======================================

  const linkButton = el(
    "button",
    "card-share-btn",
    "↗ Share Link"
  );

  linkButton.type = "button";

  linkButton.setAttribute(
    "aria-label",
    "Share article text and link: " +
      (post.title || "News")
  );

  linkButton.style.background =
    "transparent";

  linkButton.style.border =
    "1px solid #C91727";

  linkButton.style.color =
    "#C91727";

  linkButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      const url = publicArticleUrl(post);

      const title =
        post.title || "News Update";

      const summary = shareSummary(
        post,
        SHARE_SUMMARY_LENGTH
      );

      await share(
        url,
        title,
        summary
      );
    }
  );

  shareArea.append(
    cardButton,
    linkButton
  );

  wrapper.append(shareArea);

  return wrapper;
}

// ==========================================
// MOBILE NAVIGATION
// ==========================================

export function menu() {
  const button = $("#menuBtn");

  const nav = $("#nav");

  button?.addEventListener(
    "click",
    () => {
      if (!nav) {
        return;
      }

      const isOpen =
        nav.classList.toggle("open");

      button.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }
  );

  // NRM emblem.

  const logo = $("#nrmLogo");

  if (logo) {
    logo.onload = () => {
      logo.classList.remove(
        "hidden"
      );
    };

    logo.onerror = () => {
      logo.classList.add(
        "hidden"
      );
    };

    if (
      logo.complete &&
      logo.naturalWidth > 0
    ) {
      logo.classList.remove(
        "hidden"
      );
    }
  }
}

// ==========================================
// EMPTY STATES
// ==========================================

export function message(
  node,
  text
) {
  if (!node) {
    return;
  }

  node.replaceChildren(
    el(
      "div",
      "empty",
      text
    )
  );
}

// ==========================================
// ARTICLE PARAGRAPHS
// ==========================================

export function paragraphs(
  container,
  text
) {
  const parts = String(
    text || ""
  ).split(/\n\s*\n/);

  parts.forEach(part => {
    if (part.trim()) {
      container.append(
        el(
          "p",
          "",
          part.trim()
        )
      );
    }
  });
}
