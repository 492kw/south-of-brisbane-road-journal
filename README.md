# South of Brisbane

A one-page photo journal of Simon’s coastal road trip from Tweed Heads to Minnie Water, initially with Dan and then solo, built as a static site for GitHub Pages.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

The site uses vanilla HTML, CSS and JavaScript. Its image lightbox works with a mouse or keyboard.

## Required photo-sizing audit for every post

Before publishing a new or updated journal post, start the local server and run `npm ci && npm run audit:images -- http://127.0.0.1:8000`; after deployment, run the same command against the cache-busted Pages URL. The audit covers every article image at desktop and a 390px viewport. Confirm and record that:

- grouped images use consistent available-width columns;
- portraits and panoramas have deliberate, safe uncropped treatment;
- no image is unexpectedly tiny, distorted, badly crops an important subject, overflows horizontally, or fails to load; and
- console/page errors are absent and every article image still opens and closes in the lightbox.
