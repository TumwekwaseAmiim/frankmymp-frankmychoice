## Final homepage revision

Navigation is now **Home · Latest News · Views · Admin**. The approximate visits count is in the navigation (it remains `—` until the Firebase backend is configured). The large welcome headline has been removed. Recent headlines animate in a news ticker; photo cards reveal gently as the reader scrolls and zoom slightly on hover. Motion automatically reduces for visitors who request reduced motion. No fabricated stories or traffic numbers are supplied. Published posts remain displayed only for ten days; expired posts remain in the database for administrators. The site is responsive for phones but does not include installable PWA support yet.

# #FrankMyMP #FrankMyChoice — Full News Website

A photo-first news website and protected news publishing dashboard: photo/caption posts, articles, statements/clarifications, up to three images, featured posts, reader counters, and moderated comments. Yellow and white background; trademark: **#Frank** (red) **MyMP** (black); **#Frank** (black) **MyChoice** (red).

## Requirements and costs

- GitHub account, public repository, GitHub Pages enabled using **GitHub Actions** source.
- Firebase project with Authentication (Email/Password), Firestore and **Cloud Functions (Blaze pay-as-you-go billing required)**. Firebase quotas can cover small amounts of traffic, but billing must be enabled to deploy functions and charges are possible.
- Cloudinary account. Image upload uses signed Cloudinary uploads. Protect API secret in Firebase Secrets, **never in site code**.
- Recommended: registered custom domain for clean links and WhatsApp preview URLs. Domain renewal and usage-based cloud charges may apply.
- Optional: official NRM logo image supplied/authorized by the site operator; not included in the package. Use branding only with appropriate permission. This project should not imply an official government or NRM website without authorization.

## Step 1 — Firebase

1. Create a Firebase project. Enable **Authentication → Sign-in method → Email/Password**. Create the first administrator account in Authentication and copy its UID.
2. Create Firestore database (choose region carefully). Create document `admins/{ADMIN_UID}` with field `active` (Boolean) set to `true`. **Do this in Firebase Console**, never offer public creation of admins.
3. Update `js/config.js` with Firebase web application config (Firebase Console → Project settings → Your apps). These Firebase Web config values are publicly visible by design; security is enforced by Firestore rules and backend authorization.
4. Set `FUNCTIONS_REGION` to `us-central1` unless you change `region` in `functions/index.js` too.
5. Install Firebase CLI on your PC: `npm install -g firebase-tools`; `firebase login`; in the project folder run `firebase use --add` to select your project.
6. Deploy Firestore rules/indexes: `firebase deploy --only firestore`.
7. Store Cloudinary credentials as Firebase secrets (CLI prompts for each):

   ```sh
   firebase functions:secrets:set CLOUDINARY_CLOUD_NAME
   firebase functions:secrets:set CLOUDINARY_API_KEY
   firebase functions:secrets:set CLOUDINARY_API_SECRET
   ```

8. Run `cd functions && npm install && cd ..` then `firebase deploy --only functions`. Cloud Functions requires the appropriate Firebase billing plan. If deployment is denied, enable billing and check your permissions.
9. Edit `CLOUDINARY_CLOUD_NAME` in `js/config.js` to the exact Cloudinary cloud name. **Do not place your Cloudinary API secret or Firebase service account key in this file.**
10. In Firebase Console → Authentication → Settings → Authorized domains, add your GitHub Pages host and then your custom domain.

## Step 2 — GitHub Pages and article previews

1. Set `SITE_URL` in `js/config.js` to the same final HTTPS domain that visitors use, without a trailing slash.
2. Create a GitHub repository (suggested `frank-my-mp-news`) and push all the project files, including `.github/workflows/pages.yml`, on the `main` branch. Do not upload secret credentials.
3. GitHub Repository → Settings → Pages → Source: **GitHub Actions**.
4. In GitHub Repository → Settings → Secrets and variables → Actions:
   - Variable `SITE_URL`: e.g. `https://news.yourdomain.ug`.
   - Variable `SITE_DOMAIN`: e.g. `news.yourdomain.ug` (only if using your own domain). Omit when not using a custom domain.
   - Secret `FIREBASE_SERVICE_ACCOUNT_JSON`: paste the service account JSON used only by the trusted GitHub Actions build to read published posts. Create a narrowly scoped service account with Firestore read permissions instead of using a project-owner service account. Restrict repository admin rights and rotate compromised credentials.
