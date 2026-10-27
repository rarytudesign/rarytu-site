---
name: rarytu-cms
description: Build and maintain the admin panel (CMS) for Nastya's portfolio site rarytudesign/rarytu-site. Use when continuing work on the panel, editing site content through it, or when Nastya shares SKILL.md / PROGRESS.md as a reminder.
---

# Rarytu site admin panel (CMS)

Nastya (Anastasiia Rarytu, brand and digital designer) has a hand-built bilingual portfolio site.
She wants a full admin panel so she can change anything on the site herself, without Claude:
edit every page, add new projects to Selected work with their own case page, add and edit
Work experience / Education / Tools / contacts and other list items, change links, images, videos and files,
and keep the existing Site backups as one tab of the panel.

**Always start by reading `docs/cms/PROGRESS.md`** in the repo. It says which step is next.
Do one step at a time, test it, commit it, tick it in PROGRESS.md, then move on.
Steps are small on purpose: a step must fit in one stretch of work so no context is lost mid-step.

## Where things are

- Repo: `rarytudesign/rarytu-site` (GitHub), branch `main`. Clone at `/home/claude/rarytu-site`
  (if missing: `add_repo` with push access, clone, `register_repo_root`).
- Live site: https://rarytudesign.github.io/rarytu-site/ (GitHub Pages from `main`, root, `.nojekyll`).
  A push is live in about 1–2 minutes.
- Static site, no build step on the server. Pages: `index.html` (redirects by language),
  `en/` and `ru/`: `index.html` (Work), `about/`, `approach/`, `work/<slug>/` (cases: dom, hevy, kodan, lumo, nomi, talktoast).
- `assets/styles.css`, `assets/main.js`, `assets/fonts.css`, `assets/img/`, `assets/video/`, `assets/cv/`.
- `admin/index.html`: the panel (today: Site backups only). `admin/history.json`: version and event log.
- `docs/cms/`: this skill and the progress file. `tools/`: test helpers (mock GitHub API etc.).

## Decisions already made (do not re-ask)

1. Editing = forms + live preview. Fields on the left, the real page rendered on the right, updated as she types.
   Preview has EN/RU and mobile (390) / tablet (834) / desktop (1440) switches.
2. Publishing = drafts + one **Publish** button. Edits are kept as a draft in the browser (IndexedDB, survives reloads).
   Publish renders every page and sends everything in one commit, which becomes a new version in the history.
   "Discard draft" returns to the live content.
3. The "(Admin)" link is removed from the public site. The panel lives at `/admin/` (Nastya bookmarks it).
   Without a GitHub token the panel can't change anything.
4. Site backups stays as it works now, moved into a "Site backups" tab. Backups are only saved to her computer.
   Restore replaces the whole site but never rolls back `admin/` (the panel itself).
5. "Third button" on the backups page: ignore, it was a typo.

## Architecture

Content is data, pages are generated from it:

- `content/site.json`: shared things: name, taglines, nav labels, contacts, CV files, footer texts, SEO defaults.
- `content/pages/work.json`, `about.json`, `approach.json`: page content.
- `content/cases/<slug>.json`: one per project: card (cover, tags, title, bg colour, order, visible),
  case page (title, tags, hero media, overview, gallery items).
- Every text field is `{ "en": "...", "ru": "..." }`. Where mobile/tablet copy differs from desktop
  (the site uses `.v-d` desktop-only and `.v-mt` mobile+tablet copy), the field is
  `{ "en": {...}, "ru": {...} }` with `d` and `mt` variants, or a plain string when both are the same.
- `admin/cms/render.js`: pure functions `content → HTML string` for every page and language.
  Runs in the browser (panel preview and publish) and in Node (tests). No DOM needed.
- Generated HTML is committed as normal files, so the site stays plain static HTML (fast, SEO, works without JS).
- `styles.css` and `main.js` are not edited by the panel. New page types must reuse existing classes.

Rule for the renderer: for the current content it must reproduce today's HTML exactly
(compare with whitespace normalised; any difference must be explained and approved by a visual check).

## Writing to GitHub from the panel

- Uses the Git Data API with Nastya's fine-grained token (Contents: read and write on rarytu-site),
  kept in her browser's localStorage under `rarytu-gh-token`. Code for snapshot / blobs / tree / commit / ref
  already exists in `admin/index.html` (backups); move it into a shared module, don't duplicate it.
- One publish = one commit with a full tree. PATCH the ref with `force:false`; on 422 start again from a fresh snapshot.
- After writing, verify the result (fingerprint of the new tree equals the expected one).
- Versions: a version is the set of site files outside `admin/` (SHA-256 fingerprint of sorted `path sha` lines).
  `admin/history.json` = `{ versions:[{v,fp,at}], events:[{v,type,at,file}] }`, types: `backup`, `restore`, `publish`.

## Media

- Images: converted in the browser to WebP, two sizes like today (`name-sm.webp` 960w and `name.webp` 1920w;
  covers 678w / 1356w), aspect ratio stored in content. Keep file names lowercase-kebab.
- Videos: MP4 uploaded as is, poster generated from the first frame as WebP. Warn above 25 MB, refuse above 95 MB
  (GitHub API limit is 100 MB).
- Files (CVs etc.): uploaded as is.

## How Claude works on this (constraints learned the hard way)

- From the Claude session, `git push` to the repo works, but GitHub **API writes are blocked by the proxy**,
  and the browser (Playwright) can't use the session's GitHub credentials. So write-path tests run against
  `tools/mock-github.js`, a fake GitHub API backed by a real local bare git repo (same SHAs, same 422 rule).
- Pages API is blocked too; Pages is already enabled.
- Test every step: Node tests for the renderer (HTML diff), Playwright for the panel (Chromium is preinstalled,
  `require('playwright')`), screenshots at 390 / 834 / 1440 when layout could change.
- Commit messages end with the attribution lines from the session's system reminder.
- Never commit secrets. Never touch `admin/history.json` by hand except to fix a bug.

## Site rules that apply to all generated content

- Breakpoints: mobile 0–743, tablet 744–1279, desktop ≥1280.
- Utilities: `.v-d` desktop copy, `.v-mt` mobile+tablet copy, `.only-t` / `.no-t` tablet only / not tablet,
  `.br-m` line break on mobile only, `.only-d` / `.only-mt` (older names).
- Reveal animations: `.rv`, line splitting `.ls`/`.lw` happen in main.js; the renderer outputs plain markup.
- Skeleton loader is traced from the real layout in main.js; nothing to generate.

## Writing style (Nastya's hard rules)

- No em dashes anywhere: copy, UI labels, commit messages, docs.
- Plain, human, concise wording. No marketing tone. Panel UI is in English, replies to Nastya in her language (usually Russian).
- Act as an experienced designer and editor: point out problems, suggest better options.

## Reporting

After each step: update PROGRESS.md (status, what changed, anything to check), commit, push.
Tell Nastya briefly what's done and what's next. When a step changes something she can see, say where to look.
