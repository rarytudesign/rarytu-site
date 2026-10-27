/* Project tab (#project/<slug>): the card on Work and the project page. */
(() => {
  const { h, at, text, input, list, group, note } = F;
  const enOf = (v) => (v && typeof v === "object" ? (v.en ?? "") : (v ?? ""));

  Editors.register("project", { form(el, hash) {
    const slug = hash.slice(8), FILE = Store.caseFile(slug), b = (...k) => at(FILE, k);
    if (!Store.get(FILE)) { el.append(h("h1", { class: "ed__title" }, "Project not found"), h("p", {}, `There is no project “${slug}”.`)); return; }
    const gitem = (ib, i) => {
      const g = ib.get();
      return h("div", {},
        g.video ? F.video(ib.sub("video"), ib.sub("poster"), { label: "Video" }) : F.image(ib.sub("image"), { label: "Image" }),
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
        F.image(b("cover"), { label: "Cover on Work" }),
        input(b("hero", "bg"), { label: "Background colour", type: "color", hint: "Behind the cover and the big image while they load." })),
      group("Big image at the top",
        b("hero", "image").get() ? F.image(b("hero", "image"), { label: "Image" }) : null,
        b("hero", "video").get() ? F.video(b("hero", "video"), b("hero", "poster"), { label: "Video (plays over the image)" }) : null,
        note("Replacing these comes with uploads (a later step).")),
      group("Project overview",
        text(b("overview", "heading"), { label: "Heading" }),
        text(b("overview", "text"), { label: "Text", paragraphs: true })),
      group("Gallery",
        list(b("gallery"), { label: "Images and videos", summary: (g, i) => `${i + 1}. ${g.video ? "Video" : "Image"} · ${(g.video || g.image || "").split("/").pop()}`,
          thumb: (g) => g.video ? h("video", { class: "mini", src: F.mediaUrl(g.video), poster: g.poster ? F.mediaUrl(g.poster) : null, muted: true, preload: "none" })
            : h("img", { class: "mini", src: F.mediaUrl(g.image + "-sm.webp"), alt: "", loading: "lazy" }),
          note: "Shown in this order. Adding new images and videos comes with uploads (a later step).", item: gitem })),
      group("Search engines and sharing",
        text(b("description"), { label: "Description", big: true, hint: "Shown under the title in Google and in link previews. Usually the first sentence of the overview." })),
    );
    el.querySelectorAll(".fgroup").forEach((d, i) => { if (i > 0) d.open = false; });
  } });
})();
