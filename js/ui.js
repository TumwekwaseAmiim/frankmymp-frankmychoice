
/* ==========================================
   #FrankMyMP #FrankMyChoice
   Public Interface Utilities
========================================== */

// ==========================================
// DOM HELPERS
// ==========================================

export const $ = (selector, root = document) =>
  root.querySelector(selector);

export function el(tag, className = '', text = '') {
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
// DATE FORMATTING
// ==========================================

export const fmtDate = value => {
  const date =
    value?.toDate?.() ||
    (value?.seconds
      ? new Date(value.seconds * 1000)
      : value
        ? new Date(value)
        : new Date());

  return date.toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// ==========================================
// NEWS PHOTOGRAPHS
// ==========================================

export function imageOf(post) {
  return (
    Array.isArray(post.images) &&
    post.images[0]?.url
  )
    ? post.images[0].url
    : '/assets/placeholder.svg';
}

// ==========================================
// PUBLIC ARTICLE LINKS
// Works with VS Code Live Server
// ==========================================

export function articleUrl(post) {
  const identifier = post.id || post.slug;

  if (!identifier) {
    return '/';
  }

  return (
    '/post.html?slug=' +
    encodeURIComponent(identifier)
  );
}

// ==========================================
// SHARE FUNCTION
// ==========================================

export async function share(url, title) {

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        url
      });

      return;

    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      console.warn(
        'Native sharing unavailable:',
        error
      );
    }
  }

  try {
    await navigator.clipboard.writeText(url);

    alert('Article link copied successfully.');

  } catch (error) {
    window.prompt(
      'Copy this article link:',
      url
    );
  }
}

// ==========================================
// PUBLIC NEWS CARD
// ==========================================

export function card(post, compact = false) {

  const wrapper = el(
    'article',
    'card' + (compact ? ' compact' : '')
  );

  const url = articleUrl(post);

  // ======================================
  // CLICKABLE ARTICLE CONTENT
  // ======================================

  const link = el('a', 'card-link');

  link.href = url;

  link.setAttribute(
    'aria-label',
    'Read: ' + (post.title || 'News article')
  );

  // Main photograph
  const image = el('img', 'card-cover');

  image.src = imageOf(post);
  image.alt = post.title || 'News photograph';
  image.loading = 'lazy';

  link.append(image);

  // ======================================
  // ARTICLE DETAILS
  // ======================================

  const body = el('div', 'card-body');

  const category =
    typeof post.category === 'string'
      ? post.category.trim()
      : '';

  // Hide None category
  if (
    category &&
    category.toLowerCase() !== 'none'
  ) {
    body.append(
      el('div', 'category', category)
    );
  }

  // Headline
  const headline = el(
    'h3',
    '',
    post.title || 'Untitled'
  );

  body.append(headline);

  // Caption
  if (post.excerpt) {
    body.append(
      el('p', 'summary', post.excerpt)
    );
  }

  // Publication date
  body.append(
    el(
      'div',
      'meta',
      fmtDate(
        post.publishedAt || post.createdAt
      )
    )
  );

  link.append(body);
  wrapper.append(link);

  // ======================================
  // SHARE BUTTON
  // ======================================

  const shareArea = el(
    'div',
    'card-share-area'
  );

  const shareButton = el(
    'button',
    'card-share-btn',
    '↗ Share'
  );

  shareButton.type = 'button';

  shareButton.setAttribute(
    'aria-label',
    'Share ' + (post.title || 'this article')
  );

  shareButton.addEventListener(
    'click',
    async event => {

      event.preventDefault();
      event.stopPropagation();

      const absoluteUrl = new URL(
        url,
        window.location.origin
      ).href;

      await share(
        absoluteUrl,
        post.title || '#FrankMyMP #FrankMyChoice'
      );

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

  const button = $('#menuBtn');
  const nav = $('#nav');

  button?.addEventListener('click', () => {

    const isOpen = nav?.classList.toggle('open');

    button.setAttribute(
      'aria-expanded',
      String(!!isOpen)
    );

  });

  // NRM emblem
  const logo = $('#nrmLogo');

  if (logo) {

    logo.onload = () => {
      logo.classList.remove('hidden');
    };

    logo.onerror = () => {
      logo.classList.add('hidden');
    };

    if (
      logo.complete &&
      logo.naturalWidth > 0
    ) {
      logo.classList.remove('hidden');
    }
  }
}

// ==========================================
// EMPTY STATES
// ==========================================

export function message(node, text) {

  if (!node) return;

  node.replaceChildren(
    el('div', 'empty', text)
  );
}

// ==========================================
// ARTICLE PARAGRAPHS
// ==========================================

export function paragraphs(container, text) {

  const parts = (text || '').split(/\n\s*\n/);

  parts.forEach(part => {

    if (part.trim()) {
      container.append(
        el('p', '', part.trim())
      );
    }

  });
}
