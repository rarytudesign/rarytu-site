/* Uploads for the editors. Exposes window.Media and replaces F.image / F.video with upload versions.
   Images become WebP in two widths, like the rest of the site: <base>-sm.webp and <base>.webp.
   Videos stay MP4; a poster is taken from the first frame. New files wait in the draft until Publish. */
(() => {
  const { h } = F;
  const WARN_MB = 25, MAX_MB = 95;
  const slugify = (s) => String(s).toLowerCase().replace(/\.[a-z0-9]+$/, "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "file";
  const tag = () => Math.random().toString(36).slice(2, 6);
  const mb = (n) => (n / 1048576).toFixed(1) + " MB";

  function pick(accept, multiple) {
    return new Promise((res) => {
      const i = h("input", { type: "file", accept, multiple: multiple || null, style: "display:none" });
      i.addEventListener("change", () => { res([...i.files]); i.remove(); });
      document.body.append(i); i.click();
    });
  }

  async function toWebp(bitmap, width, quality = 0.86) {
    const w = Math.min(width, bitmap.width), hgt = Math.round(bitmap.height * (w / bitmap.width));
    const c = document.createElement("canvas"); c.width = w; c.height = hgt;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(bitmap, 0, 0, w, hgt);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", quality));
    if (!blob) throw new Error("This browser can’t make WebP images. Try Chrome, Edge or Firefox.");
    return blob;
  }

  /* Turn an image file into the two site sizes. widths: [small, large] */
  async function image(file, folder, widths = [960, 1920]) {
    if (!/^image\//.test(file.type)) throw new Error(`${file.name} is not an image.`);
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch { throw new Error(`Can’t read ${file.name}. Save it as JPG, PNG or WebP and try again (HEIC from iPhone isn’t supported by browsers).`); }
    const base = `${folder}/${slugify(file.name)}-${tag()}`;
    const [sm, lg] = await Promise.all([toWebp(bmp, widths[0]), toWebp(bmp, widths[1])]);
    Store.addMedia(base + "-sm.webp", sm); Store.addMedia(base + ".webp", lg);
    const ar = +(bmp.width / bmp.height).toFixed(4); bmp.close && bmp.close();
    return { base, ar, small: bmp.width < widths[1] };
  }

  /* Store a video file and make its poster. */
  async function video(file, folder, prefix) {
    if (!/^video\/mp4$/.test(file.type) && !/\.mp4$/i.test(file.name))
      throw new Error(`${file.name} isn’t an MP4. Export it as MP4 (H.264), for example with HandBrake or from your editing app.`);
    if (file.size > MAX_MB * 1048576) throw new Error(`${file.name} is ${mb(file.size)}. The limit is ${MAX_MB} MB; please compress it first.`);
    const url = URL.createObjectURL(file), v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error(`Can’t play ${file.name} in the browser, so it won’t play on the site either. Export it as MP4 (H.264).`)); });
    await new Promise((res) => { v.onseeked = res; v.currentTime = Math.min(0.1, (v.duration || 1) / 2); });
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const poster = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
    const ar = +(v.videoWidth / v.videoHeight).toFixed(4), width = v.videoWidth, height = v.videoHeight;
    URL.revokeObjectURL(url);
    const name = `${folder}/${prefix ? prefix + "-" : ""}${slugify(file.name)}-${tag()}`;
    Store.addMedia(name + ".mp4", file); Store.addMedia(name + "-poster.webp", poster);
    return { video: name + ".mp4", poster: name + "-poster.webp", ar, width, height, big: file.size > WARN_MB * 1048576, size: file.size };
  }

  /* A plain file (CV and the like) kept under its own name. */
  async function file(f, folder) {
    const ext = (f.name.match(/\.[a-z0-9]+$/i) || [""])[0].toLowerCase();
    if (f.size > MAX_MB * 1048576) throw new Error(`${f.name} is ${mb(f.size)}. The limit is ${MAX_MB} MB.`);
    const path = `${folder}/${f.name.replace(/[^\w.-]+/g, "_")}`.replace(/_+(\.[a-z0-9]+)$/i, "$1") || `${folder}/file-${tag()}${ext}`;
    Store.addMedia(path, f);
    return path;
  }

  // ---------- fields with upload buttons ----------
  const busyNote = (el, msg) => { const p = el.querySelector(".field__status") || el.appendChild(h("p", { class: "field__status field__hint" })); p.textContent = msg; p.classList.remove("error"); return p; };
  const errNote = (el, e) => { const p = busyNote(el, e.message || String(e)); p.classList.add("error"); };

  /* opts: { label, hint, folder, widths, onUpload({base, ar}) } */
  F.image = function (b, opts = {}) {
    const wrap = h("div", { class: "field" });
    const draw = () => {
      const v = b.get();
      wrap.innerHTML = "";
      wrap.append(h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || "Image")));
      if (opts.hint) wrap.append(h("p", { class: "field__hint" }, opts.hint));
      wrap.append(h("div", { class: "media-row" },
        v ? h("img", { class: "thumb", src: F.mediaUrl(v + "-sm.webp"), alt: "" }) : h("div", { class: "thumb thumb--empty" }, "No image"),
        h("button", { type: "button", class: "secondary sm", onclick: async () => {
          const [f] = await pick("image/*"); if (!f) return;
          busyNote(wrap, "Preparing the image…");
          try { const r = await image(f, opts.folder || "assets/img", opts.widths); b.set(r.base); if (opts.onUpload) opts.onUpload(r); draw();
            if (r.small) busyNote(wrap, `This image is narrower than ${(opts.widths || [960, 1920])[1]} px, so it may look soft on large screens.`); }
          catch (e) { errNote(wrap, e); }
        } }, v ? "Replace image" : "Upload image")));
    };
    draw(); return wrap;
  };

  /* opts: { label, folder, prefix, onUpload(result), removable } */
  F.video = function (bv, bp, opts = {}) {
    const wrap = h("div", { class: "field" });
    const draw = () => {
      const v = bv.get(), p = bp.get();
      wrap.innerHTML = "";
      wrap.append(h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || "Video")));
      wrap.append(h("div", { class: "media-row" },
        v ? h("video", { class: "thumb", src: F.mediaUrl(v), poster: p ? F.mediaUrl(p) : null, muted: true, playsinline: true, preload: "metadata" }) : h("div", { class: "thumb thumb--empty" }, "No video"),
        h("span", { class: "media-btns" },
          h("button", { type: "button", class: "secondary sm", onclick: async () => {
            const [f] = await pick("video/mp4,.mp4"); if (!f) return;
            busyNote(wrap, "Reading the video…");
            try { const r = await video(f, opts.folder || "assets/video", opts.prefix); bv.set(r.video); bp.set(r.poster); if (opts.onUpload) opts.onUpload(r); draw();
              busyNote(wrap, r.big ? `Uploaded, ${mb(r.size)}. That’s heavy for a website: visitors on mobile data will wait. Consider compressing it below ${WARN_MB} MB.` : `Uploaded, ${mb(r.size)}.`); }
            catch (e) { errNote(wrap, e); }
          } }, v ? "Replace video" : "Upload video"),
          v && opts.removable ? h("button", { type: "button", class: "secondary sm", onclick: () => { if (confirm("Remove this video?")) { bv.set(undefined); bp.set(undefined); draw(); } } }, "Remove") : null)));
    };
    draw(); return wrap;
  };

  window.Media = { pick, image, video, file, slugify };
})();
