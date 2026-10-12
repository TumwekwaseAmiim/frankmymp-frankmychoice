
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PUBLIC INTERFACE UTILITIES

   FINAL FULL-PHOTO SHARING EDITION

   FEATURES
   --------------------------------------------------
   - Public news cards
   - Original article photographs
   - Full article landing-page links
   - Share actual branded NEWS JPEG
   - Full clear photograph sharing
   - No blurred duplicate photograph
   - Approximately 500 characters of story text
   - Clickable full-story URL
   - Native mobile sharing
   - WhatsApp link sharing
   - Image download fallback
   - Copy caption fallback
   - Mobile navigation
   - Date formatting
   - Article paragraph helpers

   Compatible with:
   tools/build.mjs DESIGN_VERSION = "fullphoto-v3"

   Developer: Eng. Amiim Tumwekwase
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

// Length of article text shared in WhatsApp.
const SHARE_SUMMARY_LENGTH = 500;

// IMPORTANT:
// This must match tools/build.mjs.
const SHARE_DESIGN_VERSION = "fullphoto-v3";

// ==========================================
// LOCAL DEVELOPMENT
// ==========================================

function isLocalDevelopment() {
  return [
    "localhost",
    "127.0.0.1",
    "0.0.0.0"
  ].includes(
    window.location.hostname
  );
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
// ORIGINAL ARTICLE PHOTOGRAPH
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
// LOCAL / PUBLIC ARTICLE LINK
// ==========================================

export function articleUrl(post) {
  const identifier =
    articleIdentifier(post);

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
// ABSOLUTE PUBLIC ARTICLE LINK
// ==========================================

export function publicArticleUrl(post) {
  const identifier =
    articleIdentifier(post);

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
// CLEAN ARTICLE TEXT
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
// PREPARE LONG ARTICLE EXTRACT
//
// Uses only actual saved article text.
// Does not invent content.
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

  const cleaned =
    cleanShareText(source);

  if (!cleaned) {
    return "";
  }

  if (
    cleaned.length <= maxLength
  ) {
    return cleaned;
  }

  const limit = Math.max(
    1,
    maxLength - 1
  );

  const cut =
    cleaned.slice(0, limit);

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
// COMPLETE WHATSAPP MESSAGE
//
// BRAND
// HEADLINE
// ARTICLE EXTRACT
// FULL STORY LINK
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
// SHARE ARTICLE LINK
//
// Sends:
// - News brand
// - Headline
// - Approximately 500 characters
// - Full article URL
//
// The article URL still contains the
// generated Open Graph image metadata.
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

  // Native mobile sharing.

  if (
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        text
      });

      return;

    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        return;
      }

      console.warn(
        "Native link sharing failed:",
        error
      );
    }
  }

  // WhatsApp fallback.

  const whatsappURL =
    "https://wa.me/?text=" +
    encodeURIComponent(text);

  window.location.href =
    whatsappURL;
}

// ==========================================
// FULL-PHOTO NEWS CARD URL
//
// Must match:
// tools/build.mjs
//
// DESIGN_VERSION = "fullphoto-v3"
//
// File generated:
// /assets/share/POST_ID-fullphoto-v3.jpg
//
// ==========================================

