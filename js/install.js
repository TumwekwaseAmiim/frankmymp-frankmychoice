
/*
  #FrankMyMP #FrankMyChoice
  PWA Installation Controller

  Displays Install App when appropriate.
  Hides after successful installation.
*/

(() => {
  "use strict";

  const installButton =
    document.getElementById("installAppBtn");

  const notice =
    document.getElementById("installNotice");

  const noticeText =
    document.getElementById("installNoticeText");

  const closeNotice =
    document.getElementById("closeInstallNotice");

  if (!installButton) return;

  let deferredPrompt = null;

  const isIOS =
    /iphone|ipad|ipod/i.test(
      navigator.userAgent
    ) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    );

  function isStandalone() {
    return (
      window.matchMedia(
        "(display-mode: standalone)"
      ).matches ||
      window.navigator.standalone === true
    );
  }

  function showNotice(text) {
    if (!notice || !noticeText) return;

    noticeText.textContent = text;
    notice.hidden = false;
  }

  function hideNotice() {
    if (notice) {
      notice.hidden = true;
    }
  }

  function hideInstallButton() {
    installButton.classList.add("hidden");
  }

  function showInstallButton() {
    if (isStandalone()) return;

    installButton.classList.remove("hidden");
  }

  function updateInstallButton() {
    if (isStandalone()) {
      deferredPrompt = null;
      hideInstallButton();
      return;
    }

    if (deferredPrompt || isIOS) {
      showInstallButton();
    } else {
      hideInstallButton();
    }
  }

  // Chrome / Edge installation prompt.

  window.addEventListener(
    "beforeinstallprompt",
    event => {
      event.preventDefault();

      deferredPrompt = event;

      updateInstallButton();
    }
  );

  // Browser confirms installation.

  window.addEventListener(
    "appinstalled",
    () => {
      deferredPrompt = null;
      hideInstallButton();
      hideNotice();
    }
  );

  // Hide when opened as an installed app.

  const displayMode = window.matchMedia(
    "(display-mode: standalone)"
  );

  displayMode.addEventListener?.(
    "change",
    updateInstallButton
  );

  // Installation button action.

  installButton.addEventListener(
    "click",
    async () => {
      if (isStandalone()) {
        hideInstallButton();
        return;
      }

      if (deferredPrompt) {
        const promptEvent = deferredPrompt;

        deferredPrompt = null;
        hideInstallButton();

        try {
          await promptEvent.prompt();

          const choice =
            await promptEvent.userChoice;

          if (choice?.outcome === "accepted") {
            hideInstallButton();
          }

        } catch (error) {
          console.warn(
            "Install prompt unavailable:",
            error
          );

          showNotice(
            "Use your browser menu and select Install app or Add to Home Screen."
          );
        }

        // The browser controls when another
        // installation prompt is available.

        updateInstallButton();
        return;
      }

      if (isIOS) {
        showNotice(
          "On iPhone or iPad, open this website in Safari, tap Share, then choose Add to Home Screen and confirm Add."
        );
        return;
      }

      showNotice(
        "Open your browser menu and select Install app or Add to Home Screen, if available."
      );
    }
  );

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

  // Initial visibility.

  updateInstallButton();

  // Service worker for basic PWA support.
  // Requires a /sw.js file and HTTPS
  // (localhost also works for local testing).

  if ("serviceWorker" in navigator) {
    window.addEventListener(
      "load",
      async () => {
        try {
          await navigator.serviceWorker.register(
            "/sw.js",
            { scope: "/" }
          );
        } catch (error) {
          console.warn(
            "Service worker not registered:",
            error.message
          );
        }
      }
    );
  }
})();
