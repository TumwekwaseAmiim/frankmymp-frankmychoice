
/* =====================================================
   #FrankMyMP #FrankMyChoice
   PWA INSTALLATION CONTROLLER

   Features:
   - Visible Install App button on website
   - Native Chrome / Edge installation prompt
   - Short fallback messages
   - Android and iOS support
   - Detect installed application
   - Hide button inside installed app
   - Service worker registration
===================================================== */

(() => {
  "use strict";

  // ==========================================
  // PAGE ELEMENTS
  // ==========================================

  const installButton =
    document.getElementById("installAppBtn");

  const notice =
    document.getElementById("installNotice");

  const noticeText =
    document.getElementById("installNoticeText");

  const closeNotice =
    document.getElementById("closeInstallNotice");

  if (!installButton) {
    console.warn(
      "Install App button was not found."
    );
    return;
  }

  // ==========================================
  // INSTALLATION STATE
  // ==========================================

  let deferredPrompt = null;
  let installedThisSession = false;
  let promptInProgress = false;

  // ==========================================
  // DEVICE AND BROWSER DETECTION
  // ==========================================

  const userAgent = navigator.userAgent || "";

  const isIOS =
    /iphone|ipad|ipod/i.test(userAgent) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    );

  const isAndroid =
    /android/i.test(userAgent);

  const isChrome =
    (
      /Chrome|CriOS/i.test(userAgent)
    ) &&
    !/Edg|EdgiOS|OPR|Opera|SamsungBrowser/i.test(
      userAgent
    );

  const isEdge =
    /Edg|EdgiOS/i.test(userAgent);

  // ==========================================
  // DETECT INSTALLED APPLICATION
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
  // INSTALL BUTTON VISIBILITY
  // ==========================================

  function hideInstallButton() {
    installButton.hidden = true;
    installButton.classList.add("hidden");
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

    showInstallButton();
  }

  // ==========================================
  // INSTALLATION NOTICE
  // ==========================================

  function showNotice(text) {
    if (!notice || !noticeText) {
      // Fallback when the notice panel
      // is missing from HTML.
      console.info(text);
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
  // NATIVE INSTALLATION AVAILABILITY
  // ==========================================

  window.addEventListener(
    "beforeinstallprompt",
    event => {
      // Store the browser-provided event so
      // we can show the native prompt on click.

      event.preventDefault();

      deferredPrompt = event;

      hideNotice();
      updateInstallButton();

      console.log(
        "Native installation prompt available."
      );
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
      promptInProgress = false;

      hideNotice();
      hideInstallButton();

      console.log(
        "#FrankMyMP #FrankMyChoice installed."
      );
    }
  );

  // ==========================================
  // DETECT DISPLAY MODE CHANGES
  // ==========================================

  const standaloneMedia = window.matchMedia(
    "(display-mode: standalone)"
  );

  if (standaloneMedia.addEventListener) {
    standaloneMedia.addEventListener(
      "change",
      updateInstallButton
    );
  } else if (standaloneMedia.addListener) {
    standaloneMedia.addListener(
      updateInstallButton
    );
  }

  // ==========================================
  // INSTALLATION FALLBACK MESSAGE
  // ==========================================

  function showInstallationUnavailable() {
    // iPhone/iPad installation typically uses
    // Safari's Add to Home Screen feature.

    if (isIOS) {
      showNotice(
        "To install this app on iPhone or iPad, open the website in Safari and choose Share → Add to Home Screen."
      );

      return;
    }

    // Chrome on Android or desktop.

    if (isChrome) {
      showNotice(
        "Installation is not available right now. Check that Chrome is updated and allows app installation, then try again."
      );

      return;
    }

    // Microsoft Edge.

    if (isEdge) {
      showNotice(
        "Installation is not available right now. Check your browser settings or try again using the latest version of Edge."
      );

      return;
    }

    // Other Android browsers.

    if (isAndroid) {
      showNotice(
        "Your browser has not offered app installation. Try opening this website in the latest version of Chrome."
      );

      return;
    }

    // Other desktop browsers.

    showNotice(
      "App installation is unavailable in this browser. Try Chrome or Microsoft Edge, or check whether your browser supports installing web apps."
    );
  }

  // ==========================================
  // INSTALL BUTTON CLICK
  // ==========================================

  installButton.addEventListener(
    "click",
    async () => {
      if (
        isStandalone() ||
        installedThisSession
      ) {
        hideInstallButton();
        return;
      }

      if (promptInProgress) {
        return;
      }

      hideNotice();

      // ======================================
      // NATIVE BROWSER INSTALL PROMPT
      // ======================================

      if (deferredPrompt) {
        promptInProgress = true;

        const promptEvent = deferredPrompt;

        // Browsers generally allow this
        // prompt event to be used only once.
        deferredPrompt = null;

        try {
          await promptEvent.prompt();

          const choice =
            await promptEvent.userChoice;

          if (choice?.outcome === "accepted") {
            // The user accepted the browser
            // prompt. Wait for appinstalled
            // to confirm installation.
            console.log(
              "User accepted installation prompt."
            );
          } else {
            console.log(
              "User dismissed installation prompt."
            );
          }
        } catch (error) {
          console.warn(
            "Native installation prompt failed:",
            error
          );

          showInstallationUnavailable();
        } finally {
          promptInProgress = false;
          updateInstallButton();
        }

        return;
      }

      // ======================================
      // NO NATIVE PROMPT AVAILABLE
      // ======================================

      showInstallationUnavailable();
    }
  );

  // ==========================================
  // CLOSE NOTICE
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
  // INITIALIZE INSTALL BUTTON
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
              {
                scope: "/",
                updateViaCache: "none"
              }
            );

          console.log(
            "Frank News service worker registered:",
            registration.scope
          );

          // Ask the browser to look for an
          // updated service worker.
          registration.update().catch(
            error => {
              console.warn(
                "Service worker update check:",
                error
              );
            }
          );
        } catch (error) {
          console.warn(
            "Service worker registration failed:",
            error
          );
        }
      }
    );
  }
})();
