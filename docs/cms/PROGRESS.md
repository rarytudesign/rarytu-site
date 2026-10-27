# Admin panel: progress

Status: `[ ]` to do · `[~]` in progress · `[x]` done.
Rule: one step at a time. Test, commit, push, then tick it here.

## 0. Setup
- [x] 0.1 Plan, SKILL.md and this file
- [x] 0.2 Remove the "(Admin)" link from all public pages (keep the name as before)
- [x] 0.3 Move the mock GitHub API and test scripts into `tools/` so they live with the repo

## A. Content model and renderer (site looks exactly the same afterwards)
- [x] A1 `content/site.json`: shared shell data (name, taglines, nav, contacts, CV, footer, meta)
- [x] A2 `admin/cms/render.js`: shared shell (head, sidebar, tablet bar, mobile bar and menu, footer) + Node test harness that diffs against current HTML
- [x] A3 Case pages: `content/cases/*.json` for all 6 projects, renderer, 12 pages identical
- [x] A4 Work (home) page: content + renderer, 2 pages identical
- [x] A5 About page: content + renderer, 2 pages identical
- [x] A6 Approach page: content + renderer, 2 pages identical
- [x] A7 Root `index.html`, full check of all 20 pages, screenshots at 390 / 834 / 1440

## B. Panel shell
- [x] B1 Panel layout with tabs: Site, Work, About, Approach, one per project, "+ New project", Site backups (backups moved in as is)
- [x] B2 Shared GitHub module (token, snapshot, blobs, commit) used by backups and publishing
- [x] B3 Loading content from GitHub + draft storage in the browser (IndexedDB), "unsaved changes" marker, Discard draft
- [ ] B4 Live preview: iframe with the rendered page, EN/RU switch, 390 / 834 / 1440 switch
- [ ] B5 Form kit: EN/RU text, desktop vs mobile+tablet text, paragraphs, link, colour, list editor (add, remove, reorder)

## C. Page editors
- [ ] C1 Site tab: name, taglines, menu labels, contacts (add/edit/remove), CV files, SEO texts
- [ ] C2 Work tab: hero texts, Selected work cards (order, show/hide)
- [ ] C3 About tab: hero and bio, photos with captions, Work experience, Education, Tools and other lists
- [ ] C4 Approach tab: every section
- [ ] C5 Project tab: card, header, tags, hero media and colour, overview, gallery (images/videos, reorder)

## D. Media
- [ ] D1 Image upload: WebP conversion, two sizes, aspect ratio
- [ ] D2 Video upload: MP4, poster from first frame, size limits
- [ ] D3 Files (CV and others): upload, replace

## E. New pages
- [ ] E1 "+ New project": slug, titles EN/RU, creates the case page and its card on Work, prev/next links update
- [ ] E2 Hide or delete a project (with confirmation; files stay in history)

## F. Publish
- [ ] F1 Publish: render all pages, one commit with content + HTML + media, verify, history event "published" with version
- [ ] F2 Errors and conflicts: offline, token expired, site changed meanwhile, large files; clear messages, nothing half-written.
  Also: a backup made before the panel existed has no content/ folder; restoring it removes content/. The panel must detect a missing
  content/ and say so (offer: restore a newer backup, or rebuild content from the pages with Claude) instead of breaking.

## G. Check and hand over
- [ ] G1 End-to-end test on the mock GitHub: edit text, add project with media, publish, backup, restore
- [ ] G2 Check the panel on a phone-sized screen
- [ ] G3 Short guide for Nastya in README ("How to use the panel")

## Notes for next steps
- Text format in content JSON: plain text, entities decoded (`&` not `&amp;`, real non-breaking spaces).
  Allowed inline tags kept as is: `<br>`, `<br class="br-m">`, `<span class="nw">`, `<b>`, `<i>`, `<a href>`.
  The renderer escapes everything else.
- "Identical" for the renderer test = same after decoding entities and collapsing whitespace.
- site.json has: name, copyright, shareImage, cv per language, contacts (footer order; `icon` = full SVG for the
  Approach buttons, `iconLabel` per language, `copy` for email), `approachButtons` (button order on Approach), `ui` strings per language.
- Page-specific shell values (title, description, sidebar tagline, mobile menu tagline, footer title on Approach)
  go into each page's own JSON in A4–A6; case pages use the Work page tagline and their own title/description.

