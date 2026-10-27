/* Page editors: the form on the left, the live preview on the right. Exposes window.Editors.
   Editors.open(hash, box) → true when it handled the route. Each editor is registered in EDITORS
   as { page(hash) → preview page spec, title(hash), form(el, hash) }. */
(() => {
  const EDITORS = {};
  const pageFor = (hash) => {
    if (hash.startsWith("project/")) return { key: "case", slug: hash.slice(8) };
    if (hash === "site") return { key: "work" };
    if (["work", "about", "approach"].includes(hash)) return { key: hash };
    return null;
  };
  function open(hash, box) {
    const page = pageFor(hash);
    if (!page) return false;
    const ed = EDITORS[hash.startsWith("project/") ? "project" : hash];
    box.innerHTML = `<div class="ed"><div class="ed__form" id="ed-form"></div><div class="ed__preview" id="ed-preview"></div></div>`;
    const form = box.querySelector("#ed-form");
    if (ed) ed.form(form, hash);
    else form.innerHTML = `<h1 class="ed__title">${GH.esc(document.title.replace(" · Admin", ""))}</h1><p>The fields for this page are being built. The preview on the right already shows your draft.</p>`;
    Preview.mount(box.querySelector("#ed-preview"), page);
    return true;
  }
  // rebuild the current form (after adding items from outside a list), keeping the scroll position
  function refresh() {
    const f = document.getElementById("ed-form"), y = f ? f.scrollTop : 0, wy = scrollY;
    const hash = decodeURIComponent(location.hash.slice(1)), ed = EDITORS[hash.startsWith("project/") ? "project" : hash];
    if (!f || !ed) return;
    f.innerHTML = ""; ed.form(f, hash); f.scrollTop = y; scrollTo(0, wy);
  }
  window.Editors = { open, refresh, register: (name, ed) => { EDITORS[name] = ed; }, pageFor };
})();
