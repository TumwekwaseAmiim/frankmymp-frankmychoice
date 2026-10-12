
/*
  #FrankMyMP #FrankMyChoice
  Administration Dashboard

  Firebase Authentication
  Firestore News Management
  Cloudinary Photograph Uploads
  Cloudflare Comment Moderation
*/

// ==========================================
// FIREBASE AUTHENTICATION
// ==========================================

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

// ==========================================
// FIRESTORE
// ==========================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  setDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

// ==========================================
// APPLICATION IMPORTS
// ==========================================

import {
  auth,
  db
} from './firebase.js';

import {
  CLOUDINARY_CLOUD_NAME
} from './config.js';

import {
  $,
  el,
  fmtDate
} from './ui.js';

// ==========================================
// CLOUDFLARE API
// ==========================================

const API_BASE =
  'https://frank-news-api.tumwekwaseamiim.workers.dev';

const UPLOAD_API =
  API_BASE + '/sign-upload';

const MODERATION_API =
  API_BASE + '/comments/moderate';

// ==========================================
// APPLICATION STATE
// ==========================================

let user = null;
let editId = null;
let existingImages = [];

const MAX_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

// ==========================================
// STATUS MESSAGES
// ==========================================

function msg(text) {
  const target = $('#publishMsg');

  if (target) {
    target.textContent = text;
  }
}

// ==========================================
// ADMINISTRATOR LOGIN
// ==========================================

$('#login').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const loginButton = $('#login')
      .querySelector('button[type="submit"]');

    if (loginButton) {
      loginButton.disabled = true;
    }

    try {

      await signInWithEmailAndPassword(
        auth,
        $('#email').value.trim(),
        $('#password').value
      );

      $('#loginMsg').textContent =
        'Signed in successfully.';

    } catch (error) {

      $('#loginMsg').textContent =
        error.message;

    } finally {

      if (loginButton) {
        loginButton.disabled = false;
      }
    }
  }
);

// ==========================================
// LOGOUT
// ==========================================

$('#logout').addEventListener(
  'click',
  async () => {

    try {
      await signOut(auth);
    } catch (error) {
      alert(error.message);
    }
  }
);

// ==========================================
// AUTHENTICATION STATE
// ==========================================

onAuthStateChanged(
  auth,
  async currentUser => {

    user = null;

    $('#dashboard').classList.add(
      'hidden'
    );

    $('#logout').classList.add(
      'hidden'
    );

    $('#loginPanel').classList.remove(
      'hidden'
    );

    if (!currentUser) {
      return;
    }

    try {

      const approval = await getDoc(
        doc(
          db,
          'admins',
          currentUser.uid
        )
      );

      if (
        !approval.exists() ||
        approval.data().active !== true ||
        approval.data().role !== 'admin'
      ) {

        $('#loginMsg').textContent =
          'Your account is not an approved administrator.';

        return;
      }

      user = currentUser;

      $('#dashboard').classList.remove(
        'hidden'
      );

      $('#logout').classList.remove(
        'hidden'
      );

      $('#loginPanel').classList.add(
        'hidden'
      );

      await refresh();

    } catch (error) {

      console.error(
        'Administrator authorization error:',
        error
      );

      $('#loginMsg').textContent =
        error.message;
    }
  }
);

// ==========================================
// RESET NEWS EDITOR
// ==========================================

function reset() {

  editId = null;
  existingImages = [];

  $('#postForm').reset();

  $('#category').value = 'None';

  $('#publish').checked = true;

  $('#featured').checked = false;

  $('#files').value = '';

  $('#photoPreviews').replaceChildren();

  $('#editorHeading').textContent =
    'Create a new post';

  msg('');
}

$('#cancelEdit').addEventListener(
  'click',
  reset
);

// ==========================================
// PHOTO PREVIEWS
// ==========================================

$('#files').addEventListener(
  'change',
  () => {

    const files = [
      ...$('#files').files
    ];

    const preview =
      $('#photoPreviews');

    preview.replaceChildren();

    if (files.length > MAX_PHOTOS) {

      alert(
        'Choose a maximum of three photographs.'
      );

      $('#files').value = '';

      return;
    }

    for (const file of files) {

      if (
        !ALLOWED_TYPES.includes(file.type) ||
        file.size > MAX_FILE_SIZE
      ) {

        alert(
          'Photographs must be JPG, PNG or WebP and no larger than 5 MB each.'
        );

        $('#files').value = '';

        preview.replaceChildren();

        return;
      }

      const image = el('img');

      const objectUrl =
        URL.createObjectURL(file);

      image.src = objectUrl;

      image.alt =
        'Selected photograph preview';

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
      };

      preview.append(image);
    }
  }
);

