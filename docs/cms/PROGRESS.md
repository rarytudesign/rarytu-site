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
- [x] B4 Live preview: iframe with the rendered page, EN/RU switch, 390 / 834 / 1440 switch
- [x] B5 Form kit: EN/RU text, desktop vs mobile+tablet text, paragraphs, link, colour, list editor (add, remove, reorder)

## C. Page editors
- [x] C1 Site tab: name, taglines, menu labels, contacts (add/edit/remove), CV files, SEO texts
- [x] C2 Work tab: hero texts, Selected work cards (order, show/hide)
- [x] C3 About tab: hero and bio, photos with captions, Work experience, Education, Tools and other lists
- [x] C4 Approach tab: every section
- [x] C5 Project tab: card, header, tags, hero media and colour, overview, gallery (images/videos, reorder)

## D. Media
- [x] D1 Image upload: WebP conversion, two sizes, aspect ratio
- [x] D2 Video upload: MP4, poster from first frame, size limits
- [x] D3 Files (CV and others): upload, replace

## E. New pages
- [x] E1 "+ New project": slug, titles EN/RU, creates the case page and its card on Work, prev/next links update
- [x] E2 Hide or delete a project (with confirmation; files stay in history)

## F. Publish
- [x] F1 Publish: render all pages, one commit with content + HTML + media, verify, history event "published" with version
- [x] F2 Errors and conflicts: offline, token expired, site changed meanwhile, large files; clear messages, nothing half-written.
  Also: a backup made before the panel existed has no content/ folder; restoring it removes content/. The panel must detect a missing
  content/ and say so (offer: restore a newer backup, or rebuild content from the pages with Claude) instead of breaking.

## G. Check and hand over
- [x] G1 End-to-end test on the mock GitHub: edit text, add project with media, publish, backup, restore
- [x] G2 Check the panel on a phone-sized screen
- [x] G3 Short guide for Nastya in README ("How to use the panel")
- [x] G4 Polish: hide typography markup in text boxes (e.g. auto-wrap hyphenated RU words in <span class="nw"> in the renderer and strip
  them from content; show <br class="br-m"> etc. in a friendlier way); count draft changes per page, not per file

## Notes for next steps
- Text format in content JSON: plain text, entities decoded (`&` not `&amp;`, real non-breaking spaces).
  Allowed inline tags: `<br>`, `<br class="br-m">` (phones only), `<br class="v-mt">` (phones+tablets), `<b>`, `<i>`, `<a href>`, `<span class="v-d">`.
  `<span class="nw">` is no longer stored: the renderer adds it to hyphenated words on RU pages.
  The renderer escapes everything else.
- "Identical" for the renderer test = same after decoding entities and collapsing whitespace.
- site.json has: name, copyright, shareImage, cv per language, contacts (footer order; `icon` = full SVG for the
  Approach buttons, `iconLabel` per language, `copy` for email), `approachButtons` (button order on Approach), `ui` strings per language.
- Page-specific shell values (title, description, sidebar tagline, mobile menu tagline, footer title on Approach)
  go into each page's own JSON in A4–A6; case pages use the Work page tagline and their own title/description.

## Log
- 2026-10-28: Desktop gap above the dot field footer tripled: margin-top 320px (case 290px + its 30px padding), ~330px to the
  letters. Site CSS/JS now cache-busted: build.js writes their hash to site.json assetsVersion, pages link styles.css?v=<hash>.
