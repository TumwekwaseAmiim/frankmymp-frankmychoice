
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PUBLIC INTERFACE UTILITIES

   News Cards
   Complete Photographs
   Article Links
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
// SHARE ARTICLE

// IMPORTANT:
// Share only the article URL.
//
// The recipient's application retrieves:
// og:title
// og:description
// og:image
//
// from the server-generated article HTML.
//
// WhatsApp controls the final card layout.
// ==========================================

export async function share(url, title = "") {
  if (!url) return;

  // Native sharing on supported devices.

  if (navigator.share) {
    try {
      await navigator.share({
        url
      });

      return;
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.warn(
        "Native sharing unavailable:",
        error
      );
    }
  }

  // Clipboard fallback.

  try {
    await navigator.clipboard.writeText(url);

    alert(
      "News article link copied. You can now share it."
    );
  } catch (error) {
    window.prompt(
      "Copy this news article link:",
      url
    );
  }
}

// ==========================================
// PUBLIC NEWS CARD
// ==========================================

export function card(post, compact = false) {
  const wrapper = el(
    "article",
    "card" + (compact ? " compact" : "")
  );

  const articleLink = articleUrl(post);

  // ======================================
  // CLICKABLE ARTICLE CONTENT
  // ======================================

  const link = el("a", "card-link");

  link.href = articleLink;

  link.setAttribute(
    "aria-label",
    "Read: " + (post.title || "News article")
  );

  // ======================================
  // NEWS PHOTOGRAPH
  // ======================================

  const image = el("img", "card-cover");

  image.src = imageOf(post);
  image.alt = post.title || "News photograph";
  image.loading = "lazy";

  image.decoding = "async";

  link.append(image);

  // ======================================
  // ARTICLE DETAILS
  // ======================================

  const body = el("div", "card-body");

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
      el("div", "category", category)
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

  // DESCRIPTION

  if (post.excerpt) {
    body.append(
      el("p", "summary", post.excerpt)
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
      (post.title || "this news article")
  );

  shareButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      const url = publicArticleUrl(post);

      await share(url);
    }
  );

  shareArea.append(shareButton);
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
      if (!nav) return;

      const isOpen =
        nav.classList.toggle("open");

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
      logo.classList.remove("hidden");
    };

    logo.onerror = () => {
      logo.classList.add("hidden");
    };

    if (
      logo.complete &&
      logo.naturalWidth > 0
    ) {
      logo.classList.remove("hidden");
    }
  }
}

// ==========================================
// EMPTY STATES
// ==========================================

export function message(node, text) {
  if (!node) return;

  node.replaceChildren(
    el("div", "empty", text)
  );
}

// ==========================================
// ARTICLE PARAGRAPHS
// ==========================================

export function paragraphs(
  container,
  text
) {
  const parts = String(text || "")
    .split(/\n\s*\n/);

  parts.forEach(part => {
    if (part.trim()) {
      container.append(
        el("p", "", part.trim())
      );
    }
  });
}
