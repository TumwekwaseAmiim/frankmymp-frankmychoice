
/*
  #FrankMyMP #FrankMyChoice
  Public Article Page

  Firebase Firestore Articles
  Cloudinary Photographs
  Cloudflare Comment Submission
  Cloudflare Visitor Counter
  Social Sharing
  10-Day News Expiration
*/

// ==========================================
// FIRESTORE IMPORTS
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
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// ==========================================
// APPLICATION IMPORTS
// ==========================================

import { db } from './firebase.js';

import {
  $,
  el,
  fmtDate,
  imageOf,
  message,
  paragraphs
} from './ui.js';

// ==========================================
// CONFIGURATION
// ==========================================

const API_BASE =
  'https://frank-news-api.tumwekwaseamiim.workers.dev';

const COMMENT_API =
  API_BASE + '/comments';

const VISIT_API =
  API_BASE + '/record-visit';

const TEN_DAYS_MS =
  10 * 24 * 60 * 60 * 1000;

const MAX_NAME_LENGTH = 80;
const MAX_COMMENT_LENGTH = 2000;

// ==========================================
// INITIALIZATION
// ==========================================

const year = $('#year');

if (year) {
  year.textContent = new Date().getFullYear();
}

const article = $('#article');
const commentsRoot = $('#comments');
const commentForm = $('#commentForm');

const sharingSection =
  document.querySelector('.article-sharing');

let post = null;

// ==========================================
// ARTICLE IDENTIFIER
// ==========================================

const pathParts = location.pathname
  .split('/')
  .filter(Boolean);

let postId =
  pathParts[0] === 'post'
    ? pathParts[1]
    : null;

if (!postId) {
  const params = new URLSearchParams(
    location.search
  );

  postId =
    params.get('slug') ||
    params.get('id');
}

// ==========================================
// 10-DAY NEWS EXPIRATION
// ==========================================

function isRecent(value) {
  if (!value) return false;

  const milliseconds =
    typeof value.toMillis === 'function'
      ? value.toMillis()
      : typeof value.seconds === 'number'
        ? value.seconds * 1000
        : new Date(value).getTime();

  return (
    Number.isFinite(milliseconds) &&
    milliseconds <= Date.now() &&
    Date.now() - milliseconds < TEN_DAYS_MS
  );
}

// ==========================================
// SOCIAL SHARING
// ==========================================

function setupSharing(newsPost) {
  const url = window.location.href;

  const title =
    newsPost.title ||
    '#FrankMyMP #FrankMyChoice';

  const description =
    newsPost.excerpt || '';

  document.title =
    `${title} | #FrankMyMP #FrankMyChoice`;

  // WhatsApp

  const whatsapp = $('#shareWhatsApp');

  if (whatsapp) {
    const shareText = [
      title,
      description,
      url
    ].filter(Boolean).join('\n\n');

    whatsapp.href =
      'https://wa.me/?text=' +
      encodeURIComponent(shareText);
  }

  // Facebook

  const facebook = $('#shareFacebook');

  if (facebook) {
    facebook.href =
      'https://www.facebook.com/sharer/sharer.php?u=' +
      encodeURIComponent(url);
  }

  // X

  const xButton = $('#shareX');

  if (xButton) {
    xButton.href =
      'https://twitter.com/intent/tweet?text=' +
      encodeURIComponent(title) +
      '&url=' +
      encodeURIComponent(url);
  }

  // Copy link

  const copyButton = $('#copyArticleLink');

  if (copyButton) {
    copyButton.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);

        const status = $('#shareStatus');

        if (status) {
          status.textContent =
            'Article link copied successfully.';
        }
      } catch (error) {
        window.prompt(
          'Copy article link:',
          url
        );
      }
    };
  }

  // Description metadata

  const descriptionMeta =
    document.querySelector(
      'meta[name="description"]'
    );

  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      'content',
      description ||
        'Read the latest news and updates.'
    );
  }

  sharingSection?.classList.remove('hidden');
}

// ==========================================
// DISPLAY ARTICLE PHOTOGRAPHS
// ==========================================

