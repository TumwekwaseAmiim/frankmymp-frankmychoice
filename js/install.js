
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PWA Installation Controller

   Features:
   - Show Install App on normal website
   - Chrome / Edge installation prompt
   - Android manual installation instructions
   - iPhone / iPad installation instructions
   - Hide inside installed application
   - Hide after successful installation
   - Service worker registration
===================================================== */

(() => {
  "use strict";

  // ==========================================
  // ELEMENTS
  // ==========================================

  const installButton =
    document.getElementById("installAppBtn");

  const notice =
    document.getElementById("installNotice");

  const noticeText =
    document.getElementById("installNoticeText");

  const closeNotice =
    document.getElementById("closeInstallNotice");

  if (!installButton) return;

  // ==========================================
  // STATE
  // ==========================================

  let deferredPrompt = null;
  let installedThisSession = false;

  // ==========================================
  // DEVICE DETECTION
  // ==========================================

  const isIOS =
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    );

  const isAndroid =
    /android/i.test(navigator.userAgent);

  // ==========================================
  // DETECT INSTALLED APP MODE
  // ==========================================

  function isStandalone() {
    return (
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||
      window.matchMedia(
        "(display-mode: fullscreen)"
      ).matches ||
      navigator.standalone === true
    );
  }

  // ==========================================
  // SHOW / HIDE INSTALL BUTTON
  // ==========================================

  function hideInstallButton() {
    installButton.classList.add("hidden");
    installButton.hidden = true;
  }

  function showInstallButton() {
    installButton.hidden = false;
    installButton.classList.remove("hidden");
  }

  function updateInstallButton() {

    if (
      isStandalone() ||
      installedThisSession
    ) {
      hideInstallButton();
      return;
    }

    // Show to visitors opening the website
    // normally, even without an install prompt.
    showInstallButton();
  }

  // ==========================================
  // INSTALLATION NOTICE
  // ==========================================

  function showNotice(text) {

    if (!notice || !noticeText) {
      return;
    }

    noticeText.textContent = text;
    notice.hidden = false;
  }

  function hideNotice() {

    if (notice) {
      notice.hidden = true;
    }
  }

  // ==========================================
  // INSTALLATION AVAILABILITY
  // ==========================================

  window.addEventListener(
    "beforeinstallprompt",
    event => {

      // Save browser installation event.
      event.preventDefault();

      deferredPrompt = event;

      updateInstallButton();
    }
  );

  // ==========================================
  // INSTALLATION SUCCESS
  // ==========================================

  window.addEventListener(
    "appinstalled",
    () => {

      installedThisSession = true;
      deferredPrompt = null;

      hideInstallButton();
      hideNotice();

      console.log(
        "FrankMyMP application installed."
      );
    }
  );

  // ==========================================
  // APP DISPLAY MODE CHANGES
  // ==========================================

  const displayMode = window.matchMedia(
    "(display-mode: standalone)"
  );

  if (displayMode.addEventListener) {

    displayMode.addEventListener(
      "change",
      updateInstallButton
    );

  } else if (displayMode.addListener) {

    displayMode.addListener(
      updateInstallButton
    );

  }

  // ==========================================
  // INSTALL BUTTON CLICK
  // ==========================================

  installButton.addEventListener(
    "click",
    async () => {

      if (isStandalone()) {
        hideInstallButton();
        return;
      }

      // ======================================
      // CHROME / EDGE INSTALLATION PROMPT
      // ======================================

      if (deferredPrompt) {

        const promptEvent = deferredPrompt;

        deferredPrompt = null;

        try {

          await promptEvent.prompt();

          const choice =
            await promptEvent.userChoice;

          if (
            choice?.outcome === "accepted"
          ) {

            // Wait for appinstalled confirmation.
            // Avoid immediately claiming the
            // installation was completed.

            hideInstallButton();

          } else {

            updateInstallButton();

          }

        } catch (error) {

          console.warn(
            "Installation prompt unavailable:",
            error
          );

          showNotice(
            "Open your browser menu and choose Install app or Add to Home Screen, if available."
          );

          updateInstallButton();
        }

        return;
      }

      // ======================================
      // IPHONE / IPAD
      // ======================================

      if (isIOS) {

        showNotice(
          "On iPhone or iPad, open this website in Safari, tap the Share button, choose Add to Home Screen, then tap Add."
        );

        return;
      }

      // ======================================
      // ANDROID
      // ======================================

      if (isAndroid) {

        showNotice(
          "On Android, open this website in Chrome, tap the three-dot menu (⋮), then choose Install app or Add to Home Screen."
        );

        return;
      }

      // ======================================
      // WINDOWS / MAC / OTHER BROWSERS
      // ======================================

      showNotice(
        "To install this website, look for Install app in your browser's address bar or menu. If it is unavailable, use a supported browser such as Chrome or Edge."
      );

    }
  );

  // ==========================================
  // CLOSE INSTALL NOTICE
  // ==========================================

  closeNotice?.addEventListener(
    "click",
    hideNotice
  );

  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {
        hideNotice();
      }

    }
  );

  // ==========================================
  // INITIALIZE BUTTON
  // ==========================================

  updateInstallButton();

  // ==========================================
  // SERVICE WORKER REGISTRATION
  // ==========================================

  if (
    "serviceWorker" in navigator &&
    window.isSecureContext
  ) {

    window.addEventListener(
      "load",
      async () => {

        try {

          const registration =
            await navigator.serviceWorker.register(
              "/sw.js",
              { scope: "/" }
            );

          console.log(
            "Frank News service worker registered:",
            registration.scope
          );

        } catch (error) {

          console.warn(
            "Service worker registration failed:",
            error.message
          );

        }

      }
    );

  }

})();
