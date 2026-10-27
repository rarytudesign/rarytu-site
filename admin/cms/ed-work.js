/* "Work" tab: the home page. */
(() => {
  const FILE = "content/pages/work.json", { h, at, text, select, list, group, note } = F;
  const b = (...k) => at(FILE, k);
  const name = (slug) => { const c = Store.get(Store.caseFile(slug)); return c ? (typeof c.name === "object" ? c.name.en : c.name) : slug; };

  Editors.register("work", { form(el) {
    el.append(
      h("h1", { class: "ed__title" }, "Work"),
      h("p", { class: "ed__lede" }, "The home page: intro, the order of projects and the two circles at the bottom."),
      group("Intro",
        text(b("heading"), { label: "Big heading", variants: true, hint: "On mobile, <br class=\"br-m\"> breaks the line only on phones." }),
        text(b("lede"), { label: "Text under the heading", big: true })),
      group("Selected work",
        text(b("workTitle"), { label: "Section title" }),
        text(b("workIntro"), { label: "Line under the title", variants: true }),
        list(b("projects"), { label: "Projects, in order", fixed: true, summary: (slug) => name(slug),
          note: "Use the arrows to change the order. Each project’s card text and cover are edited in its own tab. To add one, use “+ New project”.",
          item: (ib) => h("div", {}, h("p", {}, h("a", { href: "#project/" + ib.get() }, `Edit ${name(ib.get())} →`))) })),
      group("Circles at the bottom",
        list(b("callouts"), { label: "Circles", fixed: true, summary: (c) => (c.title && (c.title.en || c.title)) || "Circle",
          item: (ib) => h("div", {},
            text(ib.sub("title"), { label: "Heading" }),
            text(ib.sub("text"), { label: "Text", variants: true }),
            text(ib.sub("link"), { label: "Link text" }),
            select(ib.sub("target"), { label: "Opens", options: [["about", "About"], ["approach", "Approach"], ["work", "Work"]] })) }),
        text(b("ring", "center"), { label: "Text inside the rotating ring" }),
        note("The words running around the ring are drawn as artwork, not text. To change them, ask Claude.")),
      group("Search engines and sharing",
        text(b("title"), { label: "Page title", hint: "Shown in the browser tab and in Google results." }),
        text(b("description"), { label: "Description", big: true, hint: "Shown under the title in Google and in link previews. About 150 characters." }),
        text(b("tagline"), { label: "Line under your name (left column)", hint: "Also used on project pages." })),
    );
    el.querySelectorAll(".fgroup").forEach((d, i) => { if (i > 1) d.open = false; });
  } });
})();
