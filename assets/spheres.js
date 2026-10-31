/* Spheres on the last screen ("Let's work together"). Port of Nastya's fluid-sim v8.6 (p5 tuning tool), without p5.
   Each sphere pushes its neighbours away (soft SPH-like pressure), and a hard rule keeps every pair at least
   "size + gap" apart, so spheres never touch. The pointer pushes spheres out of a circle around it; each sphere
   gets a slightly different push, so they scatter like grains instead of flying off in lumps.

   All sizes are tuned for a reference box (the last screen of a 1440×900 desktop: 1072×900 next to the sidebar)
   and scale with the box area, so phones, tablets and big monitors show the same picture with about the same
   number of spheres. create(o: { width, height, level }) → { N, x, y, R, step(pointer) }.
   Exposes window.RarytuSpheres (and module.exports for tests). */
(function (root) {
  const TUNE = {
    refW: 1072, refH: 900, scaleMin: 0.75, scaleMax: 2,   // reference box, limits of the scale
    phoneSize: 22, phoneMax: 743,                         // phones (box up to 743px wide): fixed sphere size, px
    size: 24, gap: 2, spacing: 26,             // px at scale 1
    reach: 36, push: 1.5,                                  // pressure reach (px) and strength
    gravity: 0.2, maxSpeed: 16, damping: 0.98,            // px/frame², px/frame, per frame
    wallDamp: 0.6, wallStiff: 0.15,
    iterations: 24, bounce: 0.6,                          // non-overlap passes, restitution on contact
    pointerRadius: 5.5, pointerStrength: 0.05, scatter: 1
  };

  function create(o) {
    const W = o.width, H = o.height, T = Object.assign({}, TUNE, o.tune || {});
    const s = W <= T.phoneMax ? T.phoneSize / T.size
      : Math.min(T.scaleMax, Math.max(T.scaleMin, Math.sqrt((W * H) / (T.refW * T.refH))));
    const SIZE = T.size * s, R = SIZE / 2, MIN = Math.max(T.spacing * s, SIZE + T.gap * s), MIN2 = MIN * MIN;
    const REACH = T.reach * s, REACH2 = REACH * REACH, PUSH = T.push * s;
    const G = T.gravity * s, VMAX = T.maxSpeed * s, VMAX2 = VMAX * VMAX;
    // Walls and floor sit outside the screen (about two rows out), so the screen edge cuts through the pile
    // at random places: no straight row along the bottom, no column along the sides, no visible container.
    const OUT = Math.round(MIN * 1.8), XL = -OUT, XR = W + OUT, YB = H + OUT, YT = R;
    const PR = Math.max(REACH, T.spacing * s) * T.pointerRadius;

    // ---------- at rest: hexagonal rows at MIN from the floor up to the water level ----------
    const level = o.level != null ? o.level : H * 0.6;
    const block = o.block || null;   // { l, t, r, b }: the title and the buttons, solid
    // Random positions (no honeycomb rows at rest, so the edges look loose, not like a container), then pushed
    // apart to the gap by settle() below. A random pile is looser than a honeycomb; after settling under gravity
    // (main.js runs a short warm-up) it ends up close to the water level.
    const pts = [], area = (XR - XL) * (YB - level), count = Math.max(1, Math.floor(area / (MIN * MIN * 0.866) * 0.93));
    for (let k = 0; k < count; k++) pts.push(XL + Math.random() * (XR - XL), level + Math.random() * (YB - level));
    const N = pts.length / 2;
    const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
    const inside = new Uint8Array(N), rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) { x[i] = pts[2 * i]; y[i] = pts[2 * i + 1]; rnd[i] = Math.random() * 2 - 1; }

    // spatial grid; cell = the longest distance any rule looks at, so the 3×3 cells around a sphere hold all its neighbours
    const CUT = Math.max(REACH, MIN * 1.4), CUT2 = CUT * CUT;
    const CS = CUT, GW = Math.floor((XR - XL + 2 * OUT) / CS) + 1, GH = Math.floor((YB + 2 * OUT) / CS) + 1;
    const head = new Int32Array(GW * GH), next = new Int32Array(N);
    let pa = new Int32Array(N * 8), pb = new Int32Array(N * 8), np = 0;
    const nb = new Uint16Array(N), lx = new Float32Array(N), ly = new Float32Array(N);

    // one pass: every pair closer than CUT goes into (pa, pb)
    function pairs() {
      head.fill(-1);
      for (let i = 0; i < N; i++) {
        let cx = Math.floor((x[i] - XL + OUT) / CS), cy = Math.floor((y[i] + OUT) / CS);
        cx = cx < 0 ? 0 : cx >= GW ? GW - 1 : cx; cy = cy < 0 ? 0 : cy >= GH ? GH - 1 : cy;
        const k = cy * GW + cx; next[i] = head[k]; head[k] = i;
      }
      np = 0;
      for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
        for (let i = head[cy * GW + cx]; i !== -1; i = next[i]) {
          const xi = x[i], yi = y[i];
          // this cell (pairs after i) and four neighbour cells (right, below-left, below, below-right): each pair once
          for (let j = next[i]; j !== -1; j = next[j]) add(i, j, xi, yi);
          if (cx + 1 < GW) for (let j = head[cy * GW + cx + 1]; j !== -1; j = next[j]) add(i, j, xi, yi);
          if (cy + 1 < GH) {
            const row = (cy + 1) * GW;
            if (cx > 0) for (let j = head[row + cx - 1]; j !== -1; j = next[j]) add(i, j, xi, yi);
            for (let j = head[row + cx]; j !== -1; j = next[j]) add(i, j, xi, yi);
            if (cx + 1 < GW) for (let j = head[row + cx + 1]; j !== -1; j = next[j]) add(i, j, xi, yi);
          }
        }
      }
    }
    function add(i, j, xi, yi) {
      const dx = xi - x[j], dyy = yi - y[j];
      if (dx * dx + dyy * dyy >= CUT2) return;
      if (np >= pa.length) { const g = new Int32Array(pa.length * 2); g.set(pa); pa = g; const h = new Int32Array(pb.length * 2); h.set(pb); pb = h; }
      pa[np] = i; pb[np] = j; np++;
    }

    // soft walls, as in Nastya's tool: they take speed out and push back, the non-overlap rule always wins
    function walls(i) {
      let d = x[i] - XR;
      if (d > 0) { vx[i] *= T.wallDamp; vx[i] -= d * T.wallStiff; }
      d = x[i] - XL;
      if (d < 0) { vx[i] *= T.wallDamp; vx[i] -= d * T.wallStiff; }
      d = y[i] - YB;
      if (d > 0) { vy[i] *= T.wallDamp; vy[i] -= d * T.wallStiff; }
      d = y[i] - YT;
      if (d < 0) { vy[i] *= T.wallDamp; vy[i] -= d * T.wallStiff; }
    }

    // solid: the title block (and a far safety limit). Runs inside every non-overlap pass, so a sphere
    // pushed against the block pushes its neighbours back instead of overlapping them.
    function solid() {
      for (let i = 0; i < N; i++) {
        // walls are soft (walls()) and lie off screen; this is only a far safety limit
        if (x[i] < XL - OUT) { x[i] = XL - OUT; vx[i] = 0; } else if (x[i] > XR + OUT) { x[i] = XR + OUT; vx[i] = 0; }
        if (y[i] > YB + OUT) { y[i] = YB + OUT; vy[i] = 0; } else if (y[i] < YT - OUT) { y[i] = YT - OUT; vy[i] = 0; }
        if (block) {
          const l = block.l - R, r = block.r + R, t = block.t - R, b = block.b + R;
          if (x[i] > l && x[i] < r && y[i] > t && y[i] < b) {
            const dl = x[i] - l, dr = r - x[i], dt = y[i] - t, db = b - y[i], m = Math.min(dl, dr, dt, db);
            // on top a sphere slides off towards the nearer side, so none stays lying on the title
            if (m === dt) { y[i] = t; if (vy[i] > 0) vy[i] = 0; vx[i] += dl < dr ? -0.3 * s : 0.3 * s; }
            else if (m === db) { y[i] = b; if (vy[i] < 0) vy[i] = 0; }
            else if (m === dl) { x[i] = l; if (vx[i] > 0) vx[i] = 0; }
            else { x[i] = r; if (vx[i] < 0) vx[i] = 0; }
          }
        }
      }
    }

    /* One frame. pointer: { x, y } in the box's px, or null (not over the water / finger lifted).
       Returns the mean squared speed. */
    function step(pointer) {
      const scatter = T.scatter, PR2 = PR * PR;
      // move, gravity, pointer
      for (let i = 0; i < N; i++) {
        x[i] += vx[i]; y[i] += vy[i]; vy[i] += G;
        if (pointer) {
          const dx = x[i] - pointer.x, dyy = y[i] - pointer.y;
          if (dx * dx + dyy * dyy < PR2) {
            const ax = Math.abs(dx), ay = Math.abs(dyy), dist = Math.max(ax, ay) + 0.4 * Math.min(ax, ay);
            if (dist > 0.0001 && dist < PR) {
              const f = (PR - dist) * T.pointerStrength * (1 + rnd[i] * scatter);
              const a = rnd[i] * scatter * 0.6, ca = Math.cos(a), sa = Math.sin(a), nx = dx / dist, ny = dyy / dist;
              vx[i] += (nx * ca - ny * sa) * f; vy[i] += (nx * sa + ny * ca) * f;
            }
          }
        }
      }
      pairs();
      // pressure: spheres inside the body push their neighbours; spheres on the surface don't (no lumps sticking).
      // "Inside" = neighbours on all sides (the same test as in the tuning tool).
      nb.fill(0); lx.fill(0); ly.fill(0);
      for (let p = 0; p < np; p++) {
        const i = pa[p], j = pb[p], dx = x[i] - x[j], dyy = y[i] - y[j];
        if (dx * dx + dyy * dyy >= REACH2) continue;
        nb[i]++; nb[j]++;
        const sx = dx > 0 ? 1.1 : dx < 0 ? -1.1 : 0, sy = dyy > 0 ? 1.1 : dyy < 0 ? -1.1 : 0;
        lx[i] += sx; ly[i] += sy; lx[j] -= sx; ly[j] -= sy;
      }
      for (let i = 0; i < N; i++) inside[i] = (Math.abs(lx[i]) > nb[i] - 6 || Math.abs(ly[i]) > nb[i] - 6) ? 0 : 1;
      for (let p = 0; p < np; p++) {
        const i = pa[p], j = pb[p], k = inside[i] + inside[j];
        if (!k) continue;
        const dx = x[i] - x[j], dyy = y[i] - y[j], d2 = dx * dx + dyy * dyy;
        if (d2 >= REACH2 || d2 < 0.01) continue;
        const ax = Math.abs(dx), ay = Math.abs(dyy), D = Math.max(ax, ay) + 0.4 * Math.min(ax, ay);
        if (D <= 0.001) continue;
        const q = D / REACH, p1 = 1 - q, f = p1 * p1 * (1 + 2 * q) * 0.5 * PUSH * k;
        const fx = (dx / D) * f, fy = (dyy / D) * f;
        vx[i] += fx; vy[i] += fy; vx[j] -= fx; vy[j] -= fy;
      }
      for (let i = 0; i < N; i++) walls(i);
      // damping and speed limit
      for (let i = 0; i < N; i++) {
        vx[i] *= T.damping; vy[i] *= T.damping;
        const v2 = vx[i] * vx[i] + vy[i] * vy[i];
        if (v2 > VMAX2) { const k = VMAX / Math.sqrt(v2); vx[i] *= k; vy[i] *= k; }
      }
      // hard rule: centres never closer than MIN; the closing speed is taken out (with a little bounce).
      // Uses the same pair list (CUT has a margin over MIN for the small moves within one frame).
      const B = T.bounce;
      solid();
      for (let it = 0; it < T.iterations; it++) {
        let moved = false;
        for (let p = 0; p < np; p++) {
          const i = pa[p], j = pb[p];
          let dx = x[i] - x[j], dyy = y[i] - y[j], d2 = dx * dx + dyy * dyy;
          if (d2 >= MIN2) continue;
          if (d2 < 1e-9) { dx = (Math.random() - 0.5) * 0.01; dyy = (Math.random() - 0.5) * 0.01; d2 = dx * dx + dyy * dyy; }
          const d = Math.sqrt(d2), nx = dx / d, ny = dyy / d, h = (MIN - d) * 0.5;
          x[i] += nx * h; y[i] += ny * h; x[j] -= nx * h; y[j] -= ny * h; moved = true;
          const vn = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
          if (vn < 0) { const k = vn * 0.5 * (1 + B); vx[i] -= nx * k; vy[i] -= ny * k; vx[j] += nx * k; vy[j] += ny * k; }
        }
        solid();
        if (!moved) break;
      }
      let e = 0;
      for (let i = 0; i < N; i++) e += vx[i] * vx[i] + vy[i] * vy[i];
      return e / Math.max(1, N);
    }

    // Push the random start positions apart to the gap, without any motion.
    // Preparing the pile at rest, in small time slices so the page never stalls (main.js calls it when the
    // browser is idle): 1) push the random start positions apart to the gap, without motion; 2) let the pile
    // settle under gravity for 150 frames. Returns true when done.
    let settleIt = 0, warmLeft = 150;
    function prepare(ms) {
      const until = performance.now() + ms;
      while (settleIt >= 0 && performance.now() < until) {
        if (settleIt % 10 === 0) pairs();
        let worst = 0;
        for (let p = 0; p < np; p++) {
          const i = pa[p], j = pb[p];
          let dx = x[i] - x[j], dyy = y[i] - y[j], d2 = dx * dx + dyy * dyy;
          if (d2 >= MIN2) continue;
          if (d2 < 1e-9) { dx = Math.random() - 0.5; dyy = Math.random() - 0.5; d2 = dx * dx + dyy * dyy; }
          const d = Math.sqrt(d2), h = (MIN - d) * 0.5, nx = dx / d, ny = dyy / d;
          if (h > worst) worst = h;
          x[i] += nx * h; y[i] += ny * h; x[j] -= nx * h; y[j] -= ny * h;
        }
        // keep the pile in its box (sides and floor off screen)
        for (let i = 0; i < N; i++) {
          if (x[i] < XL) x[i] = XL; else if (x[i] > XR) x[i] = XR;
          if (y[i] > YB) y[i] = YB;
        }
        solid();
        settleIt++;
        if (worst < 0.01 * s || settleIt >= 300) settleIt = -1;
      }
      while (settleIt < 0 && warmLeft > 0 && performance.now() < until) { step(null); warmLeft--; }
      return settleIt < 0 && warmLeft <= 0;
    }

    return { N, x, y, R, scale: s, step, prepare, ready: () => settleIt < 0 && warmLeft <= 0 };

  }
  const api = { create, TUNE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RarytuSpheres = api;
})(typeof window !== "undefined" ? window : this);
