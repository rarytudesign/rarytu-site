/* "Site" tab: things shared by every page. */
(() => {
  const FILE = "content/site.json", { h, at, text, input, list, group, note } = F;
  const b = (...k) => at(FILE, k);
  const contactName = (c) => (c && (c.label || c.url)) || "New contact";

  Editors.register("site", { form(el) {
    const ui = (k, label, hint) => text({ get: () => { const s = Store.get(FILE).ui; return { en: s.en[k], ru: s.ru[k] }; },
      set: (v) => Store.update(FILE, (s) => { const en = typeof v === "string" ? v : v.en, ru = typeof v === "string" ? v : v.ru; s.ui.en[k] = en; s.ui.ru[k] = ru; }) }, { label, hint });
    const navUi = (k, label) => text({ get: () => { const s = Store.get(FILE).ui; return { en: s.en.nav[k], ru: s.ru.nav[k] }; },
      set: (v) => Store.update(FILE, (s) => { s.ui.en.nav[k] = typeof v === "string" ? v : v.en; s.ui.ru.nav[k] = typeof v === "string" ? v : v.ru; }) }, { label });

    const cv = (lang, label) => {
      const wrap = h("div", { class: "field" });
      const draw = () => { const path = Store.get(FILE).cv[lang]; wrap.innerHTML = "";
        wrap.append(h("div", { class: "field__head" }, h("span", { class: "field__label" }, label)),
          h("div", { class: "media-row" }, h("a", { href: F.mediaUrl(path), target: "_blank", rel: "noopener" }, path.split("/").pop()),
            h("button", { type: "button", class: "secondary sm", onclick: async () => {
              const [f] = await Media.pick("application/pdf,.pdf"); if (!f) return;
              try { const p = await Media.file(f, "assets/cv"); Store.update(FILE, (s) => { s.cv[lang] = p; }); draw(); }
              catch (e) { alert(e.message); }
            } }, "Upload new PDF"))); };
      draw(); return wrap;
    };
    el.append(
      h("h1", { class: "ed__title" }, "Site"),
      h("p", { class: "ed__lede" }, "Things every page shares: your name, contacts, CV and the small interface texts."),
      group("Name and copyright",
        input(b("name"), { label: "Name", hint: "Shown at the top of every page." }),
        input(b("copyright"), { label: "Copyright line", placeholder: "©{year}", hint: "{year} becomes the current year and changes by itself every January." })),
      group("Contacts",
        list(b("contacts"), {
          label: "Contacts", note: "One list for the whole site: the footer of every page and the round buttons on Approach, in this order. Up to 10.",
          summary: contactName, addLabel: "+ Add contact", maxItems: 10,
          make: () => ({ id: "c" + Date.now().toString(36), label: "", url: "https://", iconLabel: { en: "", ru: "" } }),
          item: (ib) => {
            const isMail = () => /^mailto:/.test(ib.sub("url").get() || "");
            return h("div", {},
              input(ib.sub("label"), { label: "Text", hint: "What visitors see, e.g. Telegram or your email address." }),
              input(ib.sub("url"), { label: "Link", type: "url", hint: "https://… for a website, mailto:you@example.com for email." }),
              text(ib.sub("iconLabel"), { label: "Name for screen readers", hint: "Read aloud for the round button on Approach. Usually the network name." }),
              h("label", { class: "field__toggle" }, (() => { const c = h("input", { type: "checkbox" }); c.checked = !!ib.sub("copy").get();
                c.addEventListener("change", () => ib.sub("copy").set(c.checked ? (ib.sub("url").get() || "").replace(/^mailto:/, "") : undefined)); return c; })(),
                " Clicking copies the email address (for email links)"),
              ib.sub("icon").get() ? note("Has its own icon on Approach.") : note("No icon yet: Approach shows a plain round button with an arrow."));
          } })),
      group("CV files", cv("en", "English CV"), cv("ru", "Russian CV")),
      group("Menu",
        navUi("work", "Work page"), navUi("about", "About page"), navUi("approach", "Approach page"),
        ui("contact", "Contact link"), ui("downloadCV", "Download CV link")),
      group("Small texts",
        ui("footerTitle", "Footer heading", "Big line above the contacts at the bottom of Work and About."),
        ui("backToTop", "Back to top"), ui("allWork", "Back link on project pages"), ui("moreProjects", "Name of the next/previous project links", "Read aloud by screen readers."),
        ui("copied", "Message after copying the email"), ui("skip", "Skip link", "For keyboard users, appears on Tab."),
        ui("menu", "Menu button name", "Read aloud by screen readers."), ui("closeMenu", "Close menu button name")),
    );
    F.restoreGroups(el);
  } });
})();
