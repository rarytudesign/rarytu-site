/* "About" tab. */
(() => {
  const FILE = "content/pages/about.json", { h, at, pair, text, input, list, group, note } = F;
  const b = (...k) => at(FILE, k);
  const enOf = (v) => (v && typeof v === "object" ? (v.en ?? "") : (v ?? ""));
  const rowSummary = (r) => [enOf(r.date), enOf(r.role)].filter(Boolean).join(" · ") || "New item";
  const newRow = () => ({ date: "", role: { en: "", ru: "" }, company: { en: "", ru: "" }, text: { en: [], ru: [] } });

  function rows(key, label, addLabel) {
    return list(b(key, "items"), { label, summary: rowSummary, make: newRow, addLabel,
      item: (ib) => h("div", {},
        text(ib.sub("date"), { label: "Years", hint: "e.g. 2024–2025 or 2026–Present" }),
        text(ib.sub("role"), { label: key === "experience" ? "Role" : "Title" }),
        text(ib.sub("company"), { label: key === "experience" ? "Company" : "Second line (optional)", hint: "Leave empty to hide." }),
        text(ib.sub("text"), { label: "Description", paragraphs: true }),
        ib.sub("logo").get() ? note("Has a company logo on the " + Object.keys(ib.sub("logo").get()).map((l) => l.toUpperCase()).join(" and ") + " page. Logo upload comes in a later step.") : null) });
  }

  Editors.register("about", { form(el) {
    const col = (i) => {
      const part = (k, f) => pair(FILE, (lang) => ["bio", i, lang, k, f]);
      return h("div", {},
        h("p", { class: "field__sub" }, "Desktop"),
        text(part("d", "heading"), { label: "Heading" }), text(part("d", "text"), { label: "Text", paragraphs: true }),
        h("p", { class: "field__sub" }, "Mobile and tablet"),
        text(part("mt", "heading"), { label: "Heading" }), text(part("mt", "text"), { label: "Text", paragraphs: true }));
    };
    el.append(
      h("h1", { class: "ed__title" }, "About"),
      h("p", { class: "ed__lede" }, "Your intro, photos, experience, education and tools."),
      group("Intro",
        text(b("heading"), { label: "Big heading", hint: "<br class=\"v-mt\"> breaks the line only on mobile and tablet." }),
        h("p", { class: "field__label" }, "Left column"), col(0),
        h("p", { class: "field__label" }, "Right column"), col(1)),
      group("Photos",
        list(b("photos", "items"), { label: "Photos", summary: (p, i) => enOf(p.caption) || `Photo ${i + 1}`,
          note: "Shown as a carousel. Portrait photos work best; at least 1920 px on the long side.",
          thumb: (p) => h("img", { class: "mini", src: F.mediaUrl(p.image + "-sm.webp"), alt: "", loading: "lazy" }),
          make: () => ({ image: "", caption: { en: "", ru: "" } }), addLabel: "+ Add photo",
          item: (ib) => h("div", {}, F.image(ib.sub("image"), { label: "Photo", folder: "assets/img/about" }), text(ib.sub("caption"), { label: "Caption" })) }),
        text(b("photos", "swipe"), { label: "Swipe hint (mobile)" })),
      group("Work experience",
        text(b("experience", "title"), { label: "Section title", hint: "Curly brackets are added automatically." }),
        rows("experience", "Jobs", "+ Add job")),
      group("Education",
        text(b("education", "title"), { label: "Section title" }),
        rows("education", "Education", "+ Add education")),
      group("Tools",
        text(b("tools", "title"), { label: "Section title" }),
        list(b("tools", "items"), { label: "Tools", summary: (t) => enOf(t.label) || "New tool", addLabel: "+ Add tool",
          make: () => ({ label: { en: "", ru: "" } }),
          item: (ib) => h("div", {}, text(ib.sub("label"), { label: "Name" }),
            input(ib.sub("icon"), { label: "Icon (SVG code, optional)", hint: "Paste the <svg>…</svg> code of a 24×24 icon. Without it the tool shows as text only." })) })),
      group("Search engines and sharing",
        text(b("title"), { label: "Page title" }),
        text(b("description"), { label: "Description", big: true }),
        text(b("tagline"), { label: "Line under your name (desktop left column)" }),
        text(b("menuTagline"), { label: "Line under your name (mobile menu)" })),
    );
    F.restoreGroups(el);
  } });
})();
