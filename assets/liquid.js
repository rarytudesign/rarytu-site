/* Liquid made of small spheres for the last screen ("Let's work together").
   A particle fluid (double density relaxation, Clavet et al. 2005): every sphere keeps a soft distance from its
   neighbours, so the body behaves like water: it levels out, flows, splashes and falls back under gravity.
   The title and buttons are a solid block the water flows around. Exposes window.RarytuLiquid (and module.exports for tests). */
(function (root) {
  function create(o) {
    const W = o.width, H = o.height;
    const R = o.radius || 4;                 // sphere radius (8px spheres)
    const S = o.spacing || 12;               // rest distance between sphere centres
    const h = S * 2;                         // reach of the pressure between spheres
    const SUB = o.substeps || 3;            // smaller time steps keep the water stiff without blowing up
    const G = (o.gravity != null ? o.gravity : 0.5) / (SUB * SUB);   // gravity in px per frame², per sub-step
    const K = o.k != null ? o.k : 1.2, KN = o.kNear != null ? o.kNear : 4;
    const MAXV = (o.maxSpeed || 28) / SUB;
    const DAMP = o.damping != null ? o.damping : 0.997;
    // rest density of the hexagonal packing the water starts in (6 neighbours at S, 6 at S·√3)
    const q1 = 1 - S / h, q2 = 1 - (S * Math.sqrt(3)) / h;
    const RHO0 = 6 * q1 * q1 + 6 * Math.max(0, q2) * Math.max(0, q2);

    // ---------- the water at rest: hexagonal rows below the surface line ----------
    // the walls and the floor sit just outside the canvas, so the edge rows are cut like the layout, not lined up on view
    const XL = -S, XR = W + S, YB = H + S * 0.6;
    const pts = [], dy = (S * Math.sqrt(3)) / 2;
    const cols = Math.floor((XR - XL - 2 * R) / S), x0 = XL + (XR - XL - cols * S) / 2;
    for (let j = 0, yy = YB - R - 0.5; yy > 0; j++, yy -= dy) {
      const off = j % 2 ? S / 2 : 0, n = j % 2 ? cols - 1 : cols;
      let any = false;
      for (let k = 0; k <= n; k++) {
        const xx = x0 + off + k * S;
        if (yy >= o.surface(xx)) { pts.push(xx, yy); any = true; }
      }
      if (!any) break;
    }
    const N = pts.length / 2;
    const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
    const rho = new Float32Array(N), rhoN = new Float32Array(N);
    for (let i = 0; i < N; i++) { px[i] = x[i] = pts[2 * i]; py[i] = y[i] = pts[2 * i + 1]; }

    // spatial grid (cell = reach), rows above the screen for splashes
    const TOP = 600, OFF = 2 * S, gw = Math.ceil((W + 2 * OFF) / h) + 2, gh = Math.ceil((H + OFF + TOP) / h) + 2;
    const head = new Int32Array(gw * gh), next = new Int32Array(N);
    let pairI = new Int32Array(N * 10), pairJ = new Int32Array(N * 10), pairQ = new Float32Array(N * 10),
      pairX = new Float32Array(N * 10), pairY = new Float32Array(N * 10), np = 0;
    const cellX = (v) => Math.min(gw - 1, Math.max(0, (((v + OFF) / h) | 0) + 1));
    const cellY = (v) => Math.min(gh - 1, Math.max(0, (((v + TOP) / h) | 0) + 1));

    let block = null;   // { l, t, r, b } the title and buttons, in the canvas' coordinates

    function grow() {
      const n = pairI.length * 2, g = (A, T) => { const b = new T(n); b.set(A); return b; };
      pairI = g(pairI, Int32Array); pairJ = g(pairJ, Int32Array); pairQ = g(pairQ, Float32Array);
      pairX = g(pairX, Float32Array); pairY = g(pairY, Float32Array);
    }

    function relax() {
      head.fill(-1);
      for (let i = 0; i < N; i++) { const k = cellY(y[i]) * gw + cellX(x[i]); next[i] = head[k]; head[k] = i; }
      rho.fill(0); rhoN.fill(0); np = 0;
      const h2 = h * h;
      for (let i = 0; i < N; i++) {
        const cx = cellX(x[i]), cy = cellY(y[i]);
        for (let oy = -1; oy <= 1; oy++) {
          const Y = cy + oy; if (Y < 0 || Y >= gh) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const X = cx + ox; if (X < 0 || X >= gw) continue;
            for (let j = head[Y * gw + X]; j !== -1; j = next[j]) {
              if (j <= i) continue;
              const dx = x[j] - x[i], dyy = y[j] - y[i], d2 = dx * dx + dyy * dyy;
              if (d2 >= h2) continue;
              const d = Math.sqrt(d2) || 0.001, q = 1 - d / h, q2 = q * q, q3 = q2 * q;
              rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
              if (np >= pairI.length) grow();
              pairI[np] = i; pairJ[np] = j; pairQ[np] = q; pairX[np] = dx / d; pairY[np] = dyy / d; np++;
            }
          }
        }
      }
      for (let p = 0; p < np; p++) {
        const i = pairI[p], j = pairJ[p], q = pairQ[p];
        const P = K * ((rho[i] + rho[j]) * 0.5 - RHO0), PN = KN * (rhoN[i] + rhoN[j]) * 0.5;
        const D = (P * q + PN * q * q) * 0.5;
        const ddx = pairX[p] * D, ddy = pairY[p] * D;
        x[i] -= ddx; y[i] -= ddy; x[j] += ddx; y[j] += ddy;
      }
    }

    function bounds() {
      const L = XL + R, Rt = XR - R, B = YB - R;
      for (let i = 0; i < N; i++) {
        if (x[i] < L) { x[i] = L; px[i] = L + (L - px[i]) * 0.3; } else if (x[i] > Rt) { x[i] = Rt; px[i] = Rt + (Rt - px[i]) * 0.3; }
        if (y[i] > B) { y[i] = B; py[i] = B + (B - py[i]) * 0.2; px[i] += (x[i] - px[i]) * 0.05; }
        if (block) {
          const l = block.l - R, r = block.r + R, t = block.t - R, b = block.b + R;
          if (x[i] > l && x[i] < r && y[i] > t && y[i] < b) {
            // out through the nearest side, losing the speed into the block
            const dl = x[i] - l, dr = r - x[i], dt = y[i] - t, db = b - y[i], m = Math.min(dl, dr, dt, db);
            // on top of the block a drop slides off towards the nearer side, so no water stays lying on the title
            if (m === dt) { y[i] = t; py[i] = Math.max(py[i], t - 1); px[i] += (dl < dr ? 0.25 : -0.25); }
            else if (m === db) { y[i] = b; py[i] = Math.min(py[i], b); }
            else if (m === dl) { x[i] = l; px[i] = Math.max(px[i], l); }
            else { x[i] = r; px[i] = Math.min(px[i], r); }
          }
        }
      }
    }

    /* One frame. pointer: { x, y, vx, vy } in px per frame, or null. Returns the mean squared speed (to know when it's calm). */
    function step(pointer) {
      const PR = 80, PR2 = PR * PR;
      for (let s = 0; s < SUB; s++) {
        for (let i = 0; i < N; i++) {
          let vx = (x[i] - px[i]) * DAMP, vy = (y[i] - py[i]) * DAMP + G;
          if (pointer) {
            // the pointer drags the water along with its own speed; standing still it does nothing (no hole)
            const dx = x[i] - pointer.x, dyy = y[i] - pointer.y, d2 = dx * dx + dyy * dyy;
            if (d2 < PR2) {
              const w = 1 - Math.sqrt(d2) / PR, a = w * w * 0.35;
              vx += (pointer.vx / SUB - vx) * a; vy += (pointer.vy / SUB - vy) * a;
            }
          }
          const v2 = vx * vx + vy * vy; if (v2 > MAXV * MAXV) { const f = MAXV / Math.sqrt(v2); vx *= f; vy *= f; }
          px[i] = x[i]; py[i] = y[i]; x[i] += vx; y[i] += vy;
        }
        relax();
        bounds();
      }
      let e = 0;
      for (let i = 0; i < N; i++) { const vx = x[i] - px[i], vy = y[i] - py[i]; e += vx * vx + vy * vy; }
      return e / Math.max(1, N);
    }

    return { N, x, y, R, step, setBlock: (b) => { block = b; } };
  }
  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RarytuLiquid = api;
})(typeof window !== "undefined" ? window : this);
