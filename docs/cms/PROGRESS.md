# Admin panel: progress

Status: `[ ]` to do · `[~]` in progress · `[x]` done.
Rule: one step at a time. Test, commit, push, then tick it here.

## 0. Setup
- [x] 0.1 Plan, SKILL.md and this file
- [x] 0.2 Remove the "(Admin)" link from all public pages (keep the name as before)
- [x] 0.3 Move the mock GitHub API and test scripts into `tools/` so they live with the repo

## A. Content model and renderer (site looks exactly the same afterwards)
- [ ] A1 `content/site.json`: shared shell data (name, taglines, nav, contacts, CV, footer, meta)
- [ ] A2 `admin/cms/render.js`: shared shell (head, sidebar, tablet bar, mobile bar and menu, footer) + Node test harness that diffs against current HTML
- [ ] A3 Case pages: `content/cases/*.json` for all 6 projects, renderer, 12 pages identical
- [ ] A4 Work (home) page: content + renderer, 2 pages identical
- [ ] A5 About page: content + renderer, 2 pages identical
- [ ] A6 Approach page: content + renderer, 2 pages identical
- [ ] A7 Root `index.html`, full check of all 20 pages, screenshots at 390 / 834 / 1440

## B. Panel shell
- [ ] B1 Panel layout with tabs: Site, Work, About, Approach, one per project, "+ New project", Site backups (backups moved in as is)
- [ ] B2 Shared GitHub module (token, snapshot, blobs, commit) used by backups and publishing
- [ ] B3 Loading content from GitHub + draft storage in the browser (IndexedDB), "unsaved changes" marker, Discard draft
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
- [ ] F2 Errors and conflicts: offline, token expired, site changed meanwhile, large files; clear messages, nothing half-written

## G. Check and hand over
- [ ] G1 End-to-end test on the mock GitHub: edit text, add project with media, publish, backup, restore
- [ ] G2 Check the panel on a phone-sized screen
- [ ] G3 Short guide for Nastya in README ("How to use the panel")

## Log
- 2026-10-27: plan approved. Decisions: forms + live preview; drafts + Publish; "(Admin)" link removed from the site; backups become a tab.