// ==========================================
// NEWS ARTICLE IDENTIFIER
// ==========================================

function slugify(text) {

  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'story';
}

// ==========================================
// WORKING ARTICLE URL
// ==========================================

function articleUrl(postId) {

  return (
    '/post.html?slug=' +
    encodeURIComponent(postId)
  );
}

// ==========================================
// FIREBASE ID TOKEN
// ==========================================

async function getAdminToken() {

  if (!user) {
    throw new Error(
      'Administrator login required.'
    );
  }

  return user.getIdToken();
}

// ==========================================
// SECURE CLOUDINARY SIGNATURE
// ==========================================

async function getUploadSignature() {

  const firebaseToken =
    await getAdminToken();

  const response = await fetch(
    UPLOAD_API,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${firebaseToken}`,

        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({})
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      'Invalid response from Cloudflare upload API.'
    );
  }

  if (!response.ok) {

    throw new Error(
      result.error ||
      'Photograph upload authorization failed.'
    );
  }

  if (
    !result.signature ||
    !result.timestamp ||
    !result.api_key
  ) {

    throw new Error(
      'Upload authorization is missing required information.'
    );
  }

  return result;
}

// ==========================================
// UPLOAD PHOTOGRAPH TO CLOUDINARY
// ==========================================

async function uploadFile(file) {

  if (
    !ALLOWED_TYPES.includes(file.type) ||
    file.size > MAX_FILE_SIZE
  ) {

    throw new Error(
      'Photographs must be JPG, PNG or WebP and no larger than 5 MB.'
    );
  }

  if (
    !CLOUDINARY_CLOUD_NAME ||
    CLOUDINARY_CLOUD_NAME.startsWith(
      'REPLACE_'
    )
  ) {

    throw new Error(
      'Cloudinary Cloud Name is not configured.'
    );
  }

  // Get signed upload authorization.

  const signed =
    await getUploadSignature();

  if (
    signed.cloud_name &&
    signed.cloud_name !==
      CLOUDINARY_CLOUD_NAME
  ) {

    throw new Error(
      'Cloudinary Cloud Name does not match the API.'
    );
  }

  // Prepare the upload.

  const formData = new FormData();

  formData.append(
    'file',
    file
  );

  for (const key of [
    'api_key',
    'timestamp',
    'signature',
    'folder',
    'public_id'
  ]) {

    if (signed[key] !== undefined) {

      formData.append(
        key,
        String(signed[key])
      );
    }
  }

  // Upload directly to Cloudinary.

  const response = await fetch(
    'https://api.cloudinary.com/v1_1/' +
      encodeURIComponent(
        CLOUDINARY_CLOUD_NAME
      ) +
      '/image/upload',
    {
      method: 'POST',
      body: formData
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      'Invalid response from Cloudinary.'
    );
  }

  if (!response.ok) {

    throw new Error(
      result.error?.message ||
      'Cloudinary photograph upload failed.'
    );
  }

  if (
    !result.secure_url ||
    !result.public_id
  ) {

    throw new Error(
      'Cloudinary did not return the uploaded photograph URL.'
    );
  }

  return {
    url: result.secure_url,
    publicId: result.public_id
  };
}

// ==========================================
// CREATE OR UPDATE A NEWS POST
// ==========================================

$('#postForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    if (!user) {

      msg(
        'Please sign in as an administrator.'
      );

      return;
    }

    const button = $('#saveBtn');

    button.disabled = true;

    try {

      const selectedFiles = [
        ...$('#files').files
      ];

      if (
        selectedFiles.length >
        MAX_PHOTOS
      ) {

        throw new Error(
          'Maximum of three photographs allowed.'
        );
      }

      const title =
        $('#title').value.trim();

      const excerpt =
        $('#excerpt').value.trim();

      const body =
        $('#body').value.trim();

      const category =
        $('#category').value || 'None';

      const type =
        $('#type').value;

      const status =
        $('#publish').checked
          ? 'published'
          : 'draft';

      if (!title || !excerpt) {

        throw new Error(
          'Headline and short caption are required.'
        );
      }

      if (
        type === 'article' &&
        !body
      ) {

        throw new Error(
          'A full article must have article text.'
        );
      }

      let images = [
        ...existingImages
      ];

      // New selections replace the full
      // collection of existing photographs.

      if (selectedFiles.length) {

        images = [];

        for (
          let i = 0;
          i < selectedFiles.length;
          i++
        ) {

          msg(
            `Uploading photograph ${i + 1} of ${selectedFiles.length}…`
          );

          const uploaded =
            await uploadFile(
              selectedFiles[i]
            );

          images.push(uploaded);
        }
      }

      msg(
        'Saving news article to Firebase…'
      );

      const id =
        editId ||
        slugify(title) +
          '-' +
          Date.now().toString(36);

      const payload = {

        title,
        excerpt,
        body,
        images,
        category,
        type,

        sources:
          $('#sources').value.trim(),

        featured:
          $('#featured').checked,

        status,

        updatedAt:
          serverTimestamp(),

        updatedBy:
          user.uid
      };

      if (!editId) {

        payload.createdAt =
          serverTimestamp();

        payload.publishedAt =
          status === 'published'
            ? serverTimestamp()
            : null;

        payload.views = 0;

      } else {

        const old = await getDoc(
          doc(
            db,
            'posts',
            id
          )
        );

        if (!old.exists()) {

          throw new Error(
            'The post being edited no longer exists.'
          );
        }

        if (
          status === 'published' &&
          !old.data().publishedAt
        ) {

          payload.publishedAt =
            serverTimestamp();
        }

        if (
          status === 'draft'
        ) {

          payload.publishedAt = null;
        }
      }

      await setDoc(
        doc(db, 'posts', id),
        payload,
        { merge: true }
      );

      reset();

      await refresh();

      msg(
        status === 'published'
          ? 'Success! Your news article has been published.'
          : 'Draft saved successfully.'
      );

    } catch (error) {

      console.error(
        'Post publishing error:',
        error
      );

      msg(
        'Error: ' + error.message
      );

    } finally {

      button.disabled = false;
    }
  }
);

// ==========================================
// REFRESH DASHBOARD
// ==========================================

async function refresh() {

  await Promise.allSettled([
    refreshPosts(),
    refreshComments()
  ]);
}

// ==========================================
// MANAGE NEWS POSTS
// ==========================================

async function refreshPosts() {

  const root = $('#postList');

  root.replaceChildren();

  try {

    const snapshot = await getDocs(
      query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(100)
      )
    );

    if (snapshot.empty) {

      root.append(
        el(
          'p',
          'muted',
          'No posts yet.'
        )
      );

      return;
    }

    snapshot.docs.forEach(
      document => {

        const data =
          document.data();

        const row = el(
          'div',
          'post-row'
        );

        const summary =
          el('div');

        const categoryText =
          data.category &&
          data.category !== 'None'
            ? ' • ' + data.category
            : '';

        summary.append(
          el(
            'strong',
            '',
            data.title || 'Untitled'
          ),
          el(
            'p',
            'muted',
            (data.status || 'draft') +
              categoryText +
              ' • ' +
              fmtDate(data.createdAt)
          )
        );

        const actions = el(
          'div',
          'row'
        );

        // ==================================
        // EDIT POST
        // ==================================

        const editPost = () => {

          editId = document.id;

          existingImages =
            Array.isArray(data.images)
              ? [...data.images]
              : [];

          $('#title').value =
            data.title || '';

          $('#excerpt').value =
            data.excerpt || '';

          $('#body').value =
            data.body || '';

          const category =
            data.category || 'None';

          const categoryExists = [
            ...$('#category').options
          ].some(
            option =>
              option.value === category
          );

          $('#category').value =
            categoryExists
              ? category
              : 'None';

          $('#type').value =
            data.type || 'photo';

          $('#sources').value =
            data.sources || '';

          $('#featured').checked =
            !!data.featured;

          $('#publish').checked =
            data.status === 'published';

          $('#files').value = '';

          $('#photoPreviews').replaceChildren(
            ...existingImages.map(image => {

              const preview =
                el('img');

              preview.src =
                image.url;

              preview.alt =
                'Existing photograph';

              return preview;
            })
          );

          $('#editorHeading').textContent =
            'Edit Post';

          msg('');

          location.hash = 'editor';
        };

        // ==================================
        // OPEN POST
        // ==================================

        const openPost = () => {

          window.open(
            articleUrl(document.id),
            '_blank',
            'noopener'
          );
        };

        // ==================================
        // DELETE POST
        // ==================================

        const deletePost = async () => {

          const confirmed = confirm(
            'Delete this post? This cannot be undone.'
          );

          if (!confirmed) {
            return;
          }

          try {

            await deleteDoc(
              doc(
                db,
                'posts',
                document.id
              )
            );

            await refresh();

          } catch (error) {

            alert(
              'Unable to delete post: ' +
              error.message
            );
          }
        };

        // ==================================
        // CREATE BUTTONS
        // ==================================

        const availableActions = [
          ['Edit', editPost],
          ['Open', openPost],
          ['Delete', deletePost]
        ];

        for (
          const [label, callback]
          of availableActions
        ) {

          const button = el(
            'button',
            'btn ghost',
            label
          );

          button.type = 'button';

          button.addEventListener(
            'click',
            callback
          );

          actions.append(button);
        }

        row.append(
          summary,
          actions
        );

        root.append(row);
      }
    );

  } catch (error) {

    console.error(
      'Post management error:',
      error
    );

    root.textContent =
      'Unable to load posts: ' +
      error.message;
  }
}

// ==========================================
// CLOUDFLARE COMMENT MODERATION
// ==========================================

async function moderateComment(
  commentId,
  action
) {

  const firebaseToken =
    await getAdminToken();

  const response = await fetch(
    MODERATION_API,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${firebaseToken}`,

        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        commentId,
        action
      })
    }
  );

  let result;

  try {

    result = await response.json();

  } catch {

    throw new Error(
      'Invalid response from comment moderation API.'
    );
  }

  if (
    !response.ok ||
    result.success !== true
  ) {

    throw new Error(
      result.error ||
      'Comment moderation failed.'
    );
  }

  return result;
}