## Log
- 2026-10-27: B3 done. admin/cms/store.js (window.Store): load() reads content/*.json from GitHub at HEAD via raw URLs
  (falls back to the published site without GitHub); error code "no-content" when content/ is missing.
  get(path) / read(path) / set(path, obj) / update(path, fn) / addMedia(path, blob) / removeMedia / changed() / mediaChanged() /
  isDirty() / conflicts() (draft files whose published version moved since the draft copied them) / discard() / published(head, files) / on(fn).
  Draft lives in IndexedDB "rarytu-admin" key "draft": { startedAt, updatedAt, head, files, base, media }. A file edited back to
  its published state drops out of the draft. Hidden projects: work.json may get `hidden: [slugs]` (E2); store already loads them.
  Tabs show a dot for pages with unpublished changes; top bar shows "Draft: N changes not published", Discard, Publish (enabled when dirty).
  App calls Editors.open(hash, box) if window.Editors exists (B5/C steps). Test: tools/test-store.js (7 checks pass).
- 2026-10-27: B1+B2 done. Panel files: admin/index.html (shell: top bar with Publish/Discard, tabs, global GitHub token box, views),
  admin/cms/admin.css, admin/cms/github.js (window.GH: token, gh(), snapshot, versions, history log, commitTree, getFile),
  admin/cms/backups.js (window.Backups.open()), admin/cms/app.js (routing: #site #work #about #approach #project/<slug> #new-project #backups;
  default #backups for now). Page tabs show a placeholder. Backups e2e test (tools/test-backups.js) passes on the new shell.
  Mobile: tabs become a horizontal strip.
- 2026-10-27: A7 done. All 18 pages are now generated: `node tools/build.js` writes them from content/ (root index.html stays hand-made: it only redirects).
  Strict test (whitespace-sensitive, nbsp = space): 18/18. Visual check old vs new at 1440/834/390: identical except one intended fix
  (callout link on the RU home page had a non-breaking space before the arrow, now a normal space like the others; nbsp inside flex links widens the gap).
  Lesson: in render.js write non-breaking spaces as the escape \u00a0 inside JS strings, never as a literal character.
  Lesson: never `pkill -f` a pattern that also appears in the same shell command (it kills the shell).
- 2026-10-27: A6 done. approach.json = { title, description, tagline, menuTagline, heading, intro, steps [{title, text}] (numbers automatic),
  wip { dots, video, poster, width, height, caption }, principles { title, swipe, items [{title, text}] }, tools { title, text (paragraphs or {d:[],mt:[]}), video, poster, width, height },
  footerTitle (mobile/tablet footer), contactTitle (desktop dot-field footer) }. Desktop contact buttons come from site.contacts in site.approachButtons order;
  a contact without its own icon gets DEFAULT_ICON. Test: 18/18 pages same.
- 2026-10-27: A5 done. about.json = { title, description, tagline, menuTagline, heading, bio [2 columns: {en:{d:{heading,text[]},mt:{...}}, ru:...}],
  photos { dots, swipe, items [{image, caption}] }, experience/education { title, items [{date, role, company, text[], logo? per language {src,width,height}}] },
  tools { title, items [{icon (raw SVG markup), label}] } }. Section titles are stored without braces; renderer adds "{ … }" with nbsp before "}".
  Logos are only on the RU page today (per-language field). Lists are shared by both languages (same items, per-field translations).
- 2026-10-27: A4 done. work.json = { title, description, tagline, dots (decorative markup per language, not for editing),
  heading {d, mt}, lede, workTitle, workIntro, callouts [ {target page, title, text, link} ×2 ], ring { svg (shared), center }, projects }.
  Cards use the case's title, tags, hero.bg and `cover` (added to each case JSON). First card loads eagerly.
  Helper vp(): paragraph with v-d/v-mt when desktop and mobile copy differ, plain <p> otherwise.
  Renderer always puts a non-breaking space before the arrow icon in callout links; the test treats nbsp as a space.
  Test: 14/18 same (About and Approach left).
- 2026-10-27: A3 done. content/cases/<slug>.json = { slug, name (short, used in prev/next links), title, tags, description (SEO),
  overview { heading, text: { en:[paragraphs], ru:[...] } }, hero { bg, image? (base path without -sm/.webp), video?, poster? },
  gallery [ {image, ar} | {video, poster, ar} ] } (gallery is shared by both languages). Gallery: first 2 items load eagerly.
  content/pages/work.json so far: { tagline, projects: [slugs in Selected work order] }; prev/next is cyclic over that order.
  Test: 12/12 case pages same; Work/About/Approach still "not rendered yet" (A4–A6).
- 2026-10-27: A2 done. render.js has esc/rich/tr helpers, shell(), footer(). `node tools/test-render.js --shell` = 18/18 same; footer() checked on 4 variants. Next: A3 needs `renderPage(p, {site, read})` in render.js (the test calls it without --shell).
- 2026-10-27: A1 done (content/site.json).
- 2026-10-27: plan approved. Decisions: forms + live preview; drafts + Publish; "(Admin)" link removed from the site; backups become a tab.