function renderPhotographs(newsPost) {
  const pictures =
    Array.isArray(newsPost.images)
      ? newsPost.images
          .filter(item => item?.url)
          .slice(0, 3)
      : [];

  if (!pictures.length) return;

  // Main photograph

  const mainPhoto = el('img', 'photo');

  mainPhoto.src = imageOf({
    images: pictures
  });

  mainPhoto.alt =
    newsPost.title || 'News photograph';

  mainPhoto.loading = 'eager';
  mainPhoto.style.marginTop = '25px';

  article.append(mainPhoto);

  // Additional photographs

  if (pictures.length > 1) {
    const photoGrid = el(
      'div',
      'photo-grid'
    );

    pictures.slice(1).forEach(
      (picture, index) => {
        const image = el('img');

        image.src = picture.url;

        image.alt =
          'Article photograph ' + (index + 2);

        image.loading = 'lazy';

        photoGrid.append(image);
      }
    );

    article.append(photoGrid);
  }
}

// ==========================================
// LOAD FULL ARTICLE
// ==========================================

async function loadArticle() {
  sharingSection?.classList.add('hidden');

  try {
    if (!postId) {
      throw new Error(
        'Article link is missing.'
      );
    }

    const snapshot = await getDoc(
      doc(db, 'posts', postId)
    );

    if (!snapshot.exists()) {
      throw new Error('Story not found');
    }

    const data = snapshot.data();

    if (data.status !== 'published') {
      throw new Error('Story not found');
    }

    if (!isRecent(data.publishedAt)) {
      throw new Error('Story expired');
    }

    post = {
      ...data,
      id: snapshot.id
    };

    article.replaceChildren();

    // Category: Hide None

    const category =
      typeof post.category === 'string'
        ? post.category.trim()
        : '';

    if (
      category &&
      category.toLowerCase() !== 'none'
    ) {
      article.append(
        el('div', 'eyebrow', category)
      );
    }

    // Headline

    article.append(
      el(
        'h1',
        '',
        post.title || 'Untitled'
      )
    );

    // Short caption

    if (post.excerpt) {
      article.append(
        el(
          'p',
          'post-summary',
          post.excerpt
        )
      );
    }

    // Publication date

    article.append(
      el(
        'div',
        'meta',
        fmtDate(
          post.publishedAt ||
          post.createdAt
        )
      )
    );

    // Photographs

    renderPhotographs(post);

    // Full article body

    const body = el(
      'div',
      'article-body'
    );

    paragraphs(
      body,
      post.body || post.excerpt || ''
    );

    article.append(body);

    // Supporting references

    if (
      typeof post.sources === 'string' &&
      post.sources.trim()
    ) {
      article.append(
        el(
          'h3',
          '',
          'Sources / References'
        ),
        el(
          'p',
          'muted',
          post.sources
        )
      );
    }

    // ======================================
    // ARTICLE ACTIONS
    // ======================================

    const actions = el(
      'div',
      'actions'
    );

    actions.style.marginTop = '24px';

    const quickShare = el(
      'button',
      'btn secondary',
      'Share this story ↗'
    );

    quickShare.type = 'button';

    quickShare.addEventListener(
      'click',
      () => {
        sharingSection?.scrollIntoView({
          behavior: window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches
            ? 'auto'
            : 'smooth',

          block: 'center'
        });
      }
    );

    actions.append(quickShare);

    // ======================================
    // ARTICLE VIEWS DISPLAY
    // ======================================

    const viewCount = el(
      'span',
      'muted',
      'Views: ' +
        Number(post.views || 0)
          .toLocaleString('en-UG')
    );

    viewCount.id = 'articleViewCount';

    actions.append(viewCount);

    article.append(actions);

    // Activate sharing

    setupSharing(post);

    // Load comments and register article view
    // independently.

    await Promise.allSettled([
      loadComments(),
      recordArticleView()
    ]);

  } catch (error) {
    console.error(
      'Article loading error:',
      error
    );

    post = null;

    const unavailable = [
      'Story not found',
      'Story expired'
    ].includes(error.message);

    message(
      article,
      unavailable
        ? 'This story is unavailable or is older than the 10-day publication window.'
        : 'Unable to load this article. Please check the link or connection.'
    );

    commentForm?.classList.add('hidden');

    sharingSection?.classList.add('hidden');
  }
}

// ==========================================
// LOAD APPROVED COMMENTS
// ==========================================

