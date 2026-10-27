/* "+ New project" tab and hide / show / delete for projects. */
(() => {
  const { h, text, input, note } = F;
  const WORK = "content/pages/work.json";
  const allSlugs = () => { const w = Store.get(WORK); return (w.projects || []).concat(w.hidden || []); };
  const validSlug = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

  // "+ New project" is a small form that keeps its values outside the draft until "Create"
  Editors.register("new-project", { page: null, form(el) {
    const v = { name: { en: "", ru: "" }, title: { en: "", ru: "" }, slug: "", bg: "#f6f6f6", slugTouched: false };
    const box = (key) => ({ get: () => v[key], set: (x) => { v[key] = x; if (key === "name" && !v.slugTouched) { v.slug = Media.slugify(typeof x === "string" ? x : x.en || x.ru || ""); slugIn.value = v.slug; check(); } } });
    const slugIn = h("input", { class: "finput", placeholder: "e.g. lumo" });
    const err = h("p", { class: "field__err error", hidden: true });
    const check = () => {
      const s = v.slug, bad = !s ? "Type a name first." : !validSlug(s) ? "Use lowercase latin letters, numbers and dashes." : allSlugs().includes(s) ? "There is already a project with this address." : "";
      err.hidden = !bad; err.textContent = bad; create.disabled = !!bad; return !bad;
    };
    slugIn.addEventListener("input", () => { v.slug = slugIn.value.trim(); v.slugTouched = true; check(); });
    const create = h("button", { type: "button", class: "primary", onclick: () => {
      if (!check()) return;
      const first = allSlugs().map((s) => Store.get(Store.caseFile(s))).find(Boolean);
      const en = (x) => typeof x === "string" ? x : x.en, ru = (x) => typeof x === "string" ? x : x.ru;
      Store.set(Store.caseFile(v.slug), {
        slug: v.slug, name: F.compact(en(v.name), ru(v.name) || en(v.name)), title: F.compact(en(v.title) || en(v.name), ru(v.title) || ru(v.name) || en(v.name)),
        tags: { en: "", ru: "" }, description: { en: "", ru: "" },
        overview: { heading: first ? first.overview.heading : { en: "Project overview", ru: "О проекте" }, text: { en: [], ru: [] } },
        hero: { bg: v.bg }, cover: "", gallery: [] });
      Store.update(WORK, (w) => { w.projects = [v.slug].concat(w.projects || []); });
      location.hash = "#project/" + v.slug;
    } }, "Create project");
    el.append(
      h("h1", { class: "ed__title" }, "New project"),
      h("p", { class: "ed__lede" }, "Start with a name. Next you’ll add the cover, texts and images in the project’s own tab. Nothing goes live until you press Publish."),
      text(box("name"), { label: "Short name", hint: "e.g. Lumo. Used in links between projects." }),
      text(box("title"), { label: "Title", hint: "e.g. Lumo / Gadget marketplace. Leave empty to use the short name." }),
      h("div", { class: "field" }, h("div", { class: "field__head" }, h("span", { class: "field__label" }, "Page address")),
        h("p", { class: "field__hint" }, "The project will live at …/work/<address>/. Can’t be changed later without breaking old links."),
        h("div", { class: "field__row" }, h("span", { class: "small", style: "margin-top:9px" }, "/work/"), slugIn), err),
      input({ get: () => v.bg, set: (x) => { v.bg = x; } }, { label: "Background colour", type: "color", hint: "Behind the cover while it loads. You can change it later." }),
      h("div", { class: "row" }, create),
      note("New projects appear first on the Work page. Change the order in the Work tab."));
    check();
  } });

  // project actions shown at the bottom of a project tab
  window.ProjectActions = function (slug) {
    const w = Store.get(WORK), hidden = (w.hidden || []).includes(slug);
    const hide = () => Store.update(WORK, (x) => { x.projects = x.projects.filter((s) => s !== slug); x.hidden = (x.hidden || []).filter((s) => s !== slug).concat([slug]); });
    const show = () => Store.update(WORK, (x) => { x.hidden = (x.hidden || []).filter((s) => s !== slug); x.projects = (x.projects || []).concat([slug]); if (!x.hidden.length) delete x.hidden; });
    const del = () => {
      if (!confirm("Delete this project? Its page disappears from the site when you publish. Older versions stay in Site backups.")) return;
      Store.update(WORK, (x) => { x.projects = x.projects.filter((s) => s !== slug); x.hidden = (x.hidden || []).filter((s) => s !== slug); if (!x.hidden.length) delete x.hidden; });
      Store.set(Store.caseFile(slug), null);
      location.hash = "#work";
    };
    return F.group("Hide or delete",
      note(hidden ? "This project is hidden: it isn’t on the Work page and its page is taken off the site when you publish." :
        "Hiding takes the project off the Work page and removes its page from the site when you publish. You can show it again any time."),
      h("div", { class: "row" },
        hidden ? h("button", { type: "button", class: "secondary sm", onclick: () => { show(); Editors.refresh(); } }, "Show on the site again")
               : h("button", { type: "button", class: "secondary sm", onclick: () => { hide(); Editors.refresh(); } }, "Hide from the site"),
        h("button", { type: "button", class: "secondary sm danger", onclick: del }, "Delete project")));
  };
})();
