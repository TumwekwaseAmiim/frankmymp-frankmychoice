# #FrankMyMP #FrankMyChoice — final deployment guide

## Included

- News homepage with featured stories, ticker, categories, responsive no-crop photographs
- News article pages, clean URLs `/post/ARTICLE_ID/`, automatic Open Graph photo/headline/description at build time
- Firebase Auth + Firestore admin/publishing integration and published-post expiration after 10 days
- Cloudinary photos using existing external Cloudflare Worker upload-signing API
- Reader comments with administrator approval, and site/article visitor counts through existing API
- PWA manifest, correct PNG icon locations, install button, root service worker and offline fallback
- Optional scheduled preview refresh roughly every 2 hours via a *secret* Cloudflare Pages deploy hook

## Before deploying

1. Deploy the **existing Cloudflare Worker** at `frank-news-api.tumwekwaseamiim.workers.dev` with CORS access for `https://frankmymp-frankmychoice.pages.dev`. The Worker source is not part of this ZIP, so it must remain separately deployed. Preserve the Worker's existing Firebase and Cloudinary secrets/KV.
2. In Cloudflare Pages (project `frankmymp-frankmychoice`), set **Production** build secret `FIREBASE_SERVICE_ACCOUNT_JSON` to the JSON contents of the service account (never commit or share it). Also set `SITE_URL=https://frankmymp-frankmychoice.pages.dev`, `NODE_VERSION=22`. Build command: `npm run build`; output directory: `dist`; root: empty.
3. Confirm Firebase rules and indexes are configured, and Cloudinary images are publicly reachable. Firebase web config is in `js/config.js` (public values, not private keys).
4. Upload these source files to the existing GitHub repo and push to `main`. No `.git` folder is in this handoff ZIP.
5. Confirm Cloudflare Pages deployment **Success**. Visit the homepage, and inspect a generated article using **View Page Source**, searching for `og:image`. This is what WhatsApp reads—not JavaScript or CSS.
6. To make previews update after administrators publish (not just after Git commits): create a **Cloudflare Pages Deploy Hook** for `main`. Do NOT expose its URL on the site. In GitHub repo **Settings → Secrets and variables → Actions → New repository secret**, create `CLOUDFLARE_PAGES_DEPLOY_HOOK` and paste the hook URL. The `refresh-previews.yml` workflow asks GitHub to trigger a rebuild every 2 hours (GitHub scheduled runs can be delayed, not instant). You can run it manually in GitHub Actions to refresh immediately.

## Important limits

- WhatsApp controls the card's layout, visible URL, and cached previews. The site can provide correct metadata/photo but cannot force a specific chat rendering. Existing links may be cached.
- The native Chrome install dialog is browser-controlled; the app cannot install without a browser-supported prompt and user confirmation. `beforeinstallprompt` is not always offered.
- The Cloudflare Pages build uses Firestore at deployment time. With no Firebase build secret it deliberately fails rather than silently publish missing article previews. For a local static diagnostic build only, use `BUILD_WITHOUT_FIREBASE=1 npm run build` (does not produce news preview pages).
- Only approved comments appear publicly; comments are still submitted to the separately deployed Worker API.
- Cost and rate limits of Cloudflare, Firebase and Cloudinary apply. A deployment every 2 hours is ~12 builds/day and may exceed plan limits. Adjust the cron frequency if needed.
- The previously published example news posts may not be included in this ZIP: they are stored in Firestore and are fetched during deployment.

## Local checks

`npm install` then `npm run check`.

Static smoke test without Firestore (diagnostics only): `BUILD_WITHOUT_FIREBASE=1 npm run build`.

## Git publish (from extracted folder)

`git add -A && git commit -m "Finalize news previews and PWA" && git push origin main`

If you extracted this clean ZIP without an existing `.git` repository, copy its contents **into your existing local project folder** first, then run the command there.