5. Set up DNS on your domain provider and configure custom domain in GitHub Pages settings. Use GitHub's published DNS and HTTPS guidance. GitHub Pages without a custom domain exposes `username.github.io`, which cannot be hidden merely by CSS.
6. Trigger **Actions → Publish news website → Run workflow**. GitHub Actions automatically rebuilds every 15 minutes to add static article metadata (WhatsApp, Facebook, X preview). GitHub schedule may run late; for urgent posts manually trigger it. Newly published articles are visible on the homepage immediately through Firebase, but the article detail permalink does not exist until its next static build; you can trigger the workflow right away for sharing.

**Important:** WhatsApp preview images must be publicly reachable HTTPS URLs. The image preview shown by WhatsApp is cached and may not update instantly after edits. Other social platforms can also cache pages.

### Without a domain

GitHub Pages for a project repository uses a subpath (e.g. `/repository-name/`), but this version uses root-relative links (`/post/...`, `/css/...`) and is built for a **custom domain served from the root**. If you don't yet have a custom domain, the easiest temporary approach is to publish this as a user/org Pages repository named `USERNAME.github.io`; later connect your custom domain. You can also adjust all root-relative links and asset URLs for a project subpath, but that is not done automatically.

## Step 3 — Publish

Visit `/admin/`, sign in with your approved admin account, enter a headline and short caption, optionally write the full story, select images (up to three), choose a category, check **Publish now**, and click Save. You can edit or delete stories and approve comments. For share previews: trigger the GitHub workflow, wait for the deployment, and then share the final article URL.

## Reader statistics

- `visits`: approximate once-per-IP-per-day site visits, not unique people and not every page impression.
- `dailyStats`: day keys use UTC; 'today' may not exactly match Kampala calendar days around midnight.
- `views`: approximate once-per-IP-per-day article visits; can be affected by proxies and VPNs.
- `approvedComments`: count of comments approved/rejected via dashboard.
- Metrics use rate-limit documents in Firestore; enable **TTL** on the `expiresAt` field for collection `rateLimits` in Firestore to reduce storage growth.
- This starter provides small-project analytics, not fraud-proof or enterprise traffic analysis. For higher traffic, use Google Analytics and scalable aggregation.

## Moderation & abuse prevention

Comments are **not published** until approved by an admin. The backend rate limits comment submissions. For a public launch, strongly recommend enabling Firebase App Check with reCAPTCHA Enterprise and implementing App Check enforcement on callable functions to reduce automated abuse; consider a privacy policy and community commenting rules. Rate limiting is basic and IP based, not an absolute protection from spam. Backend callable endpoints must remain safe even if visited outside your UI.

## Known considerations

- Published stories are displayed dynamically from Firestore. Static article HTML carries share metadata but article bodies load from Firebase in a browser.
- If Firebase is not configured or functions aren't deployed yet, the app won't publish or show live content. It is not a functioning hosted website until connected.
- Stories have 0–3 images. Placeholder artwork is used when none is provided.
- The NRM logo itself is **not included**; copy an appropriately licensed/authorized PNG to `assets/nrm-logo.png` if desired. If absent, the header hides it automatically.
- Deleting a post does **not** delete Cloudinary photos or previously approved comments automatically; add media cleanup/retention controls for production.
- For political material, clearly attribute quotations and distinguish independently verified reporting, opinion and promotional messaging. The website is not presented as an official public institution by default.
- No secrets should be committed to GitHub.

## Local preview

Run `python -m http.server 8000` from the repository root and open `http://localhost:8000`. This previews the frontend, but live news and dashboard actions require configured Firebase.

## Project map

- `index.html`: public photo-first homepage.
- `post.html`: base article page; GitHub Action generates `/post/<slug>/index.html` from it.
- `admin/index.html`: admin login, post creation/editing, approvals.
- `css/style.css`: responsive trademark design.
- `js/config.js`: public configuration.
- `js/home.js`, `js/post.js`, `js/admin.js`: application logic.
- `functions/index.js`: protected image signatures, moderated comments and count tracking.
- `firestore.rules`, `firestore.indexes.json`: database security and indexes.
- `tools/build.mjs`: static article metadata generator.
- `.github/workflows/pages.yml`: scheduled GitHub Pages deployment.

## Latest-only news policy

The homepage displays only stories published within the last 10 days. After 10 days, a post is hidden from the homepage and its normal article page, but retained in Firestore for the administrator. The static-build script also excludes expired posts from generated article previews at the next deployment. Old CDN/social preview caches may persist temporarily, and direct Firestore API access to published data remains possible under the starter rules; for strict server-enforced expiry use a dedicated `expiresAt` field and adjust security rules and queries together.
