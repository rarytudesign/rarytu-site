# Context for an AI assistant (read this first)

You are continuing work on **rarytu.com**, the bilingual (EN/RU) portfolio site of Anastasia Rarytu (Nastya),
a brand and digital designer. She designs in Figma; the site was built from her Figma file by Claude.
This file is enough to start without any previous chat. Details and the full decision log: `docs/cms/PROGRESS.md`
(read its latest entries at the end), the admin panel brief: `docs/cms/SKILL.md`. Restore guide for humans: `docs/RESTORE.md`.

## How to talk to Nastya

- Reply in Russian (she writes in Russian). Casual, direct, colleague to colleague.
- **No em dashes anywhere**: replies, site copy, UI labels, commit messages, docs.
- Plain, human wording, no marketing tone. Flag anything that reads as AI-written or clichéd.
- Act as an experienced designer and editor: point out problems and better options, don't just execute.
- She tests on an iPhone (Safari) and a Windows PC (Chrome/Brave) and sends screenshots and screen recordings.
  For a recording: extract frames (ffmpeg, 4–5 fps) and read them as contact sheets.

## Where the site lives

- GitHub repo **rarytudesign/rarytu-site**, branch `main`, served by GitHub Pages at **https://rarytu.com**
  (`CNAME`; www and the old github.io address redirect; rarytu.ru redirects via Spaceweb). A push is live in 1–2 minutes.
- GitHub Pages sends `cache-control: max-age=600` and ignores `?v=` query strings: for 10 minutes after a deploy a browser
  may show an **old cached page with the new CSS/JS**. When markup and CSS/JS change together, keep old selectors working.
- Analytics: Cloudflare Web Analytics (cookie-free), token in `content/site.json` → `analytics.cloudflare`; the beacon is
  served from the site (`assets/vendor/`), because Russian ISPs cut Cloudflare connections.

## Architecture

Static site, no server, no framework. Content is data; pages are generated from it.

```
content/site.json            shared: name, url, contacts, CV paths, nav/UI labels, share image, analytics, assetsVersion
content/pages/work|about|approach.json   page content
content/cases/<slug>.json    one per project (card + case page)
admin/cms/render.js          pure functions content → HTML (runs in Node and in the browser panel)
tools/build.js               writes all 18 pages from content (en/, ru/), stamps asset versions (?v=hash)
tools/test-render.js         checks the committed pages equal the renderer's output
en/ ru/ (index, about/, approach/, work/<slug>/)   GENERATED pages, committed as plain HTML
index.html (root)            hand-made: picks the language (saved choice, else device languages, else EN) + link-preview tags
assets/styles.css, main.js, spheres.js           hand-written, the panel never edits them
admin/                       Nastya's admin panel (forms + live preview, drafts, Publish = one commit, backups)
```

Every text field is `{ "en": ..., "ru": ... }`; where phone/tablet copy differs from desktop: `{ "d": ..., "mt": ... }`.

**Golden rule: never hand-edit `en/**` or `ru/**`.** Change `content/*.json` or `admin/cms/render.js`, then run
`node tools/build.js` and `node tools/test-render.js`, and commit content + pages together. A hand edit would be
overwritten by the next Publish from the panel. Also run `node tools/build.js` after changing any `assets/` or `admin/cms/`
file (it re-stamps versions). Before changing content files, warn Nastya: she may have an unpublished draft in the panel.

## Layout rules

- Breakpoints: phone 0–743, tablet 744–1279, desktop ≥ 1280. Figma frames: 390 / 820 / 1920 wide.
  Desktop sizes are px at 1920 and scale down with clamp(). Figma dumps for numeric checks: `docs/figma/*.json`
  with `tools/measure.js` + `tools/figma-compare.py`.
- Utilities: `.v-d` desktop copy, `.v-mt` phone+tablet copy, `.br-m` line break on phones only, `.nw` no wrap.
- Russian typography is automatic in render.js: short words (в, и, на…) glued to the next word, hyphenated words never
  split; a short last word (≤ 4 letters) is held with the previous one. main.js splits text into word blocks for the
  reveal animation and groups glued words so they still don't break.
- Rounded corners of case images and cards are a share of the image width (`--rr`), not fixed px.
- Phones/tablets end every page with a footer whose stretch (`.sfoot__run`, 40lvh) opens the next page; only a swipe that
  starts on the last screen or the footer counts. Never change the page height mid-gesture (iOS Safari breaks).
  Debug readout: add `?debug` to a page address.

## Working method that worked

- Test everything: Node tests for the renderer; Playwright for the browser (Chromium is preinstalled; WebKit, i.e. Safari,
  can be installed with `npx playwright install webkit` into a separate PLAYWRIGHT_BROWSERS_PATH). Screenshots at 390 / 834
  / 1440. Simulate iOS issues in WebKit (touch events, resize events while scrolling).
- `tools/test-footer.js`, `tools/check-live.js https://rarytu.com` (every page, file and link on the live site).
- Commit messages in plain English, no em dashes. After each change: add a dated entry to `docs/cms/PROGRESS.md`.
- After a deploy check the live site (curl the page and look for the new asset version).
- Remind Nastya to make a fresh backup in the panel (Site backups → Save backup) after a series of changes.
