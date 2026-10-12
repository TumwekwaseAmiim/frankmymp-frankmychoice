
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PUBLIC NEWS ARTICLE PAGE

   FINAL ARTICLE + ZOOM COMPATIBLE EDITION

   FEATURES
   --------------------------------------------------
   - Firebase Firestore articles
   - Cloudinary article photographs
   - Compatible with 2-second post.html zoom
   - Share Link as primary option
   - Branded NEWS JPEG sharing
   - 500-character article sharing
   - Full clickable article URLs
   - WhatsApp, Facebook and X
   - Reader comments and moderation
   - Cloudflare comment submission
   - Article visitor counts
   - 10-day publication window
   - Mobile and desktop compatibility

   Developer: Eng. Amiim Tumwekwase
===================================================== */

// ==========================================
// FIREBASE IMPORTS
// ==========================================

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ==========================================
// APPLICATION IMPORTS
// ==========================================

import { db } from "./firebase.js";

import {
  $,
  el,
  fmtDate,
  imageOf,
  message,
  paragraphs,
  shareSummary,
  shareMessage,
  share,
  shareNewsCard
} from "./ui.js";

import {
  SITE_URL,
  SITE_TITLE
} from "./config.js";

// ==========================================
// CONFIGURATION
// ==========================================

const API_BASE =
  "https://frank-news-api.tumwekwaseamiim.workers.dev";

const COMMENT_API =
  API_BASE + "/comments";

const VISIT_API =
  API_BASE + "/record-visit";

const TEN_DAYS_MS =
  10 * 24 * 60 * 60 * 1000;

const MAX_NAME_LENGTH = 80;

const MAX_COMMENT_LENGTH = 2000;

const SHARE_TEXT_LENGTH = 500;

// ==========================================
// PAGE ELEMENTS
// ==========================================

const article = $("#article");

const commentsRoot = $("#comments");

const commentForm = $("#commentForm");

const sharingSection =
  document.querySelector(".article-sharing");

const year = $("#year");

if (year) {
  year.textContent =
    new Date().getFullYear();
}

let post = null;

// ==========================================
// GET ARTICLE IDENTIFIER
// ==========================================

function getArticleId() {
  const parts = window.location.pathname
    .split("/")
    .filter(Boolean);

  // Production route:
  // /post/ARTICLE_ID/

  if (
    parts[0] === "post" &&
    parts[1]
  ) {
    try {
      return decodeURIComponent(
        parts[1]
      );
    } catch {
      return "";
    }
  }

  // Local route:
  // /post.html?slug=ARTICLE_ID

  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    params.get("slug") ||
    params.get("id") ||
    ""
  );
}

const postId = getArticleId();

// ==========================================
// PUBLIC ARTICLE URL
//
// Important:
// This is the URL that WhatsApp readers
// can tap to open the full story.
// ==========================================

function getPublicArticleUrl() {
  const base = String(
    SITE_URL || ""
  ).replace(/\/+$/, "");

  if (!postId) {
    return base + "/";
  }

  return (
    base +
    "/post/" +
    encodeURIComponent(postId) +
    "/"
  );
}

// ==========================================
// ARTICLE PUBLICATION WINDOW
// ==========================================

function isRecent(value) {
  if (!value) {
    return false;
  }

  let milliseconds = 0;

  if (
    typeof value.toMillis === "function"
  ) {
    milliseconds =
      value.toMillis();

  } else if (
    typeof value.seconds === "number"
  ) {
    milliseconds =
      value.seconds * 1000;

  } else {
    milliseconds =
      new Date(value).getTime();
  }

  const now = Date.now();

  return (
    Number.isFinite(milliseconds) &&
    milliseconds <= now &&
    now - milliseconds < TEN_DAYS_MS
  );
}

// ==========================================
// SHARING STATUS
// ==========================================

function setShareStatus(text) {
  const node = $("#shareStatus");

  if (node) {
    node.textContent = text;
  }
}

// ==========================================
// PRIMARY SHARING BUTTONS
//
// BUTTON 1: Share Link
// BUTTON 2: Share NEWS Card
//
// SHARE LINK is primary because the
// WhatsApp link preview opens the website
// when tapped.
//
// An attached JPEG opens the WhatsApp
// image viewer instead.
// ==========================================