- 2026-10-28: Desktop footer everywhere. render.js dfoot(ctx, {id, desktopOnly}) is the shared dot field footer; Work, About
  (id contact-d) and case pages (id contact) get it with .dfoot--d (only ≥1280), where .footer--mt (the contact list) is hidden.
  Approach keeps dfoot from tablet up. Title = approach.json contactTitle (ctx.contactTitle, read in renderRaw for every page).
  Buttons per Figma 286:1936: white 52px circles, 1px brand ring, brand glyph (CSS recolours the stored SVGs), contacts reordered
  to Mail, Telegram, LinkedIn, Instagram, Behance (one list, so the mobile/tablet list follows). "Contact" link = #contact on the
  page itself (case pages: approach #contact as fallback); main.js scrolls to the visible [data-contact-target] on any page.
  Fix: noOrphans skips *tagline paragraphs (RU Approach sidebar tagline overflowed at 1920).
- 2026-10-28: Feedback round 3. (1) Work page circles: the whole circle is a link on every device (.circle__hit no longer
  pointer-events:none on hover devices; cursor pointer). (2) About photos cropped exactly as in Figma (same crop at all breakpoints:
  frame ~415:293, Figma fills: photo-1 118.42%/126.1% at 0.1%/-0.16%; photo-3 100%/141.98% at 0/-9.61%; photo-2 162.77%/230.54% at
  -28.7%/-60.54%; photo-4 107.93%/271.75% at 0.02%/-89.87%) → new files assets/img/about/photo-N-crop(-sm).webp; originals kept.
  (4) RU desktop bio column 1 text from Figma. Desktop bio columns 426/394px, text 411/344 (EN) and 409/394 (RU): tablet limits used
  to leak into desktop. (5) Renderer noOrphans(): last two words of every <p>/<figcaption> with 4+ words are joined (all languages);
  RU: short words (1–2 letters) get a non-breaking space after them automatically (keepHyphens). (6) Copyright "©{year}" in site.json,
  rendered as ©<span data-year>YYYY</span>; main.js sets the current year. Mobile Figma measurements unchanged after all this.
- 2026-10-27: Figma check round 2 (mobile). Text gets 2px slack into the side margin (browsers count trailing letter-spacing,
  Figma doesn't); education paragraph gap 8px; RU: principles heading wraps (nbsp removed, text-wrap), Approach heading 40/36 and intro
  276px wide, tools text full width with no paragraph gaps, About bio column 2 split into two paragraphs with 6px gap. Measured: EN and RU
  Work / About / Approach / HEVY all within 0–3px of Figma section by section.
- 2026-10-27: Figma check round (mobile 390, Figma page 131:2228; tablet page 141:11037).
  Preview bug: iframe got its width after loading, so main.js split headings into one word per line; now the frame is sized first.
  EN content: 275 non-breaking spaces removed (kept next to &, → and after digits); they made lines wrap earlier than in Figma.
  RU keeps its nbsp (Russian typography). CSS (end of styles.css, "Figma check" comments): company line under a role trimmed to cap
  height (<1280); mobile footer 24px above © row; contact rows 53px (<1280); principles swipe 24px above; mobile tools text 346px wide;
  gallery→prev/next gap 54px mobile, 52px tablet. Measured: EN Work, About, Approach, HEVY match Figma within 1–2px except
  About bio column 2 (browser renders "China." one line lower than Figma: font rendering, text is identical).
  Dots: main.js placeDots() moves a decorative dot to the nearest free spot when its designed spot covers text, links, buttons,
  covers, gallery or other media (About photos and Approach video edges allowed, as in Figma); hides it if no free spot within 480px.
  Checked 390/834/1024/1440/1920 × 6 pages: 0 overlaps.
  RU mobile Work experience now as in Figma: company line hidden (<744, RU only; tablet/desktop keep it), description 14px below
  the role, no gap between paragraphs. Entries match Figma within 0–2px.
- 2026-10-27: Feedback round 2 done. (a) No dashes: RU case openings rewritten ("Компания DOM работает…", "Lumo: кураторский…").
  (b) One contacts list: approachButtons removed from site.json; Approach round buttons follow site.contacts order (email now last).
  (c) Line breaks: text boxes show breaks as plain new lines; Shift+Enter = new line, Enter = new paragraph in paragraph boxes
  and nothing in one-line boxes. fromBox(text, prev) keeps each existing break's kind (<br>, v-mt, br-m) when the text before or
  after it is unchanged; new breaks are <br>. [phone break]/[mobile break] tokens removed. Hint shown once per editor + on fields with breaks.
  (d) Undo/Redo: Store.undo/redo/canUndo/canRedo, snapshots of the draft (max 200), typing in one field within 1 s = one step,
  upload + its change = one step, Discard is undoable, history cleared after Publish. Buttons next to the name; Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y.
- 2026-10-27: Nastya's feedback done (G4):
  1) "—" → "-" in all content. 2) Contacts: max 10 in the panel; renderer adds data-n to .frow when not 5 (5 = designed grid, unchanged);
  data-n grid = copyright max-content + equal columns; main.js fitFooter() adds .footer--stack (mobile-style list) on desktop when the row
  or a label doesn't fit (checked 1280–1920: 10 short contacts fit at 1920, stack at 1440). 3) Markup: renderer keepHyphens() wraps
  hyphenated words in span.nw on RU pages automatically (body text only, not in tags/SVG/head); nw spans removed from content;
  text boxes show [phone break] (br-m) and [mobile break] (v-mt); Approach principles title is now {d:"…:", mt:"…"} rendered by
  headingVar() as "…<span class=v-d>:</span>" (same HTML). Draft counter: "N pages changed, M new files".
