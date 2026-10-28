/* The liquid of spheres on the GPU (WebGL2). Same physics as assets/liquid.js (double density relaxation,
   Clavet et al. 2005), run in shaders: every frame the spheres are sorted by grid cell (bitonic sort) so each
   one finds its neighbours, then pressure keeps them apart like water. Drawn as round points.
   RarytuLiquidGL.create(canvas, opts) returns null when the browser can't do it (no WebGL2 or float targets);
   main.js then uses the CPU version. */
(function (root) {
  const VS_QUAD = `#version 300 es
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform int uTW; uniform int uN; uniform int uNp;
out vec4 o;
vec4 at(sampler2D t, int i) { return texelFetch(t, ivec2(i % uTW, i / uTW), 0); }
int self() { ivec2 c = ivec2(gl_FragCoord.xy); return c.y * uTW + c.x; }
`;
  // 1. integrate: gravity, the pointer's pull, speed limit; state = (x, y, previous x, previous y)
  const FS_PREDICT = HEAD + `
uniform sampler2D uState; uniform float uG, uDamp, uMaxV, uPR; uniform vec4 uPtr; uniform float uPtrOn;
void main() {
  int i = self(); vec4 s = at(uState, i);
  if (i >= uN) { o = s; return; }
  vec2 p = s.xy, v = (s.xy - s.zw) * uDamp + vec2(0.0, uG);
  if (uPtrOn > 0.5) {
    float d = length(p - uPtr.xy);
    if (d < uPR) { float w = 1.0 - d / uPR, a = w * w * 0.35; v += (uPtr.zw - v) * a; }
  }
  float sp = length(v); if (sp > uMaxV) v *= uMaxV / sp;
  o = vec4(p + v, p);
}`;
  // 2. sort keys: (grid cell, sphere index)
  const FS_KEYS = HEAD + `
uniform sampler2D uState; uniform float uH, uOff, uTop; uniform int uGW, uGH;
void main() {
  int i = self();
  if (i >= uN) { o = vec4(float(uGW * uGH), float(i), 0.0, 0.0); return; }
  vec2 p = at(uState, i).xy;
  int cx = clamp(int(floor((p.x + uOff) / uH)) + 1, 0, uGW - 1), cy = clamp(int(floor((p.y + uTop) / uH)) + 1, 0, uGH - 1);
  o = vec4(float(cy * uGW + cx), float(i), 0.0, 0.0);
}`;
  const FS_SORT = HEAD + `
uniform sampler2D uKeys; uniform int uK, uJ;
void main() {
  int i = self(); int l = i ^ uJ;
  vec4 a = at(uKeys, i), b = at(uKeys, l);
  bool keepMin = ((i & uK) == 0) == (i < l);
  bool aLess = a.x < b.x || (a.x == b.x && a.y < b.y);
  o = (keepMin == aLess) ? a : b;
}`;
  // 3. where each cell's spheres start and end in the sorted list
  const FS_CELLS = HEAD + `
uniform sampler2D uKeys; uniform int uGW;
int lb(float c) { int lo = 0, hi = uNp; for (int it = 0; it < 20; it++) { if (lo >= hi) break; int m = (lo + hi) / 2; if (at(uKeys, m).x < c) lo = m + 1; else hi = m; } return lo; }
void main() { ivec2 g = ivec2(gl_FragCoord.xy); float c = float(g.y * uGW + g.x); o = vec4(float(lb(c)), float(lb(c + 1.0)), 0.0, 0.0); }`;
  const NEIGH = `
uniform sampler2D uState, uKeys, uCells; uniform float uH, uOff, uTop; uniform int uGW, uGH;
#define EACH_NEIGHBOUR(BODY) { \\
  int cx = int(floor((p.x + uOff) / uH)) + 1, cy = int(floor((p.y + uTop) / uH)) + 1; \\
  for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) { \\
    int X = cx + ox, Y = cy + oy; if (X < 0 || Y < 0 || X >= uGW || Y >= uGH) continue; \\
    vec2 r = texelFetch(uCells, ivec2(X, Y), 0).xy; int a = int(r.x), b = min(int(r.y), a + 24); \\
    for (int k = a; k < b; k++) { int j = int(at(uKeys, k).y); if (j == i) continue; \\
      vec2 d = at(uState, j).xy - p; float dl = length(d); if (dl >= uH) continue; \\
      float q = 1.0 - dl / uH; BODY } } }
`;
  // 4. density around each sphere
  const FS_DENSITY = HEAD + NEIGH + `
void main() {
  int i = self(); if (i >= uN) { o = vec4(0.0); return; }
  vec2 p = at(uState, i).xy; float rho = 0.0, rhoN = 0.0;
  EACH_NEIGHBOUR(rho += q * q; rhoN += q * q * q;)
  o = vec4(rho, rhoN, 0.0, 0.0);
}`;
  // 5. pressure moves the spheres apart (or together), then the container's walls and floor
  const FS_RELAX = HEAD + NEIGH + `
uniform sampler2D uDens; uniform float uK0, uKN, uRho0, uR, uW, uHt;
void main() {
  int i = self(); vec4 s = at(uState, i); if (i >= uN) { o = s; return; }
  vec2 p = s.xy, mine = at(uDens, i).xy, dp = vec2(0.0);
  EACH_NEIGHBOUR(
    vec2 other = at(uDens, j).xy;
    float P = uK0 * ((mine.x + other.x) * 0.5 - uRho0); float PN = uKN * (mine.y + other.y) * 0.5;
    dp -= (d / max(dl, 0.001)) * (P * q + PN * q * q) * 0.5;)
  p += dp; vec2 pr = s.zw;
  float L = uR, Rt = uW - uR, B = uHt - uR;
  if (p.x < L) { p.x = L; pr.x = L; } else if (p.x > Rt) { p.x = Rt; pr.x = Rt; }
  if (p.y > B) { p.y = B; pr.y = B; pr.x += (p.x - pr.x) * 0.05; }
  o = vec4(p, pr);
}`;
  // drawing: one round point per sphere, soft 1px edge
  const VS_DRAW = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uState; uniform int uTW; uniform vec2 uSize; uniform float uPt;
void main() { int i = gl_VertexID; vec2 p = texelFetch(uState, ivec2(i % uTW, i / uTW), 0).xy;
  gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0); gl_PointSize = uPt; }`;
  const FS_DRAW = `#version 300 es
precision highp float; uniform vec3 uColor; uniform float uPt; out vec4 o;
void main() { float d = length(gl_PointCoord * 2.0 - 1.0) * uPt * 0.5; float a = clamp(uPt * 0.5 - 0.5 - d + 0.5, 0.0, 1.0); if (a <= 0.0) discard; o = vec4(uColor * a, a); }`;

  function create(canvas, o) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;
    const W = o.width, H = o.height, DPR = o.dpr || 1;
    const R = o.radius || 4, S = o.spacing || 12, h = S * 2;
    const SUB = 3, G = 0.5 / (SUB * SUB), K = 0.1 * S, KN = S / 3, MAXV = 28 / SUB, DAMP = 0.997, PR = o.pointerRadius || 80;
    const q1 = 1 - S / h, q2 = Math.max(0, 1 - (S * Math.sqrt(3)) / h), RHO0 = (6 * q1 * q1 + 6 * q2 * q2) * (o.rho0Scale || (S >= 20 ? 1.33 : 0.9));   // same tuning as liquid.js

    // the water at rest: hexagonal rows below the surface line, inside the container
    const pts = [], dy = (S * Math.sqrt(3)) / 2, cols = Math.floor((W - 2 * R) / S), x0 = (W - cols * S) / 2;
    for (let j = 0, yy = H - R - 0.5; yy > 0; j++, yy -= dy) {
      const off = j % 2 ? S / 2 : 0, n = j % 2 ? cols - 1 : cols; let any = false;
      for (let k = 0; k <= n; k++) { const xx = x0 + off + k * S; if (yy >= o.surface(xx)) { pts.push(xx, yy); any = true; } }
      if (!any) break;
    }
    const N = pts.length / 2; if (!N) return null;
    let Np = 64; while (Np < N) Np *= 2;
    let TW = 1; while (TW * TW < Np) TW *= 2; const TH = Np / TW;
    const OFF = h, TOP = 900, GW = Math.ceil((W + 2 * OFF) / h) + 2, GH = Math.ceil((H + TOP + OFF) / h) + 2;

    // ---------- GL plumbing ----------
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const vq = sh(gl.VERTEX_SHADER, VS_QUAD);
    const prog = (fs, vs) => {
      const p = gl.createProgram(); gl.attachShader(p, vs || vq); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let k = 0; k < n; k++) { const a = gl.getActiveUniform(p, k); u[a.name] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    let P;
    try {
      P = { predict: prog(FS_PREDICT), keys: prog(FS_KEYS), sort: prog(FS_SORT), cells: prog(FS_CELLS), dens: prog(FS_DENSITY), relax: prog(FS_RELAX),
        draw: prog(FS_DRAW, sh(gl.VERTEX_SHADER, VS_DRAW)) };
    } catch (e) { console.warn("liquid: WebGL2 shaders failed, using the CPU version", e); return null; }
    const tex = (w, hh, data) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, hh, 0, gl.RGBA, gl.FLOAT, data || null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return ok ? { t, f, w, h: hh } : null;
    };
    const init = new Float32Array(Np * 4);
    for (let i = 0; i < Np; i++) {
      const x = i < N ? pts[2 * i] : -1e4, y = i < N ? pts[2 * i + 1] : -1e4;
      init.set([x, y, x, y], i * 4);
    }
    let A = tex(TW, TH, init), Bt = tex(TW, TH), K1 = tex(TW, TH), K2 = tex(TW, TH), D = tex(TW, TH), C = tex(GW, GH);
    if (!A || !Bt || !K1 || !K2 || !D || !C) return null;
    const vao = gl.createVertexArray();

    function pass(pr, target, set) {
      gl.useProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target.f); gl.viewport(0, 0, target.w, target.h);
      const u = pr.u;
      if (u.uTW) gl.uniform1i(u.uTW, TW); if (u.uN) gl.uniform1i(u.uN, N); if (u.uNp) gl.uniform1i(u.uNp, Np);
      let unit = 0;
      set((name, t) => { if (!u[name]) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.t); gl.uniform1i(u[name], unit); unit++; }, u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    const gridU = (u) => { gl.uniform1f(u.uH, h); gl.uniform1f(u.uOff, OFF); gl.uniform1f(u.uTop, TOP); gl.uniform1i(u.uGW, GW); if (u.uGH) gl.uniform1i(u.uGH, GH); };

    function step(pointer) {
      gl.bindVertexArray(vao); gl.disable(gl.BLEND);
      for (let s = 0; s < SUB; s++) {
        pass(P.predict, Bt, (bind, u) => {
          bind("uState", A); gl.uniform1f(u.uG, G); gl.uniform1f(u.uDamp, DAMP); gl.uniform1f(u.uMaxV, MAXV); gl.uniform1f(u.uPR, PR);
          gl.uniform1f(u.uPtrOn, pointer ? 1 : 0);
          gl.uniform4f(u.uPtr, pointer ? pointer.x : 0, pointer ? pointer.y : 0, pointer ? pointer.vx / SUB : 0, pointer ? pointer.vy / SUB : 0);
        });
        [A, Bt] = [Bt, A];
        pass(P.keys, K1, (bind, u) => { bind("uState", A); gridU(u); });
        for (let k = 2; k <= Np; k *= 2) for (let j = k >> 1; j > 0; j >>= 1) {
          pass(P.sort, K2, (bind, u) => { bind("uKeys", K1); gl.uniform1i(u.uK, k); gl.uniform1i(u.uJ, j); });
          [K1, K2] = [K2, K1];
        }
        pass(P.cells, C, (bind, u) => { bind("uKeys", K1); gl.uniform1i(u.uGW, GW); });
        pass(P.dens, D, (bind, u) => { bind("uState", A); bind("uKeys", K1); bind("uCells", C); gridU(u); });
        pass(P.relax, Bt, (bind, u) => {
          bind("uState", A); bind("uKeys", K1); bind("uCells", C); bind("uDens", D); gridU(u);
          gl.uniform1f(u.uK0, K); gl.uniform1f(u.uKN, KN); gl.uniform1f(u.uRho0, RHO0); gl.uniform1f(u.uR, R); gl.uniform1f(u.uW, W); gl.uniform1f(u.uHt, H);
        });
        [A, Bt] = [Bt, A];
      }
    }
    const col = o.color || [84 / 255, 23 / 255, 37 / 255];
    function draw() {
      gl.bindVertexArray(vao); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.draw.p); const u = P.draw.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.t); gl.uniform1i(u.uState, 0);
      gl.uniform1i(u.uTW, TW); gl.uniform2f(u.uSize, W, H); gl.uniform1f(u.uPt, 2 * R * DPR + 1); gl.uniform3f(u.uColor, col[0], col[1], col[2]);
      gl.drawArrays(gl.POINTS, 0, N);
    }
    function destroy() { const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); }
    // for tests: the sphere positions read back from the GPU
    function read() { const out = new Float32Array(Np * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, A.f); gl.readPixels(0, 0, TW, TH, gl.RGBA, gl.FLOAT, out); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return out; }
    return { N, step, draw, destroy, read, gpu: true };
  }
  root.RarytuLiquidGL = { create };
})(typeof window !== "undefined" ? window : this);
