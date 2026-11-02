/* Site tab: link preview image and site icons. Exposes window.Brand.group() → { preview, icons } field groups.
   Link preview: any image → JPEG up to 1200 px wide under a new name (assets/img/share-xxxx.jpg), so messengers see a new
   picture and don't reuse their old copy; size and alt text go to site.json shareImage.
   Icons: a small icon for browser tabs (SVG or PNG, square) → favicon.ico (16/32/48) and, for SVG, assets/favicon.svg;
   a phone icon (square photo or picture, 512 px or more) → apple-touch-icon.png (180), assets/icons/icon-192.png / -512.png.
   site.json icons.v changes on every upload, so browsers fetch the new icon instead of their cached one. */
(() => {
  const FILE = "content/site.json", { h } = F;
  const tag = () => Math.random().toString(36).slice(2, 6);
  const canvas = (w, hgt) => { const c = document.createElement("canvas"); c.width = w; c.height = hgt; return c; };
  const blobOf = (c, type, q) => new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error("This browser can’t save images. Try Chrome."))), type, q));

  // an image file (PNG, JPG, WebP, SVG) → something canvas can draw, with its size
  async function load(file) {
    const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
    if (!isSvg) {
      try { const b = await createImageBitmap(file); return { img: b, w: b.width, h: b.height, svg: false }; }
      catch { throw new Error(`Can’t read ${file.name}. Save it as PNG or JPG and try again.`); }
    }
    const text = await file.text(), url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch { throw new Error(`Can’t read ${file.name}: the SVG looks broken.`); }
    const vb = text.match(/viewBox="[\d.\s-]*?([\d.]+)[\s,]+([\d.]+)"/);
    const w = img.naturalWidth || (vb ? +vb[1] : 512), hh = img.naturalHeight || (vb ? +vb[2] : 512);
    return { img, w, h: hh, svg: true, text };
  }
  // square crop from the middle, drawn at size × size
  function square(src, size, bg) {
    const c = canvas(size, size), x = c.getContext("2d"), s = Math.min(src.w, src.h);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); }
    x.imageSmoothingQuality = "high";
    if (src.svg) x.drawImage(src.img, 0, 0, size, size);
    else x.drawImage(src.img, (src.w - s) / 2, (src.h - s) / 2, s, s, 0, 0, size, size);
    return c;
  }
  // .ico with PNG images inside (all current browsers read it)
  async function ico(src) {
    const pngs = [];
    for (const n of [16, 32, 48]) pngs.push({ n, bytes: new Uint8Array(await (await blobOf(square(src, n), "image/png")).arrayBuffer()) });
    const head = 6 + 16 * pngs.length, total = head + pngs.reduce((a, p) => a + p.bytes.length, 0);
    const out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint16(2, 1, true); dv.setUint16(4, pngs.length, true);
    let off = head;
    pngs.forEach((p, i) => {
      const e = 6 + 16 * i;
      out[e] = p.n; out[e + 1] = p.n; dv.setUint16(e + 4, 1, true); dv.setUint16(e + 6, 32, true);
      dv.setUint32(e + 8, p.bytes.length, true); dv.setUint32(e + 12, off, true);
      out.set(p.bytes, off); off += p.bytes.length;
    });
    return new Blob([out], { type: "image/x-icon" });
  }

  // right after Publish the site needs 1–2 minutes to show a new file: fall back to the copy on GitHub
  const fallback = (path) => function () { if (this.dataset.fb) return; this.dataset.fb = 1; this.src = `https://raw.githubusercontent.com/${GH.REPO.owner}/${GH.REPO.name}/${GH.REPO.branch}/${path}`; };
  const icons = () => Object.assign({ ico: "favicon.ico", svg: "assets/favicon.svg", touch: "apple-touch-icon.png" }, Store.get(FILE).icons || {});
  const status = (el, msg, err) => { let p = el.querySelector(".field__status"); if (!p) p = el.appendChild(h("p", { class: "field__status field__hint" }));
    p.textContent = msg; p.classList.toggle("error", !!err); };

  // ---------- link preview ----------
  function preview() {
    const wrap = h("div", { class: "field" });
    const draw = () => {
      const sh = Store.get(FILE).shareImage || {};
      wrap.innerHTML = "";
      wrap.append(h("div", { class: "field__head" }, h("span", { class: "field__label" }, "Picture")),
        h("div", { class: "media-row" },
          sh.src ? h("img", { class: "thumb", style: "width:229px;height:120px", src: F.mediaUrl(sh.src), alt: "", onerror: fallback(sh.src) }) : h("div", { class: "thumb thumb--empty" }, "None"),
          h("div", {},
            h("p", { class: "field__hint" }, sh.src ? `${sh.width} × ${sh.height} px` : "No picture: links are shared without one."),
            h("button", { type: "button", class: "secondary sm", onclick: async () => {
              const [f] = await Media.pick("image/png,image/jpeg,image/webp"); if (!f) return;
              status(wrap, "Preparing the picture…");
              try {
                const src = await load(f), w = Math.min(1200, src.w), hh = Math.round(src.h * (w / src.w));
                const c = canvas(w, hh), x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, hh);
                x.imageSmoothingQuality = "high"; x.drawImage(src.img, 0, 0, w, hh);
                const path = `assets/img/share-${tag()}.jpg`;
                Store.addMedia(path, await blobOf(c, "image/jpeg", 0.9));
                Store.update(FILE, (s) => { s.shareImage = Object.assign({ alt: { en: "", ru: "" } }, s.shareImage || {}, { src: path, width: w, height: hh }); });
                draw();
                const r = w / hh;
                if (w < 1200 || Math.abs(r - 1.905) > 0.05) status(wrap, `Saved, ${w} × ${hh}. Best is 1200 × 630: messengers crop other shapes.`);
              } catch (e) { status(wrap, e.message, true); }
            } }, "Upload new picture"))));
    };
    draw();
    return [wrap,
      F.text(F.at(FILE, ["shareImage", "alt"]), { label: "Description of the picture", hint: "Read aloud by screen readers when the link is shared." }),
      F.note("Shown when a link to the site is sent in Telegram, WhatsApp, iMessage, LinkedIn and others. Best size: 1200 × 630 px. " +
        "The title and text under it come from each page's title and description. Messengers keep an old preview for a while; in Telegram you can refresh it by sending the link to @WebpageBot.")];
  }

  // ---------- icons ----------
  function iconField(kind) {
    const wrap = h("div", { class: "field" });
    const small = kind === "small";
    const draw = () => {
      const ic = icons(), shown = small ? (ic.svg || ic.ico) : ic.touch;
      wrap.innerHTML = "";
      wrap.append(h("div", { class: "field__head" }, h("span", { class: "field__label" }, small ? "Browser tab icon" : "Phone home screen icon")),
        h("div", { class: "media-row" },
          h("img", { class: "thumb", style: small ? "width:48px;height:48px;object-fit:contain;background:#fff" : "width:90px;height:90px;border-radius:20px", src: (() => { const u = F.mediaUrl(shown); return u.startsWith("blob:") ? u : u + "?t=" + (ic.v || ""); })(), alt: "", onerror: fallback(shown) }),
          h("div", {},
            h("p", { class: "field__hint" }, small ? "SVG or PNG, square. Tiny in a tab: a simple shape reads best." : "Square picture, 512 × 512 px or larger. Phones round the corners themselves."),
            h("button", { type: "button", class: "secondary sm", onclick: async () => {
              const [f] = await Media.pick(small ? "image/svg+xml,.svg,image/png" : "image/png,image/jpeg,image/webp"); if (!f) return;
              status(wrap, "Making the icon files…");
              try {
                const src = await load(f), v = tag();
                if (Math.abs(src.w - src.h) > 2) status(wrap, "Not square: the middle part is used.");
                if (small) {
                  Store.addMedia("favicon.ico", await ico(src));
                  if (src.svg) Store.addMedia("assets/favicon.svg", new Blob([src.text], { type: "image/svg+xml" }));
                  Store.update(FILE, (s) => { s.icons = Object.assign({}, s.icons || {}, { ico: "favicon.ico", svg: src.svg ? "assets/favicon.svg" : "", v }); });
                } else {
                  if (Math.min(src.w, src.h) < 180) throw new Error("Too small: the picture needs to be at least 180 × 180 px (512 is best).");
                  Store.addMedia("apple-touch-icon.png", await blobOf(square(src, 180, "#ffffff"), "image/png"));
                  Store.addMedia("assets/icons/icon-192.png", await blobOf(square(src, 192, "#ffffff"), "image/png"));
                  Store.addMedia("assets/icons/icon-512.png", await blobOf(square(src, 512, "#ffffff"), "image/png"));
                  Store.update(FILE, (s) => { s.icons = Object.assign({}, s.icons || {}, { touch: "apple-touch-icon.png", v }); });
                }
                draw();
              } catch (e) { status(wrap, e.message, true); }
            } }, "Upload new icon"))));
    };
    draw();
    return wrap;
  }

  window.Brand = {
    preview: () => F.group("Link preview", ...preview()),
    icons: () => F.group("Site icon", iconField("small"), iconField("phone"),
      F.note("Browsers keep an old icon for a while; after Publish it can take a day to change in a tab you already had open.")),
    ico,   // for tests
  };
})();