export function newsCardUrl(post) {
  const identifier =
    articleIdentifier(post);

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
// COPY ARTICLE CAPTION
// ==========================================

async function copyText(value) {
  if (!value) {
    return false;
  }

  try {
    if (
      !navigator.clipboard?.writeText
    ) {
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
// SAVE NEWS IMAGE
//
// Uses a Blob URL when an image Blob
// is already available.
// ==========================================

function downloadNewsImage(
  blob,
  filename
) {
  const objectURL =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href =
    objectURL;

  link.download =
    filename;

  document.body.append(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectURL);
  }, 1000);
}

// ==========================================
// SHARE ACTUAL NEWS CARD
//
// MAIN FEATURES:
//
// - Gets the full clear news image
// - Attaches the image on supported phones
// - Sends approximately 500 characters
// - Includes the full-story link
// - Preserves a download/copy fallback
//
// IMPORTANT:
// WhatsApp may omit text supplied alongside
// a file attachment on some devices.
// This cannot be forced from a website.
// ==========================================

export async function shareNewsCard(post) {
  const identifier =
    articleIdentifier(post);

  if (!identifier) {
    alert(
      "This article does not have a valid link."
    );

    return;
  }

  const imageURL =
    newsCardUrl(post);

  const articleLink =
    publicArticleUrl(post);

  const title =
    post?.title || "News Update";

  const summary =
    shareSummary(
      post,
      SHARE_SUMMARY_LENGTH
    );

  const caption =
    shareMessage(
      articleLink,
      title,
      summary
    );

  const filename =
    "FrankNews-" +
    identifier +
    ".jpg";

  try {
    // ======================================
    // FETCH PUBLISHED NEWS IMAGE
    // ======================================

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
      response.headers.get(
        "content-type"
      ) || ""
    ).toLowerCase();

    if (
      !type.includes("image/jpeg")
    ) {
      throw new Error(
        "The published NEWS card is not a JPEG image."
      );
    }

    const blob =
      await response.blob();

    if (!blob.size) {
      throw new Error(
        "The NEWS photograph is empty."
      );
    }

    // ======================================
    // BUILD SHAREABLE FILE
    // ======================================

    const file = new File(
      [blob],
      filename,
      {
        type: "image/jpeg"
      }
    );

    // ======================================
    // CHECK DEVICE SUPPORT
    // ======================================

    let canShareFile = false;

    try {
      canShareFile =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({
          files: [file]
        });

    } catch (error) {
      console.warn(
        "File sharing check failed:",
        error
      );
    }

    // ======================================
    // NATIVE IMAGE SHARING
    // ======================================

    if (canShareFile) {
      try {
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
          "Native NEWS card sharing failed:",
          error
        );
      }
    }

    // ======================================
    // FALLBACK: IMAGE + COPIED CAPTION
    // ======================================

    const copied =
      await copyText(caption);

    downloadNewsImage(
      blob,
      filename
    );

    alert(
      copied
        ? "NEWS card saved and article caption copied. Send the picture in WhatsApp and paste the caption."
        : "NEWS card saved. Send the picture in WhatsApp, then copy and paste the article caption."
    );

  } catch (error) {
    console.warn(
      "NEWS card sharing error:",
      error
    );

    const useLink =
      window.confirm(
        "The full-photo NEWS image is not available. Share the article text and link instead?"
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
    "card" +
      (compact ? " compact" : "")
  );

  const articleLink =
    articleUrl(post);

  // ======================================
  // CLICKABLE NEWS CONTENT
  // ======================================

  const link = el(
    "a",
    "card-link"
  );

  link.href =
    articleLink;

  link.setAttribute(
    "aria-label",
    "Read: " +
      (post.title || "News article")
  );

  // ======================================
  // ORIGINAL NEWS PHOTOGRAPH
  // ======================================

  const image = el(
    "img",
    "card-cover"
  );

  image.src =
    imageOf(post);

  image.alt =
    post.title || "News photograph";

  image.loading =
    "lazy";

  image.decoding =
    "async";

  link.append(
    image
  );

  // ======================================
  // NEWS DETAILS
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
  // SHARING BUTTONS
  // ======================================

  const shareArea = el(
    "div",
    "card-share-area"
  );

  shareArea.style.display =
    "flex";

  shareArea.style.flexWrap =
    "wrap";

  shareArea.style.gap =
    "8px";

  // ======================================
  // BUTTON 1: SHARE FULL-PHOTO NEWS CARD
  // ======================================

  const cardButton = el(
    "button",
    "card-share-btn",
    "🖼 Share NEWS Card"
  );

  cardButton.type = "button";

  cardButton.setAttribute(
    "aria-label",
    "Share the full-photo NEWS image: " +
      (post.title || "News")
  );

  cardButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();

      event.stopPropagation();

      const previousText =
        cardButton.textContent;

      cardButton.disabled = true;

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

      const url =
        publicArticleUrl(post);

      const title =
        post.title || "News Update";

      const summary =
        shareSummary(
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

  wrapper.append(
    shareArea
  );

  return wrapper;
}

// ==========================================
// MOBILE NAVIGATION
// ==========================================

export function menu() {
  const button =
    $("#menuBtn");

  const nav =
    $("#nav");

  button?.addEventListener(
    "click",
    () => {
      if (!nav) {
        return;
      }

      const isOpen =
        nav.classList.toggle(
          "open"
        );

      button.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }
  );

  // NRM emblem.

  const logo =
    $("#nrmLogo");

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