function setupPrimaryShareButtons(
  newsPost,
  url,
  title,
  summary
) {
  if (!sharingSection) {
    return;
  }

  // Prevent duplicate controls.

  const previous = $(
    "#articlePrimarySharing",
    sharingSection
  );

  previous?.remove();

  const buttonArea = el(
    "div",
    "actions"
  );

  buttonArea.id =
    "articlePrimarySharing";

  buttonArea.style.display =
    "flex";

  buttonArea.style.flexWrap =
    "wrap";

  buttonArea.style.gap =
    "10px";

  buttonArea.style.marginBottom =
    "18px";

  // ======================================
  // PRIMARY: SHARE ARTICLE LINK
  // ======================================

  const linkButton = el(
    "button",
    "btn",
    "↗ Share Link — Open Article"
  );

  linkButton.type = "button";

  linkButton.style.background =
    "#C91727";

  linkButton.style.color =
    "#FFFFFF";

  linkButton.style.border =
    "1px solid #C91727";

  linkButton.setAttribute(
    "aria-label",
    "Share the article link, full-story address and news summary"
  );

  linkButton.addEventListener(
    "click",
    async () => {
      linkButton.disabled = true;

      const oldText =
        linkButton.textContent;

      linkButton.textContent =
        "Opening sharing…";

      try {
        await share(
          url,
          title,
          summary
        );

        setShareStatus(
          "The article URL opens the full story. The article page includes the two-second NEWS zoom."
        );

      } catch (error) {
        console.warn(
          "Article link sharing failed:",
          error
        );

        setShareStatus(
          "Unable to open sharing. Please try WhatsApp or Copy Link."
        );

      } finally {
        linkButton.disabled = false;

        linkButton.textContent =
          oldText;
      }
    }
  );

  // ======================================
  // SECONDARY: SHARE JPEG NEWS CARD
  // ======================================

  const imageButton = el(
    "button",
    "btn secondary",
    "🖼 Share NEWS Card"
  );

  imageButton.type = "button";

  imageButton.style.background =
    "#FFE15C";

  imageButton.style.color =
    "#171717";

  imageButton.style.border =
    "1px solid #E3B820";

  imageButton.setAttribute(
    "aria-label",
    "Share the branded NEWS photograph and article caption"
  );

  imageButton.addEventListener(
    "click",
    async () => {
      const previousText =
        imageButton.textContent;

      imageButton.disabled = true;

      imageButton.textContent =
        "Preparing NEWS Card…";

      setShareStatus(
        "Preparing the branded NEWS image…"
      );

      try {
        await shareNewsCard(
          newsPost
        );

        setShareStatus(
          "The JPEG opens as a photograph in WhatsApp. Use Share Link when you want readers to tap through to the website."
        );

      } catch (error) {
        console.warn(
          "NEWS image sharing failed:",
          error
        );

        setShareStatus(
          "NEWS Card unavailable. Please use Share Link."
        );

      } finally {
        imageButton.disabled = false;

        imageButton.textContent =
          previousText;
      }
    }
  );

  buttonArea.append(
    linkButton,
    imageButton
  );

  // Place buttons above the usual
  // WhatsApp, Facebook and X controls.

  sharingSection.prepend(
    buttonArea
  );
}

// ==========================================
// SETUP SOCIAL SHARING
// ==========================================

