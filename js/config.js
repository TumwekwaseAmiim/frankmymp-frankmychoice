
/* =====================================================
   #FrankMyMP #FrankMyChoice
   Firebase, Cloudinary & Website Configuration
===================================================== */

// ==========================================
// FIREBASE WEB APP CONFIGURATION
// ==========================================

export const firebaseConfig = {
  apiKey: "AIzaSyBdJduEm8HG2-xZsqj0rqrSOMubhICp_ME",
  authDomain: "frankmymp-frankmychoice.firebaseapp.com",
  projectId: "frankmymp-frankmychoice",
  storageBucket: "frankmymp-frankmychoice.firebasestorage.app",
  messagingSenderId: "1028015448722",
  appId: "1:1028015448722:web:25f9a2887b1d4e4d4a7c4b"
};

// ==========================================
// FIREBASE CLOUD FUNCTIONS
// ==========================================

// Reserved for Firebase Functions if enabled.
export const FUNCTIONS_REGION = "us-central1";

// ==========================================
// CLOUDINARY PHOTO STORAGE
// ==========================================

// Your actual Cloudinary Cloud Name
export const CLOUDINARY_CLOUD_NAME = "qlxhf4mv";

// ==========================================
// CLOUDFLARE WORKERS WEBSITE
// ==========================================

// Planned public website address.
// Must be deployed before public sharing works.
export const SITE_URL =
  "https://frankmymp-frankmychoice.tumwekwaseamiim.workers.dev";

// ==========================================
// WEBSITE IDENTITY
// ==========================================

export const SITE_TITLE =
  "#FrankMyMP #FrankMyChoice";
