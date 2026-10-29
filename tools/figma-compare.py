#!/usr/bin/env python3
"""Compare Figma dumps (docs/figma/<device>.json) with site measurements (tools/measure.js output).

Usage: python3 tools/figma-compare.py site.json report.json [--tol 2]
For each Figma text layer: finds the site text block with the same text, then compares
top/left/width/height, font size, line height, letter spacing, number of lines and the line breaks.
'step' = change of the vertical offset against the previous matched layer: a non-zero step means the
spacing right before this block differs from Figma (an absolute offset alone just carries earlier errors).
Also compares decorative dots (nearest dot) and media boxes (in order).
"""
import json, re, sys, difflib, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG = os.path.join(ROOT, "docs", "figma")
TOL = 2.0
if "--tol" in sys.argv: TOL = float(sys.argv[sys.argv.index("--tol") + 1])

PAIRS = {
  "mobile": (390, {"290:2506": "en/", "290:2618": "en/about/", "290:2856": "en/approach/", "131:2813": "en/work/hevy/", "167:959": "en/work/dom/",
                   "152:2560": "ru/", "152:2330": "ru/about/", "152:2803": "ru/approach/", "152:2912": "ru/work/hevy/", "167:1014": "ru/work/dom/"}),
  "tablet": (820, {"286:2079": "en/", "141:12979": "en/about/", "141:13229": "en/approach/", "141:13334": "en/work/hevy/", "167:1070": "en/work/dom/",
                   "159:7406": "ru/", "159:7648": "ru/about/", "159:7882": "ru/approach/", "159:7981": "ru/work/hevy/", "167:1138": "ru/work/dom/"}),
  "desktop": (1920, {"200:4939": "en/", "104:3925": "en/about/", "194:4349": "en/approach/", "104:4192": "en/work/hevy/", "104:4258": "en/work/dom/",
                     "104:4313": "en/work/nomi/", "104:4373": "en/work/lumo/", "104:4439": "en/work/kodan/", "104:4505": "en/work/talktoast/",
                     "132:9166": "ru/", "240:511": "ru/about/", "132:10125": "ru/approach/", "132:9725": "ru/work/hevy/", "132:9796": "ru/work/dom/",
                     "132:9856": "ru/work/nomi/", "132:9921": "ru/work/lumo/", "132:9992": "ru/work/kodan/", "132:10063": "ru/work/talktoast/"}),
}

# Frames whose footer is the old design (contact list, "Back to top"); the site follows the newer frames
# (mobile 290:2985, tablet 286:2079, desktop Approach). Their footer layers are skipped.
NEW_FOOTER = {"290:2506", "290:2618", "290:2856", "152:2560", "152:2330", "152:2803", "286:2079", "194:4349", "132:10125"}
OLD_FOOT_START = re.compile(r"^(Let’s work together|Буду рада\s+сотрудничеству|Открыта\s*\n?\s*к новым проектам)$")

def footer_cut(f):
    if f["frame"] in NEW_FOOTER: return None
    ys = [i["box"][1] for i in f["items"] if i["t"] == "T" and OLD_FOOT_START.match(i["txt"].strip())]
    return min(ys) if ys else None

def norm(s):
    s = (s or "").lower().replace(" ", " ").replace(" ", " ")
    s = re.sub(r"[←→↗↑↓{}•·\s​­]", "", s)
    s = s.replace("ё", "е").replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"').replace("«", '"').replace("»", '"')
    s = s.replace("–", "-").replace("—", "-")
    return s

def wnorm(line):  # a line for break comparison: words only
    return "".join(re.sub(r"[←→↗↑↓{}•·]", " ", norm_keepspace(line)).split())

def norm_keepspace(s):
    s = (s or "").lower().replace(" ", " ")
    return s.replace("ё", "е").replace("’", "'").replace("–", "-").replace("—", "-").replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')