function setupSharing(newsPost) {
  const title =
    newsPost.title || SITE_TITLE;

  const description =
    newsPost.excerpt || "";

  const url =
    getPublicArticleUrl();

  // Preserve the long article excerpt.

  const summary =
    shareSummary(
      newsPost,
      SHARE_TEXT_LENGTH
    );

  const fullShareText =
    shareMessage(
      url,
      title,
      summary
    );

  document.title =
    `${title} | ${SITE_TITLE}`;

  // Browser description only.
  // The build creates Open Graph tags
  // in static HTML for WhatsApp.

  const descriptionMeta =
    document.querySelector(
      'meta[name="description"]'
    );

  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      "content",
      description ||
        "Read the latest news and updates."
    );
  }

  setupPrimaryShareButtons(
    newsPost,
    url,
    title,
    summary
  );

  // ======================================
  // WHATSAPP LINK SHARING
  // ======================================

  const whatsapp =
    $("#shareWhatsApp");

  if (whatsapp) {
    whatsapp.href =
      "https://wa.me/?text=" +
      encodeURIComponent(
        fullShareText
      );

    whatsapp.target = "_blank";

    whatsapp.rel =
      "noopener noreferrer";
  }

  // ======================================
  // FACEBOOK
  // ======================================

  const facebook =
    $("#shareFacebook");

  if (facebook) {
    facebook.href =
      "https://www.facebook.com/sharer/sharer.php?u=" +
      encodeURIComponent(url);

    facebook.target = "_blank";

    facebook.rel =
      "noopener noreferrer";
  }

  // ======================================
  // X
  // ======================================

  const xButton =
    $("#shareX");

  if (xButton) {
    xButton.href =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(
        "📰 " + title
      ) +
      "&url=" +
      encodeURIComponent(url);

    xButton.target = "_blank";

    xButton.rel =
      "noopener noreferrer";
  }

  // ======================================
  // COPY FULL ARTICLE URL
  // ======================================

  const copyButton =
    $("#copyArticleLink");

  if (copyButton) {
    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          url
        );

        setShareStatus(
          "Full article link copied successfully."
        );

      } catch (error) {
        window.prompt(
          "Copy article link:",
          url
        );
      }
    };
  }

  sharingSection?.classList.remove(
    "hidden"
  );
}

// ==========================================
// ARTICLE PHOTOGRAPHS
//
// Full original images,
// no unnecessary cropping.
// ==========================================

function renderPhotographs(newsPost) {
  const pictures =
    Array.isArray(newsPost.images)
      ? newsPost.images
          .map(item => {
            if (
              typeof item === "string"
            ) {
              return {
                url: item
              };
            }

            return {
              ...item,
              url:
                item?.secure_url ||
                item?.url ||
                item?.src ||
                ""
            };
          })
          .filter(item =>
            typeof item.url === "string" &&
            item.url.startsWith("https://")
          )
          .slice(0, 3)
      : [];

  if (!pictures.length) {
    return;
  }

  // ======================================
  // MAIN PHOTOGRAPH
  // ======================================

  const mainPhoto = el(
    "img",
    "photo"
  );

  mainPhoto.src =
    imageOf({
      images: pictures
    });

  mainPhoto.alt =
    newsPost.title ||
    "News photograph";

  mainPhoto.loading =
    "eager";

  mainPhoto.decoding =
    "async";

  mainPhoto.style.marginTop =
    "25px";

  article.append(
    mainPhoto
  );

  // ======================================
  // ADDITIONAL PHOTOGRAPHS
  // ======================================

  if (pictures.length > 1) {
    const photoGrid = el(
      "div",
      "photo-grid"
    );

    pictures.slice(1).forEach(
      (picture, index) => {
        const image = el(
          "img"
        );

        image.src =
          picture.url;

        image.alt =
          "Article photograph " +
          (index + 2);

        image.loading =
          "lazy";

        image.decoding =
          "async";

        photoGrid.append(
          image
        );
      }
    );

    article.append(
      photoGrid
    );
  }
}

// ==========================================
// APPROVED READER COMMENTS
// ==========================================

async function loadComments() {
  if (
    !commentsRoot ||
    !postId
  ) {
    return;
  }

  commentsRoot.replaceChildren();

  try {
    const snapshot = await getDocs(
      query(
        collection(
          db,
          "comments"
        ),

        where(
          "postId",
          "==",
          postId
        ),

        where(
          "status",
          "==",
          "approved"
        ),

        orderBy(
          "createdAt",
          "desc"
        ),

        limit(50)
      )
    );

    if (snapshot.empty) {
      commentsRoot.append(
        el(
          "p",
          "muted",
          "No published comments yet."
        )
      );

      return;
    }

    snapshot.docs.forEach(
      document => {
        const comment =
          document.data();

        const node = el(
          "div",
          "comment"
        );

        node.append(
          el(
            "strong",
            "",
            comment.name || "Reader"
          ),

          el(
            "p",
            "",
            comment.text || ""
          )
        );

        commentsRoot.append(
          node
        );
      }
    );

  } catch (error) {
    console.warn(
      "Comments loading error:",
      error
    );

    commentsRoot.append(
      el(
        "p",
        "muted",
        "Comments are temporarily unavailable."
      )
    );
  }
}

