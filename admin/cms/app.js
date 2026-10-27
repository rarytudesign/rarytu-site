/* Admin panel shell: tabs and routing (#site, #work, #about, #approach, #project/<slug>, #new-project, #backups). */
(() => {
  const $ = (id) => document.getElementById(id);
  const TITLES = { site: "Site", work: "Work", about: "About", approach: "Approach", "new-project": "New project" };
  let projects = [];

  async function loadProjects() {
    // until the content store is in place (step B3) the list comes from the published site
    try {
      const work = await (await fetch("../content/pages/work.json", { cache: "no-store" })).json();
      const names = await Promise.all(work.projects.map(async (slug) => {
        try { const c = await (await fetch(`../content/cases/${slug}.json`, { cache: "no-store" })).json(); return [slug, c.name.en || c.name]; }
        catch { return [slug, slug]; }
      }));
      projects = names;
    } catch { projects = []; }
    $("tabs-projects").innerHTML = projects.map(([slug, name]) => `<a href="#project/${slug}">${GH.esc(name)}</a>`).join("");
    route();
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1)) || "backups";
    document.querySelectorAll("#tabs a").forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + hash));
    document.querySelectorAll("#tabs a[aria-current]").forEach((a) => a.setAttribute("aria-current", "page"));
    const isBackups = hash === "backups";
    $("view-backups").hidden = !isBackups;
    $("view-editor").hidden = isBackups;
    if (isBackups) { Backups.open(); document.title = "Site backups · Admin"; return; }
    const title = hash.startsWith("project/") ? ((projects.find(([s]) => s === hash.slice(8)) || [])[1] || hash.slice(8)) : (TITLES[hash] || hash);
    $("editor-title").textContent = title;
    document.title = title + " · Admin";
  }

  addEventListener("hashchange", route);
  loadProjects();
})();
