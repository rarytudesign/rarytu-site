/* "Approach" tab. */
(() => {
  const FILE = "content/pages/approach.json", { h, at, text, list, group, note } = F;
  const b = (...k) => at(FILE, k);
  const enOf = (v) => { const x = v && typeof v === "object" ? v.en : v; return x && typeof x === "object" ? x.d : (x ?? ""); };

  Editors.register("approach", { form(el) {
    el.append(
      h("h1", { class: "ed__title" }, "Approach"),
      h("p", { class: "ed__lede" }, "How you work: steps, principles, tools and the contact block at the bottom."),
      group("Intro",
        text(b("heading"), { label: "Big heading" }),
        text(b("intro"), { label: "Text under the heading", variants: true, big: true })),
      group("Steps",
        list(b("steps"), { label: "Steps", summary: (s) => enOf(s.title) || "New step", addLabel: "+ Add step",
          note: "Numbers { 01 }, { 02 }… follow the order automatically.",
          make: () => ({ title: { en: "", ru: "" }, text: { en: "", ru: "" } }),
          item: (ib) => h("div", {}, text(ib.sub("title"), { label: "Title" }), text(ib.sub("text"), { label: "Text", variants: true, big: true, hint: "Starts with → on the site; type it if you want it." })) })),
      group("Work in progress video",
        F.video(b("wip", "video"), b("wip", "poster"), { label: "Video", folder: "assets/video", prefix: "approach", onUpload: (r) => { b("wip", "width").set(r.width); b("wip", "height").set(r.height); } }),
        text(b("wip", "caption"), { label: "Caption" })),
      group("What matters to me",
        text(b("principles", "title"), { label: "Section title", hint: "<span class=\"v-d\">:</span> shows the colon on desktop only." }),
        list(b("principles", "items"), { label: "Principles", summary: (p) => enOf(p.title) || "New principle", addLabel: "+ Add principle",
          make: () => ({ title: { en: "", ru: "" }, text: { en: "", ru: "" } }),
          item: (ib) => h("div", {}, text(ib.sub("title"), { label: "Title", variants: true }), text(ib.sub("text"), { label: "Text", variants: true, big: true })) }),
        text(b("principles", "swipe"), { label: "Swipe hint (mobile)" })),
      group("Tools",
        text(b("tools", "title"), { label: "Heading" }),
        text(b("tools", "text"), { label: "Text", paragraphs: true, variants: true }),
        F.video(b("tools", "video"), b("tools", "poster"), { label: "Video", folder: "assets/video", prefix: "approach", onUpload: (r) => { b("tools", "width").set(r.width); b("tools", "height").set(r.height); } })),
      group("Contact block",
        text(b("contactTitle"), { label: "Heading above the round buttons (desktop)" }),
        text(b("footerTitle"), { label: "Heading above the contacts (mobile and tablet)" }),
        note("The contacts themselves are edited in the Site tab.")),
      group("Search engines and sharing",
        text(b("title"), { label: "Page title" }),
        text(b("description"), { label: "Description", big: true }),
        text(b("tagline"), { label: "Line under your name (desktop left column)" }),
        text(b("menuTagline"), { label: "Line under your name (mobile menu)" })),
    );
    F.restoreGroups(el);
  } });
})();