- 2026-10-27: Live check: panel works on GitHub Pages (without a token, content loads from the site; with her token, from GitHub).
  tools/build.js now also stamps admin asset versions (?v=hash). Waiting for Nastya's feedback; then G4 polish.
  Open questions sent to her: em dashes in RU case texts (12 places), 6th contact wraps the footer.
- 2026-10-27: G1–G3 done. G1 = tools/test-publish.js + test-backups.js + test-store.js. G2: iPhone 13 check, no horizontal scroll;
  preview defaults to Mobile width on narrow screens; panel opens on #work by default. G3: Russian guide "Панель управления" in README.md.
  Left: G4 polish (typography markup in text boxes, per-page change count) after Nastya's first feedback.
- 2026-10-27: F1+F2 done. admin/cms/publish.js (window.Publish): dialog lists changed pages and new files; blocks on missing cover / empty title /
  gallery or About photo without a file; soft warning for a project without a top image; conflict warning (pages changed on the site since the draft
  started) with "Publish anyway". run(): fresh snapshot → content JSON (2-space + newline) + media + all pages rendered → upload only changed blobs
  (sha checked) → remove pages of unlisted projects and content set to null → history event {type:"publish"} → one commit (force:false, retries on
  422 from a fresh snapshot) → verify fingerprint → Store.published(). Errors: offline/other → "Not published, draft is safe, Try again";
  401/403 → token box. Test: tools/test-publish.js passes (block, publish, pages added/removed, media, history v.2); afterwards
  `node tools/build.js` on the published repo writes nothing (pages == content).
  SKILL.md: golden rule added (Claude edits content + build, never generated pages).
- 2026-10-27: E1+E2 done. admin/cms/ed-projects.js: "+ New project" (short name, title, address/slug auto from the name, checked for
  format and duplicates, background colour) → creates content/cases/<slug>.json in the draft, adds it first in work.projects, opens its tab.
  window.ProjectActions(slug) at the bottom of a project tab: Hide (moves slug to work.hidden; its pages are removed on publish), Show again
  (appends to the end), Delete (removes from lists, Store.set(caseFile, null) = delete on publish). Hidden projects show struck through in tabs.
  Store.set(path, null) for a file that was never published drops out of the draft. Renderer: a hidden project's preview links prev/next to visible ones.
  Publish (F1) must: render pages for work.projects only, delete en|ru/work/<slug>/index.html for slugs no longer listed, delete content files set to null.
