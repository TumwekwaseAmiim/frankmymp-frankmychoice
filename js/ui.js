
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PUBLIC INTERFACE UTILITIES

   News Cards
   Complete Photographs
   Article Links
   Detailed WhatsApp Sharing
   Native Sharing
   Mobile Navigation
   Date Formatting
   Comments and Article Helpers
===================================================== */

// ==========================================
// DOM HELPERS
// ==========================================

export const $ = (selector, root = document) =>
  root.querySelector(selector);

export function el(
  tag,
  className = "",
  text = ""
) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== null && text !== undefined) {
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

function isLocalDevelopment() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0"
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

  return date.toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

// ==========================================
// NEWS PHOTOGRAPHS
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
            item?.url ||
            item?.secure_url ||
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
  return post?.id || post?.slug || "";
}

// ==========================================
// ARTICLE LINK GENERATION
// ==========================================

export function articleUrl(post) {
  const identifier = articleIdentifier(post);

  if (!identifier) {
    return "/";
  }

  // Local VS Code Live Server.

  if (isLocalDevelopment()) {
    return (
      "/post.html?slug=" +
      encodeURIComponent(identifier)
    );
  }

  // Cloudflare-generated article page.

  return (
    "/post/" +
    encodeURIComponent(identifier) +
    "/"
  );
}

// ==========================================
// PUBLIC ARTICLE SHARING URL
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
// PREPARE ARTICLE SUMMARY FOR SHARING
//
// Uses actual saved article content.
// Never invents or adds article information.
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

  const cleaned = String(source)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const shortened = cleaned
    .slice(0, maxLength - 1)
    .replace(/\s+\S*$/, "")
    .trim();

  return (
    (shortened || cleaned.slice(0, maxLength - 1)) +
    "…"
  );
}

// ==========================================
// PREPARE COMPLETE SHARE MESSAGE
// ==========================================

export function shareMessage(
  url,
  title = "",
  articleText = ""
) {
  const headline = String(title || "").trim();

  const summary = String(articleText || "").trim();

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
// SHARE ARTICLE
//
// Native Share API on phones.
// WhatsApp fallback on desktops.
// Clipboard fallback if needed.
//
// The article URL still points to the
// same branded Cloudflare landing page.
//
// WhatsApp automatically reads its:
// og:title
// og:description
// og:image
//
// WhatsApp controls preview display.
// ==========================================

export async function share(
  url,
  title = "",
  articleText = ""
) {
  if (!url) return;

  const completeMessage = shareMessage(
    url,
    title,
    articleText
  );

  // ======================================
  // MOBILE / NATIVE SHARE
  // ======================================

  if (
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({
        text: completeMessage
      });

      return;

    } catch (error) {
      if (
        error?.name === "AbortError"
      ) {
        return;
      }

      console.warn(
        "Native sharing unavailable:",
        error
      );
    }
  }

  // ======================================
  // WHATSAPP SHARE FALLBACK
  // ======================================

  const whatsAppURL =
    "https://wa.me/?text=" +
    encodeURIComponent(
      completeMessage
    );

  const opened = window.open(
    whatsAppURL,
    "_blank",
    "noopener,noreferrer"
  );

  if (opened !== null) {
    return;
  }

  // ======================================
  // COPY MESSAGE IF POPUP BLOCKED
  // ======================================

  try {
    await navigator.clipboard.writeText(
      completeMessage
    );

    alert(
      "News headline, article summary and link copied. You can paste them into WhatsApp."
    );

  } catch (error) {
    window.prompt(
      "Copy this news article:",
      completeMessage
    );
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
    "Read: " + (
      post.title || "News article"
    )
  );

  // ======================================
  // NEWS PHOTOGRAPH
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
  // ARTICLE DETAILS
  // ======================================

  const body = el(
    "div",
    "card-body"
  );

  // CATEGORY

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

  // HEADLINE

  body.append(
    el(
      "h3",
      "",
      post.title || "Untitled"
    )
  );

  // ARTICLE DESCRIPTION

  if (post.excerpt) {
    body.append(
      el(
        "p",
        "summary",
        post.excerpt
      )
    );
  }

  // PUBLICATION DATE

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
  // SHARE BUTTON
  // ======================================

  const shareArea = el(
    "div",
    "card-share-area"
  );

  const shareButton = el(
    "button",
    "card-share-btn",
    "↗ Share"
  );

  shareButton.type = "button";

  shareButton.setAttribute(
    "aria-label",
    "Share " +
    (
      post.title || "this news article"
    )
  );

  shareButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();

      event.stopPropagation();

      const url =
        publicArticleUrl(post);

      const title =
        post.title ||
        "News Update";

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
    shareButton
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
  const button = $("#menuBtn");

  const nav = $("#nav");

  button?.addEventListener(
    "click",
    () => {
      if (!nav) return;

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

  // NRM EMBLEM

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
  if (!node) return;

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

  parts.forEach(
    part => {
      if (
        part.trim()
      ) {
        container.append(
          el(
            "p",
            "",
            part.trim()
          )
        );
      }
    }
  );
}