async function loadComments() {
  if (!commentsRoot || !postId) return;

  commentsRoot.replaceChildren();

  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'comments'),

        where(
          'postId',
          '==',
          postId
        ),

        where(
          'status',
          '==',
          'approved'
        ),

        orderBy(
          'createdAt',
          'desc'
        ),

        limit(50)
      )
    );

    if (snapshot.empty) {
      commentsRoot.append(
        el(
          'p',
          'muted',
          'No published comments yet.'
        )
      );

      return;
    }

    snapshot.docs.forEach(document => {
      const comment = document.data();

      const node = el(
        'div',
        'comment'
      );

      node.append(
        el(
          'strong',
          '',
          comment.name || 'Reader'
        ),

        el(
          'p',
          '',
          comment.text || ''
        )
      );

      commentsRoot.append(node);
    });

  } catch (error) {
    console.warn(
      'Comments loading error:',
      error
    );

    commentsRoot.append(
      el(
        'p',
        'muted',
        'Comments are temporarily unavailable.'
      )
    );
  }
}

// ==========================================
// CLOUDFLARE ARTICLE VIEW COUNTER
// ==========================================

async function recordArticleView() {
  if (!postId) return;

  try {
    const response = await fetch(
      VISIT_API,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          kind: 'post',
          postId
        })
      }
    );

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        'Invalid response from visitor API.'
      );
    }

    if (
      !response.ok ||
      result.success !== true
    ) {
      throw new Error(
        result.error ||
        'Article view counter failed.'
      );
    }

    // Read updated views from Firestore.

    const snapshot = await getDoc(
      doc(db, 'posts', postId)
    );

    if (snapshot.exists()) {
      const views = Number(
        snapshot.data().views || 0
      );

      post.views = views;

      const counter = $('#articleViewCount');

      if (counter) {
        counter.textContent =
          'Views: ' +
          views.toLocaleString('en-UG');
      }
    }

  } catch (error) {
    console.warn(
      'Article visitor counter unavailable:',
      error
    );
  }
}

// ==========================================
// CLOUDFLARE COMMENT SUBMISSION
// ==========================================

async function submitComment(payload) {
  const response = await fetch(
    COMMENT_API,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify(payload)
    }
  );

  const contentType =
    response.headers.get(
      'content-type'
    ) || '';

  let result = {};

  if (
    contentType.includes(
      'application/json'
    )
  ) {
    result = await response.json();

  } else {
    await response.text();

    if (!response.ok) {
      throw new Error(
        'Comment service unavailable (' +
          response.status +
          ').'
      );
    }

    throw new Error(
      'Unexpected response from comment service.'
    );
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      result.message ||
      'Comment submission failed.'
    );
  }

  if (
    result.success !== true &&
    result.status !== 'pending'
  ) {
    throw new Error(
      'Comment submission was not confirmed.'
    );
  }

  return result;
}

// ==========================================
// PUBLIC COMMENT FORM
// ==========================================

if (commentForm) {
  commentForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (!post || !postId) return;

      const button =
        commentForm.querySelector(
          'button[type="submit"]'
        );

      const statusNode =
        $('#commentStatus');

      const name =
        $('#commentName')?.value.trim() || '';

      const text =
        $('#commentText')?.value.trim() || '';

      const website =
        $('#websiteField')?.value || '';

      try {
        if (button) {
          button.disabled = true;
        }

        if (statusNode) {
          statusNode.textContent =
            'Submitting your comment…';
        }

        // Validate name and comment.

        if (!name || !text) {
          throw new Error(
            'Name and comment are required.'
          );
        }

        if (
          name.length > MAX_NAME_LENGTH
        ) {
          throw new Error(
            'Name is too long.'
          );
        }

        if (
          text.length > MAX_COMMENT_LENGTH
        ) {
          throw new Error(
            'Comment must not exceed 2000 characters.'
          );
        }

        // Honeypot protection.

        if (website.trim()) {
          throw new Error(
            'Submission could not be accepted.'
          );
        }

        // Submit to Cloudflare.

        await submitComment({
          postId,
          name,
          text,
          website
        });

        if (statusNode) {
          statusNode.textContent =
            'Thank you! Your comment has been received and is awaiting administrator approval.';
        }

        commentForm.reset();

      } catch (error) {
        console.error(
          'Comment submission error:',
          error
        );

        if (statusNode) {
          statusNode.textContent =
            'Comment could not be submitted: ' +
            (
              error instanceof TypeError
                ? 'Unable to reach the comment service.'
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
// START ARTICLE PAGE
// ==========================================

await loadArticle();
