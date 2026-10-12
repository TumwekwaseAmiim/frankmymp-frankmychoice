
/*
  #FrankMyMP #FrankMyChoice
  Public Homepage

  Firebase Firestore News
  Cloudflare Visitor Counter
  Featured Stories
  Animated News Headlines
  10-Day News Expiration
*/

// ==========================================
// FIRESTORE IMPORTS
// ==========================================

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// ==========================================
// APPLICATION IMPORTS
// ==========================================

import { db } from './firebase.js';

import {
  $,
  card,
  menu,
  message,
  articleUrl
} from './ui.js';

// ==========================================
// CLOUDFLARE API
// ==========================================

const API_BASE =
  'https://frank-news-api.tumwekwaseamiim.workers.dev';

const VISIT_API =
  API_BASE + '/record-visit';

// ==========================================
// INITIALIZATION
// ==========================================

menu();

const yearElement = $('#year');

if (yearElement) {
  yearElement.textContent =
    new Date().getFullYear();
}

let all = [];
let displayed = 9;

const TEN_DAYS_MS =
  10 * 24 * 60 * 60 * 1000;

// ==========================================
// NEWS EXPIRATION: 10 DAYS
// ==========================================

function isRecent(post) {

  const value = post.publishedAt;

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
// CATEGORY FILTER
// ==========================================

const filter = $('#categoryFilter');

const given = new URLSearchParams(
  location.search
).get('category') || '';

if (
  filter &&
  [...filter.options].some(
    option => option.value === given
  )
) {
  filter.value = given;
}

// ==========================================
// ANIMATED NEWS HEADLINE TICKER
// ==========================================

function ticker(posts) {

  const root = $('#newsTicker');

  if (!root) return;

  root.replaceChildren();

  const recent = posts.slice(0, 6);

  if (!recent.length) {

    root.textContent =
      'New updates will appear here when published.';

    return;
  }

  const inner =
    document.createElement('div');

  inner.className = 'ticker-items';

  // Repeat headlines for continuous motion.

  for (
    let repeat = 0;
    repeat < 2;
    repeat++
  ) {

    recent.forEach(post => {

      const link =
        document.createElement('a');

      link.href = articleUrl(post);

      link.textContent =
        post.title || 'News update';

      inner.append(link);
    });
  }

  root.append(inner);
}

// ==========================================
// NEWS CARD ANIMATIONS
// ==========================================

function animateCards() {

  const cards =
    document.querySelectorAll(
      '.card:not([data-animated])'
    );

  const reducedMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

  cards.forEach(cardElement => {

    cardElement.dataset.animated = 'true';

    if (!reducedMotion) {

      cardElement.classList.add(
        'news-reveal'
      );
    }
  });

  if (
    reducedMotion ||
    !('IntersectionObserver' in window)
  ) {

    cards.forEach(cardElement => {

      cardElement.classList.add(
        'in-view'
      );
    });

    return;
  }

  const observer =
    new IntersectionObserver(
      entries => {

        entries.forEach(entry => {

          if (entry.isIntersecting) {

            entry.target.classList.add(
              'in-view'
            );

            observer.unobserve(
              entry.target
            );
          }
        });
      },
      {
        threshold: 0.08
      }
    );

  cards.forEach(cardElement => {

    observer.observe(
      cardElement
    );
  });
}

// ==========================================
// RENDER PUBLIC NEWS
// ==========================================

function render() {

  const category =
    filter?.value || '';

  // Exclude stories outside the
  // selected category.

  const posts = all.filter(post =>
    !category ||
    post.category === category
  );

  const latestHeading =
    $('#latestHeading');

  if (latestHeading) {

    latestHeading.textContent =
      category || 'Latest Updates';
  }

  // ======================================
  // FEATURED STORIES
  // ======================================

  const featured = posts
    .filter(post => post.featured)
    .slice(0, 3);

  // If no featured posts exist,
  // display the three newest stories.

  if (!featured.length) {

    featured.push(
      ...posts.slice(0, 3)
    );
  }

  const featuredRoot =
    $('#featured');

  if (featuredRoot) {

    featuredRoot.replaceChildren();

    if (featured.length) {

      featuredRoot.append(
        card(featured[0])
      );

      featuredRoot.firstElementChild
        .classList.add('featured');

      const stack =
        document.createElement('div');

      stack.className =
        'small-stack';

      featured.slice(1, 3)
        .forEach(post => {

          stack.append(
            card(post, true)
          );
        });

      featuredRoot.append(stack);

    } else {

      message(
        featuredRoot,
        'No current stories. New updates will appear here when published.'
      );
    }
  }

  // ======================================
  // LATEST NEWS
  // ======================================

  const newsRoot =
    $('#news');

  const remaining = posts.filter(
    post => !featured.some(
      featuredPost =>
        featuredPost.id === post.id
    )
  );

  if (newsRoot) {

    newsRoot.replaceChildren();

    remaining
      .slice(0, displayed)
      .forEach(post => {

        newsRoot.append(
          card(post)
        );
      });

    if (!remaining.length) {

      message(
        newsRoot,
        posts.length
          ? 'More stories will appear here as they are published.'
          : 'No current news updates are available.'
      );
    }
  }

  // ======================================
  // LOAD MORE BUTTON
  // ======================================

  const loadMoreButton =
    $('#loadMore');

  if (loadMoreButton) {

    loadMoreButton.classList.toggle(
      'hidden',
      remaining.length <= displayed
    );
  }

  // ======================================
  // TICKER AND ANIMATIONS
  // ======================================

  ticker(posts);

  animateCards();
}

// ==========================================
// CATEGORY FILTER CHANGES
// ==========================================

if (filter) {

  filter.addEventListener(
    'change',
    () => {

      displayed = 9;

      const url =
        new URL(location.href);

      if (filter.value) {

        url.searchParams.set(
          'category',
          filter.value
        );

      } else {

        url.searchParams.delete(
          'category'
        );
      }

      history.replaceState(
        {},
        '',
        url
      );

      render();
    }
  );
}

// ==========================================
// LOAD MORE
// ==========================================

const loadMoreButton =
  $('#loadMore');

if (loadMoreButton) {

  loadMoreButton.addEventListener(
    'click',
    () => {

      displayed += 9;

      render();
    }
  );
}

// ==========================================
// FETCH PUBLISHED NEWS
// ==========================================

async function loadNews() {

  try {

    const now = new Date();

    // Request stories published within
    // the last 10 days.

    const cutoff = Timestamp.fromMillis(
      now.getTime() - TEN_DAYS_MS
    );

    const snapshot = await getDocs(
      query(
        collection(db, 'posts'),

        where(
          'status',
          '==',
          'published'
        ),

        where(
          'publishedAt',
          '>',
          cutoff
        ),

        where(
          'publishedAt',
          '<=',
          Timestamp.fromDate(now)
        ),

        orderBy(
          'publishedAt',
          'desc'
        ),

        limit(150)
      )
    );

    all = snapshot.docs
      .map(document => ({
        ...document.data(),
        id: document.id
      }))
      .filter(isRecent);

    render();

  } catch (error) {

    console.error(
      'News loading error:',
      error
    );

    message(
      $('#featured'),
      'News is temporarily unavailable.'
    );

    message(
      $('#news'),
      'Check Firestore permissions and database indexes.'
    );
  }
}

// ==========================================
// WEBSITE VISITOR COUNTER
// ==========================================

async function loadVisitorCount() {

  const counter =
    $('#visitors');

  if (!counter) return;

  counter.textContent = '—';

  try {

    // Register a site visit with Cloudflare.
    // The Worker handles deduplication.

    const response = await fetch(
      VISIT_API,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          kind: 'site'
        })
      }
    );

    let result;

    try {

      result = await response.json();

    } catch {

      throw new Error(
        'Invalid visitor API response.'
      );
    }

    if (
      !response.ok ||
      result.success !== true
    ) {

      throw new Error(
        result.error ||
        'Visitor counter request failed.'
      );
    }

    // Read the current counter from
    // Firestore after the Worker responds.

    const snapshot = await getDoc(
      doc(
        db,
        'publicStats',
        'global'
      )
    );

    const visits =
      snapshot.exists()
        ? Number(
            snapshot.data().visits || 0
          )
        : 0;

    counter.textContent =
      visits.toLocaleString('en-UG');

  } catch (error) {

    console.warn(
      'Visitor statistics unavailable:',
      error
    );

    counter.textContent = '—';
  }
}

// ==========================================
// START HOMEPAGE
// ==========================================

// Load articles and visitor statistics
// independently, so failure of the counter
// will never stop the news from appearing.

await Promise.allSettled([
  loadNews(),
  loadVisitorCount()
]);
