/* Project tab (#project/<slug>): the card on Work and the project page. */
(() => {
  const { h, at, text, input, list, group, note } = F;
  const enOf = (v) => (v && typeof v === "object" ? (v.en ?? "") : (v ?? ""));

  Editors.register("project", { form(el, hash) {
    const slug = hash.slice(8), FILE = Store.caseFile(slug), b = (...k) => at(FILE, k);
    if (!Store.get(FILE)) { el.append(h("h1", { class: "ed__title" }, "Project not found"), h("p", {}, `There is no project “${slug}”.`)); return; }
    const folder = `assets/img/${slug}`, vfolder = "assets/video";
    const setAr = (ib) => (r) => ib.sub("ar").set(r.ar);
    const gitem = (ib, i) => {
      const g = ib.get();
      return h("div", {},
        g.video ? F.video(ib.sub("video"), ib.sub("poster"), { label: "Video", folder: vfolder, prefix: slug, onUpload: setAr(ib) })
          : F.image(ib.sub("image"), { label: "Image", folder, onUpload: setAr(ib) }),
        input(ib.sub("ar"), { label: "Proportions (width ÷ height)", type: "number", step: "0.0001",
          hint: "Filled in automatically when you upload. 1 is square, below 1 is portrait, above 1 is landscape." }));
    };
    el.append(
      h("h1", { class: "ed__title" }, enOf(Store.get(FILE).name) || slug),
      h("p", { class: "ed__lede" }, h("span", {}, "Page address: "), h("a", { href: `../en/work/${slug}/index.html`, target: "_blank", rel: "noopener" }, `/work/${slug}/`)),
      group("Card on Work and page header",
        text(b("title"), { label: "Title", hint: "On the card and as the page heading, e.g. “Lumo / Gadget marketplace”." }),
        text(b("tags"), { label: "Tags", hint: "Separate with • like “Web Design • UX/UI Design”." }),
        text(b("name"), { label: "Short name", hint: "Used in the previous/next links at the bottom of other projects." }),
        F.image(b("cover"), { label: "Cover on Work", folder: "assets/img", widths: [678, 1356], hint: "Shown cropped to 678 × 420 on the Work page. Upload at least 1356 px wide." }),
        input(b("hero", "bg"), { label: "Background colour", type: "color", hint: "Behind the cover and the big image while they load." })),
      group("Big image at the top",
        F.image(b("hero", "image"), { label: "Image", folder, hint: "At least 1920 px wide." }),
        F.video(b("hero", "video"), b("hero", "poster"), { label: "Video (optional, plays over the image)", folder: vfolder, prefix: slug, removable: true })),
      group("Project overview",
        text(b("overview", "heading"), { label: "Heading" }),
        text(b("overview", "text"), { label: "Text", paragraphs: true })),
      group("Gallery",
        list(b("gallery"), { label: "Images and videos", summary: (g, i) => `${i + 1}. ${g.video ? "Video" : "Image"} · ${(g.video || g.image || "").split("/").pop()}`,
          thumb: (g) => g.video ? h("video", { class: "mini", src: F.mediaUrl(g.video), poster: g.poster ? F.mediaUrl(g.poster) : null, muted: true, preload: "none" })
            : h("img", { class: "mini", src: F.mediaUrl(g.image + "-sm.webp"), alt: "", loading: "lazy" }),
          note: "Shown in this order. Images: at least 1920 px wide. Videos: MP4, ideally under 25 MB.", item: gitem }),
        h("div", { class: "row" },
          h("button", { type: "button", class: "secondary sm", onclick: async () => {
            const files = await Media.pick("image/*", true); if (!files.length) return;
            const st = el.querySelector(".gal-status"); st.classList.remove("error");
            const added = [];
            for (const [k, f] of files.entries()) {
              st.textContent = `Preparing ${k + 1} of ${files.length}…`;
              try { const r = await Media.image(f, folder); added.push({ image: r.base, ar: r.ar }); }
              catch (e) { st.textContent = e.message; st.classList.add("error"); }
            }
            if (added.length) { Store.update(FILE, (c) => { c.gallery = (c.gallery || []).concat(added); }); Editors.refresh(); }
          } }, "+ Add images"),
          h("button", { type: "button", class: "secondary sm", onclick: async () => {
            const [f] = await Media.pick("video/mp4,.mp4"); if (!f) return;
            const st = el.querySelector(".gal-status"); st.classList.remove("error"); st.textContent = "Reading the video…";
            try { const r = await Media.video(f, vfolder, slug); Store.update(FILE, (c) => { c.gallery = (c.gallery || []).concat([{ video: r.video, poster: r.poster, ar: r.ar }]); }); Editors.refresh(); }
            catch (e) { st.textContent = e.message; st.classList.add("error"); }
          } }, "+ Add video")),
        h("p", { class: "field__hint gal-status" })),
      group("Search engines and sharing",
        text(b("description"), { label: "Description", big: true, hint: "Shown under the title in Google and in link previews. Usually the first sentence of the overview." })),
    );
    F.restoreGroups(el);
  } });
})();
