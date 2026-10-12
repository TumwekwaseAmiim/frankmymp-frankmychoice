Frank News app icons

Copy assets/icons/ into your website assets/icons/ folder. Place manifest.webmanifest in the website root.

Add these in the <head> of index.html and post.html (and optionally admin/index.html):
<link rel="icon" href="/assets/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#FFD800">

A manifest by itself does not guarantee an install prompt; HTTPS, suitable browser support, and possibly a service worker may be needed.