// ==========================================
// LOAD PENDING COMMENTS
// ==========================================

async function refreshComments() {

  const root = $('#pendingList');

  root.replaceChildren();

  try {

    const snapshot = await getDocs(
      query(
        collection(db, 'comments'),

        where(
          'status',
          '==',
          'pending'
        ),

        limit(100)
      )
    );

    if (snapshot.empty) {

      root.append(
        el(
          'p',
          'muted',
          'No comments awaiting review.'
        )
      );

      return;
    }

    snapshot.docs.forEach(
      document => {

        const comment =
          document.data();

        const row = el(
          'div',
          'post-row'
        );

        const content =
          el('div');

        content.append(
          el(
            'strong',
            '',
            (comment.name || 'Visitor') +
              ' on ' +
              (comment.postId || 'Unknown article')
          ),

          el(
            'p',
            '',
            comment.text || ''
          ),

          el(
            'p',
            'muted',
            fmtDate(comment.createdAt)
          )
        );

        const buttons = el(
          'div',
          'row'
        );

        // ==================================
        // APPROVE / REJECT
        // ==================================

        for (
          const [label, action]
          of [
            ['Approve', 'approve'],
            ['Reject', 'reject']
          ]
        ) {

          const button = el(
            'button',
            'btn ghost',
            label
          );

          button.type = 'button';

          button.addEventListener(
            'click',
            async () => {

              const otherButtons =
                buttons.querySelectorAll(
                  'button'
                );

              otherButtons.forEach(
                element => {
                  element.disabled = true;
                }
              );

              try {

                await moderateComment(
                  document.id,
                  action
                );

                await refreshComments();

              } catch (error) {

                console.error(
                  'Comment moderation error:',
                  error
                );

                alert(
                  'Unable to moderate comment: ' +
                  error.message
                );

                otherButtons.forEach(
                  element => {
                    element.disabled = false;
                  }
                );
              }
            }
          );

          buttons.append(button);
        }

        row.append(
          content,
          buttons
        );

        root.append(row);
      }
    );

  } catch (error) {

    console.error(
      'Comment loading error:',
      error
    );

    root.textContent =
      'Unable to load pending comments: ' +
      error.message;
  }
}

// ==========================================
// INITIAL SETTINGS
// ==========================================

$('#category').value = 'None';