// ==========================================
// ARTICLE VISITOR COUNTER
// ==========================================

async function recordArticleView() {
  if (!postId) {
    return;
  }

  try {
    const response = await fetch(
      VISIT_API,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          kind: "post",
          postId
        })
      }
    );

    const result =
      await response.json();

    if (
      !response.ok ||
      result.success !== true
    ) {
      throw new Error(
        result.error ||
        "Article view counter failed."
      );
    }

    // Refresh displayed visitor count.

    const snapshot = await getDoc(
      doc(
        db,
        "posts",
        postId
      )
    );

    if (snapshot.exists()) {
      const views = Number(
        snapshot.data().views || 0
      );

      if (post) {
        post.views = views;
      }

      const counter =
        $("#articleViewCount");

      if (counter) {
        counter.textContent =
          "Views: " +
          views.toLocaleString(
            "en-UG"
          );
      }
    }

  } catch (error) {
    console.warn(
      "Article visitor counter unavailable:",
      error
    );
  }
}

// ==========================================
// SUBMIT COMMENT TO CLOUDFLARE WORKER
// ==========================================

async function submitComment(payload) {
  const response = await fetch(
    COMMENT_API,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify(
        payload
      )
    }
  );

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    throw new Error(
      "Unexpected response from comment service."
    );
  }

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.error ||
      result.message ||
      "Comment submission failed."
    );
  }

  if (
    result.success !== true &&
    result.status !== "pending"
  ) {
    throw new Error(
      "Comment submission was not confirmed."
    );
  }

  return result;
}

// ==========================================
// PUBLIC COMMENT FORM
// ==========================================

if (commentForm) {
  commentForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (
        !post ||
        !postId
      ) {
        return;
      }

      const button =
        commentForm.querySelector(
          'button[type="submit"]'
        );

      const statusNode =
        $("#commentStatus");

      const name =
        $("#commentName")
          ?.value.trim() || "";

      const text =
        $("#commentText")
          ?.value.trim() || "";

      const website =
        $("#websiteField")
          ?.value || "";

      try {
        if (button) {
          button.disabled = true;
        }

        if (statusNode) {
          statusNode.textContent =
            "Submitting your comment…";
        }

        // ==================================
        // VALIDATION
        // ==================================

        if (!name || !text) {
          throw new Error(
            "Name and comment are required."
          );
        }

        if (
          name.length >
          MAX_NAME_LENGTH
        ) {
          throw new Error(
            "Name is too long."
          );
        }

        if (
          text.length >
          MAX_COMMENT_LENGTH
        ) {
          throw new Error(
            "Comment must not exceed 2000 characters."
          );
        }

        if (website.trim()) {
          throw new Error(
            "Submission could not be accepted."
          );
        }

        // ==================================
        // SEND COMMENT
        // ==================================

        await submitComment({
          postId,
          name,
          text,
          website
        });

        if (statusNode) {
          statusNode.textContent =
            "Thank you! Your comment has been received and is awaiting administrator approval.";
        }

        commentForm.reset();

      } catch (error) {
        console.error(
          "Comment submission error:",
          error
        );

        if (statusNode) {
          statusNode.textContent =
            "Comment could not be submitted: " +
            (
              error instanceof TypeError
                ? "Unable to reach the comment service."
                : error.message
            );
        }

      } finally {
        if (button) {
          button.disabled = false;
        }
      }
    }
  );
}

// ==========================================
// LOAD FULL ARTICLE
//
// The zoom intro is controlled by post.html.
// This script continues loading the article
// while the intro is displayed.
//
// No extra redirect is needed.
// ==========================================