- 2026-10-27: D1–D3 done. admin/cms/media.js (window.Media: pick, image(file, folder, widths) → {base, ar}, video(file, folder, prefix)
  → {video, poster, ar, width, height}, file(f, folder) → path) and upload versions of F.image / F.video (Replace / Upload / Remove).
  Names: <folder>/<slug-of-filename>-<4 random chars>; images WebP 960/1920 (covers 678/1356), no upscaling; video MP4 only, warn > 25 MB,
  refuse > 95 MB, poster = first frame WebP; CV keeps its file name (overwrites on publish, same link). Wired into: project (cover, hero image,
  hero video add/remove, gallery + Add images (multiple) / + Add video), About photos (+ Add photo), Approach videos, Site CVs.
  F.group remembers open/closed per page (sessionStorage); F.restoreGroups(el); Editors.refresh() rebuilds the form keeping scroll.
  Test note: Playwright's Chromium can't play H.264, so tests use a VP9-in-MP4 clip; real Chrome/Safari play H.264.
  Publish must block empty images (an added About photo without upload) – handle in F1 validation.
- 2026-10-27: C5 done. ed-project.js (#project/<slug>): card + header (title, tags, short name, cover, bg colour), hero image/video (display),
  overview (heading, paragraphs), gallery list with thumbnails in collapsed rows (F.list opts.thumb), proportions (ar), SEO description.
  forms.js got display-only F.image(b) (b = base path, shows -sm.webp) and F.video(bVideo, bPoster), F.mediaUrl(path) (draft blobs or site file).
  D1/D2 replace F.image/F.video with upload versions and add "+ Add image/video" to the gallery.
- 2026-10-27: C4 done. ed-approach.js: intro (heading, text with variants), steps (+ add; numbers automatic; the "→ " is typed text),
  WIP caption (video replace waits for D2), principles (+ add, title/text with variants, swipe), tools (heading, paragraphs with variants),
  contact block headings (desktop and mobile/tablet), SEO + taglines. Note: when one language uses desktop/mobile variants, the form shows
  variants for both; saving writes {d, mt} for both (renders identically).
- 2026-10-27: C3 done. ed-about.js: intro (heading, two bio columns × desktop / mobile+tablet, heading + paragraphs), photos (captions, order;
  adding/replacing waits for D1), experience and education lists (+ add, years, role, company, paragraphs; logo note), tools (+ add, name,
  optional SVG icon code), SEO + both taglines. F.pair(file, lang => keys) for values stored per language at different paths.
  List rows update their collapsed title while typing.
- 2026-10-27: C2 done. ed-work.js: intro (heading with variants, lede), Selected work (title, intro line, project order: list with fixed:true =
  no delete, links to each project tab), circles (fixed 2: heading, text, link text, target page), ring centre text (ring words are artwork),
  SEO (title, description, tagline). F.list got `fixed` (no delete button).
- 2026-10-27: B5+C1 done. admin/cms/forms.js (window.F): at(file, keys) binding with get/set/sub; text(b, {label, hint, paragraphs, variants, big})
  = EN+RU boxes, optional "Different text on mobile and tablet" (d/mt), keeps plain strings when both languages match, line break = <br>,
  paragraphs separated by an empty line; input(b, {type: url|color|number|text}) with checks; select(); list(b, {item, summary, make, addLabel,
  minItems, note}) with collapse, ↑ ↓ ✕ (confirm); group(title, ...). Editors live in admin/cms/ed-<name>.js and call Editors.register(name, {form(el, hash)}).
  C1: ed-site.js (name, copyright, contacts list, Approach round buttons order, CV paths (upload in D3), menu labels, small UI texts).
  Note for Nastya: the footer grid fits 5 contacts; a 6th wraps the email to a new row.
- 2026-10-27: B4 done. admin/cms/preview.js (window.Preview.mount(el, {key, slug?})): renders the page from the draft into an iframe
  (srcdoc + <base> of the real page URL), EN/RU and Mobile 390 / Tablet 834 / Desktop 1440 switches (remembered), scaled to fit,
  keeps scroll position, blocks link navigation, turns off skeleton/reveal animations, draft media shown via blob URLs.
  admin/cms/editors.js (window.Editors.open/register/pageFor): form column + preview; tabs without fields yet show a note.
  Open question for Nastya: em dashes in the first sentence of each RU case overview + description ("Lumo — …"), 12 places.
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