def main():
    site = json.load(open(sys.argv[1]))
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    rows = []
    for dev, (w, pairs) in PAIRS.items():
        fig = json.load(open(os.path.join(FIG, dev + ".json")))
        frames = {f["frame"]: f for f in fig["frames"]}
        for fid, page in pairs.items():
            f = frames[fid]; key = f"{page}@{w}"
            if key not in site: continue
            S = site[key]
            # Figma text layers, top to bottom, skipping the footer art and frame-less helpers
            cut = footer_cut(f)
            texts = [i for i in f["items"] if i["t"] == "T" and i["box"] and i["box"][2] > 0 and norm(i["txt"])
                     and not (cut is not None and i["box"][1] >= cut - 1) and not re.match(r"^(Back to top|Наверх)", i["txt"])]
            texts.sort(key=lambda i: (i["box"][1], i["box"][0]))
            used = set(); prev = {}; offs = []
            cand = [(k, t, norm(t["txt"])) for k, t in enumerate(S["T"])]
            for it in texts:
                nt = norm(it["txt"]); fx, fy, fw, fh = it["box"]
                if it.get("lines") and str(it["lines"][0]).startswith("ERR"):   # off-canvas layers don't export: count lines from the height
                    it = dict(it); sg = it["segs"][0] if it["segs"] else {}
                    it["lines"] = None; it["nlines"] = round(fh / sg["lh"]) if sg.get("lh") else None
                best = None
                for k, t, n in cand:
                    if k in used: continue
                    if n == nt: score = 1.0
                    elif len(nt) > 12 and (nt in n or n in nt) and min(len(n), len(nt)) / max(len(n), len(nt)) > 0.6: score = 0.9
                    elif len(nt) > 20:
                        score = difflib.SequenceMatcher(None, n, nt).quick_ratio()
                        score = difflib.SequenceMatcher(None, n, nt).ratio() * 0.95 if score > 0.85 else 0
                        if score < 0.8: continue
                    else: continue
                    expect = fy + (prev.get("main") or 0)
                    dist = abs(t["top"] - expect) + abs(t["left"] - fx) * 0.5
                    rank = (score, -dist)
                    if best is None or rank > best[0]: best = (rank, k, t)
                seg = it["segs"][0] if it["segs"] else {}
                row = {"dev": dev, "page": page, "fid": it["id"], "name": it["nm"], "path": it["p"], "text": it["txt"][:70].replace("\n", " / "), "fig_txt": it["txt"],
                       "fig": {"x": fx, "y": fy, "w": fw, "h": fh, "fs": seg.get("fs"), "lh": seg.get("lh"), "ls": seg.get("ls"), "ff": seg.get("ff"),
                               "lines": it.get("lines"), "al": it.get("al"), "ar": it.get("ar")}}
                if not best or best[0][0] < 1.0:
                    # one Figma layer can hold several paragraphs that are separate blocks on the site
                    found = False
                    for k in range(len(cand)):
                        if k in used or not cand[k][2] or not nt.startswith(cand[k][2]): continue
                        acc = ""
                        for j in range(k, min(k + 8, len(cand))):
                            if j in used: break
                            acc += cand[j][2]
                            if not nt.startswith(acc): break
                            if acc == nt and j > k:
                                parts = [cand[q][1] for q in range(k, j + 1)]
                                m = dict(parts[0]); m["lines"] = sum((q["lines"] for q in parts), [])
                                m["left"] = min(q["left"] for q in parts); m["right"] = max(q["right"] for q in parts)
                                m["hh"] = round(parts[-1]["box"][1] + parts[-1]["box"][3] - parts[0]["top"], 1)
                                m["box"] = [parts[0]["box"][0], parts[0]["box"][1], max(q["box"][2] for q in parts), m["hh"]]
                                for q in range(k + 1, j + 1): used.add(q)
                                best = ((0.99, 0), k, m); found = True; break
                        if found: break
                if not best:
                    row["missing"] = True; rows.append(row); continue
                _, k, t = best; used.add(k)
                # arrows live in their own inline-block spans: glue them back to the text they belong to
                t = dict(t)
                for k2, t2, n2 in cand:
                    if n2 == "" and k2 not in used and abs(t2["top"] - t["top"]) < 3 and (0 <= t["left"] - t2["right"] < 24 or 0 <= t2["left"] - t["right"] < 24):
                        used.add(k2); t["left"] = min(t["left"], t2["left"]); t["right"] = max(t["right"], t2["right"])
                        t["lines"] = [(" ".join(t2["lines"]) + " " + t["lines"][0]) if t2["left"] < t["left"] + 1 else (t["lines"][0] + " " + " ".join(t2["lines"]))] + t["lines"][1:]
                        t["box"] = [t["left"], t["box"][1], t["right"] - t["left"], t["box"][3]]
                # Figma layers trimmed to cap height (text-box-trim): move their top back to the line box top
                npar = it["txt"].count("\n") + 1
                nfl = len(it["lines"]) if it.get("lines") else (it.get("nlines") or 1)
                full_h = nfl * (seg.get("lh") or 0) + (it.get("ps") or 0) * (npar - 1)
                trim_h = (nfl - 1) * (seg.get("lh") or 0) + 0.727 * (seg.get("fs") or 0) + (it.get("ps") or 0) * (npar - 1)
                if seg.get("lh") and seg.get("fs") and abs(fh - trim_h) < abs(fh - full_h) - 0.5:
                    fsz, flh = seg["fs"], seg["lh"]
                    fy = round(fy - ((flh - 1.2109 * fsz) / 2 + (0.96875 - 0.727) * fsz), 1)
                lhs = t["lh"] or seg.get("lh")
                nl = len(t["lines"]); fl = len(it.get("lines") or []) or it.get("nlines") or 0
                sx = t["left"] if it.get("al") in ("LEFT", "JUSTIFIED", None) else t["box"][0]
                if it["txt"].lstrip().startswith("{") and not t["txt"].lstrip().startswith("{"): sx = t["box"][0]   # braces drawn by CSS
                dy = round(t["top"] - fy, 1)
                row["site"] = {"x": sx, "y": t["top"], "w": t["box"][2], "h": t.get("hh") or (round(nl * lhs, 1) if lhs else t["box"][3]), "inkw": round(t["right"] - t["left"], 1),
                               "fs": t["fs"], "lh": t["lh"], "ls": t["ls"], "ff": t["ff"], "lines": t["lines"], "tag": t["tag"], "cls": t["cls"], "mw": t["mw"]}
                # fixed bars (desktop sidebar, mobile/tablet top bar) are their own flow
                flow = "side" if (dev == "desktop" and fx < 490) or re.search(r"nav|sidebar|top bar", it["p"], re.I) else "main"
                prev_dy = prev.get(flow)
                row["dy"] = dy; row["step"] = round(dy - prev_dy, 1) if prev_dy is not None else dy; row["flow"] = flow
                prev[flow] = dy
                if flow == "main": offs.append((fy + fh, round(t["top"] + row["site"]["h"] - fy - fh, 1)))
                iss = []
                if abs(row["step"]) > TOL: iss.append(f"spacing {row['step']:+}")
                if it.get("al") == "LEFT" and abs(sx - fx) > TOL: iss.append(f"x {sx - fx:+.1f}")
                if it.get("al") == "CENTER":
                    fc = fx + fw / 2; sc = (t["left"] + t["right"]) / 2
                    if abs(sc - fc) > TOL: iss.append(f"center x {sc - fc:+.1f}")
                if seg.get("fs") and abs(t["fs"] - seg["fs"]) > 0.1: iss.append(f"font {seg['fs']}→{t['fs']}")
                if seg.get("lh") and t["lh"] and abs(t["lh"] - seg["lh"]) > 0.3 and max(nl, fl) > 1: iss.append(f"lh {seg['lh']}→{t['lh']}")
                if seg.get("ls") is not None and abs(t["ls"] - seg["ls"]) > 0.05: iss.append(f"ls {seg['ls']}→{t['ls']}")
                if fl and nl != fl: iss.append(f"lines {fl}→{nl}")
                elif it.get("lines") and not (fl == 1 and nl == 1) and [wnorm(x) for x in it["lines"]] != [wnorm(x) for x in t["lines"]]: iss.append("breaks")
                if it.get("ar") in ("HEIGHT", "NONE") and fl > 1 and abs(t["box"][2] - fw) > TOL and t["box"][2] < fw + 40:
                    iss.append(f"width {fw}→{t['box'][2]}")
                row["issues"] = iss
                rows.append(row)
            # dots: each Figma dot against the nearest site dot
            fd = [i for i in f["items"] if i["t"] == "E" and ("dot" in i["nm"].lower() or (dev == "desktop" and 30 < i["box"][2] < 50 and i["box"][0] > 490))]
            sd = list(S["D"])
            for d in fd:
                if not sd: rows.append({"dev": dev, "page": page, "fid": d["id"], "name": "dot", "fig": {"x": d["box"][0], "y": d["box"][1], "w": d["box"][2]}, "missing": True}); continue
                j = min(range(len(sd)), key=lambda j: abs(sd[j]["box"][0] - d["box"][0]) + abs(sd[j]["box"][1] - d["box"][1]))
                s = sd.pop(j)
                ddx = round(s["box"][0] - d["box"][0], 1); ddy = round(s["box"][1] - d["box"][1], 1); dsz = round(s["box"][2] - d["box"][2], 1)
                iss = []
                if abs(ddx) > TOL or abs(ddy) > TOL: iss.append(f"dot {ddx:+} {ddy:+}")
                if abs(dsz) > 0.5: iss.append(f"dot size {d['box'][2]}→{s['box'][2]}")
                rows.append({"dev": dev, "page": page, "fid": d["id"], "name": "dot", "fig": {"x": d["box"][0], "y": d["box"][1], "w": d["box"][2]},
                             "site": {"x": s["box"][0], "y": s["box"][1], "w": s["box"][2]}, "issues": iss})
            for s in sd: rows.append({"dev": dev, "page": page, "name": "dot", "extra": True, "site": {"x": s["box"][0], "y": s["box"][1]}, "issues": ["dot not in Figma"]})
            # media: Figma image layers vs site media, in reading order
            fm = sorted([i for i in f["items"] if i["t"] == "I" and i["box"][2] > 60 and i["box"][3] > 60 and "Screenshot" not in i["nm"]
                         and i["box"][0] < w and i["box"][0] + i["box"][2] > 0], key=lambda i: (round(i["box"][1]), i["box"][0]))
            sm = sorted(S["M"], key=lambda m: (round(m["box"][1]), m["box"][0]))
            for a, b in zip(fm, sm):
                fx, fy, fw, fh = a["box"]; sx, sy, sw, sh = b["box"]
                # vertical: against the offset the text just above already carries (so one earlier error isn't counted twice)
                above = [d for y, d in offs if y <= fy]; base = above[-1] if above else 0
                iss = [f"media {k} {v:+.1f}" for k, v in (("x", sx - fx), ("y", sy - fy - base), ("w", sw - fw), ("h", sh - fh)) if abs(v) > TOL]
                rows.append({"dev": dev, "page": page, "fid": a["id"], "name": "media " + a["nm"], "fig": {"x": fx, "y": fy, "w": fw, "h": fh},
                             "site": {"x": sx, "y": sy, "w": sw, "h": sh, "src": b["src"]}, "issues": iss})
            if len(fm) != len(sm): rows.append({"dev": dev, "page": page, "name": "media count", "issues": [f"media count {len(fm)}→{len(sm)}"]})
            if cut is None: rows.append({"dev": dev, "page": page, "name": "page height", "fig": {"h": f["h"]}, "site": {"h": S["h"]},
                         "issues": [f"height {f['h']:.0f}→{S['h']}"] if abs(S["h"] - f["h"]) > TOL else []})
    if out_path: json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=1)
    # summary
    from collections import Counter
    c = Counter(); miss = Counter()
    for r in rows:
        if r.get("missing"): miss[(r["dev"], r["page"])] += 1
        for i in r.get("issues", []): c[(r["dev"], r["page"], i.split()[0])] += 1
    for dev in PAIRS:
        for page in PAIRS[dev][1].values():
            parts = [f"{k[2]}:{v}" for k, v in sorted(c.items()) if k[0] == dev and k[1] == page]
            print(f"{dev:8} {page:20} missing:{miss[(dev, page)]:3}  " + " ".join(parts))

if __name__ == "__main__":
    main()