async function loadArticle() {
  sharingSection?.classList.add(
    "hidden"
  );

  if (!article) {
    return;
  }

  try {
    if (!postId) {
      throw new Error(
        "Article link is missing."
      );
    }

    // ======================================
    // FETCH ARTICLE FROM FIRESTORE
    // ======================================

    const snapshot = await getDoc(
      doc(
        db,
        "posts",
        postId
      )
    );

    if (!snapshot.exists()) {
      throw new Error(
        "Story not found"
      );
    }

    const data =
      snapshot.data();

    if (
      data.status !== "published"
    ) {
      throw new Error(
        "Story not found"
      );
    }

    if (
      !isRecent(
        data.publishedAt
      )
    ) {
      throw new Error(
        "Story expired"
      );
    }

    post = {
      ...data,
      id: snapshot.id
    };

    article.replaceChildren();

    // ======================================
    // CATEGORY
    // ======================================

    const category =
      typeof post.category === "string"
        ? post.category.trim()
        : "";

    if (
      category &&
      category.toLowerCase() !== "none"
    ) {
      article.append(
        el(
          "div",
          "eyebrow",
          category
        )
      );
    }

    // ======================================
    // ARTICLE HEADLINE
    // ======================================

    article.append(
      el(
        "h1",
        "",
        post.title || "Untitled"
      )
    );

    // ======================================
    // SHORT DESCRIPTION
    // ======================================

    if (post.excerpt) {
      article.append(
        el(
          "p",
          "post-summary",
          post.excerpt
        )
      );
    }

    // ======================================
    // DATE
    // ======================================

    article.append(
      el(
        "div",
        "meta",
        fmtDate(
          post.publishedAt ||
          post.createdAt
        )
      )
    );

    // ======================================
    // ARTICLE PHOTOGRAPHS
    // ======================================

    renderPhotographs(
      post
    );

    // ======================================
    // FULL ARTICLE BODY
    //
    // Preserves exactly the content
    // written in the admin dashboard.
    // ======================================

    const body = el(
      "div",
      "article-body"
    );

    paragraphs(
      body,
      post.body ||
      post.excerpt ||
      ""
    );

    article.append(
      body
    );

    // ======================================
    // SOURCES AND REFERENCES
    // ======================================

    if (
      typeof post.sources === "string" &&
      post.sources.trim()
    ) {
      article.append(
        el(
          "h3",
          "",
          "Sources / References"
        ),

        el(
          "p",
          "muted",
          post.sources
        )
      );
    }

    // ======================================
    // ARTICLE ACTIONS
    // ======================================

    const actions = el(
      "div",
      "actions"
    );

    actions.style.marginTop =
      "24px";

    const quickShare = el(
      "button",
      "btn secondary",
      "Share this story ↗"
    );

    quickShare.type =
      "button";

    quickShare.addEventListener(
      "click",
      () => {
        sharingSection?.scrollIntoView({
          behavior:
            window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches
              ? "auto"
              : "smooth",

          block: "center"
        });
      }
    );

    actions.append(
      quickShare
    );

    // ======================================
    // ARTICLE VIEW COUNT
    // ======================================

    const viewCount = el(
      "span",
      "muted",
      "Views: " +
        Number(post.views || 0)
          .toLocaleString("en-UG")
    );

    viewCount.id =
      "articleViewCount";

    actions.append(
      viewCount
    );

    article.append(
      actions
    );

    // ======================================
    // ENABLE ALL SHARING OPTIONS
    // ======================================

    setupSharing(
      post
    );

    // ======================================
    // LOAD COMMENTS AND RECORD VIEW
    // ======================================

    await Promise.allSettled([
      loadComments(),
      recordArticleView()
    ]);

  } catch (error) {
    console.error(
      "Article loading error:",
      error
    );

    post = null;

    const unavailable = [
      "Story not found",
      "Story expired"
    ].includes(
      error.message
    );

    message(
      article,
      unavailable
        ? "This story is unavailable or is older than the 10-day publication window."
        : "Unable to load this article. Please check the link or connection."
    );

    commentForm?.classList.add(
      "hidden"
    );

    sharingSection?.classList.add(
      "hidden"
    );
  }
}

// ==========================================
// START ARTICLE PAGE
// ==========================================

await loadArticle();
