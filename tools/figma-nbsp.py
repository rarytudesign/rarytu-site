#!/usr/bin/env python3
"""Copy Figma's non-breaking spaces into content/*.json so the site breaks lines where Figma does.

Usage: python3 tools/figma-nbsp.py report.json [--dry]
report.json is the output of tools/figma-compare.py (every matched Figma text layer, with its text and lines).

Every Figma paragraph is looked up in the content files (same language, and a variant used on that device:
plain, d = desktop, mt = phones + tablets, m = phones, t = tablets). One content string can be shown on several
devices, and Figma may hold words together differently on each. So for every gap between two words:
  - a non-breaking space if Figma has one there on any device that shows this string,
  - unless Figma ends a line at that gap on any of those devices (then a normal space).
Tags, <br> and the words are never changed. Strings with no Figma counterpart are left alone.
"""
import json, re, sys, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV_VARIANTS = {"mobile": {None, "mt", "m"}, "tablet": {None, "mt", "t"}, "desktop": {None, "d"}}
WS = "   \n"

def canon(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&amp;", "&").replace("&nbsp;", " ")
    s = re.sub(r"[\s  ​]+", "", s).lower()
    return s.replace("ё", "е").replace("’", "'").replace("—", "-").replace("–", "-")

def leaves(obj, path=()):
    if isinstance(obj, str): yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items(): yield from leaves(v, path + (k,))
    elif isinstance(obj, list):
        for i, v in enumerate(obj): yield from leaves(v, path + (i,))

def info(path):
    return next((k for k in path if k in ("en", "ru")), None), next((k for k in path if k in ("d", "mt", "m", "t")), None)

def set_at(obj, path, val):
    for k in path[:-1]: obj = obj[k]
    obj[path[-1]] = val

def figma_gaps(text, lines):
    """Gaps between the words of a Figma text: list of (kind, a line ends here). kind: nb / sp / hard."""
    ends = set(); n = 0   # line ends, counted in non-space characters (an end inside a hyphenated word is no gap)
    for ln in lines or []:
        n += len(re.sub(r"[\s  ]", "", ln)); ends.add(n)
    out = []; i = 0; seen = 0
    while i < len(text):
        if text[i] in WS:
            j = i
            while j < len(text) and text[j] in WS: j += 1
            if seen and j < len(text):
                g = text[i:j]
                out.append(("hard" if ("\n" in g or " " in g) else "nb" if " " in g else "sp", seen in ends))
            i = j
        else: seen += 1; i += 1
    return out

def content_gaps(c):
    """The gaps of a content string in the same order as Figma's: ('br', a, b) for <br>, ('ws', a, b) for spaces."""
    pos = []; k = 0; seen_text = False; after_br = False
    while k < len(c):
        if c[k] == "<":
            j = c.index(">", k) + 1
            if re.match(r"<br\b", c[k:j]): pos.append(("br", k, j)); after_br = True
            k = j; continue
        if c[k] in "  ":
            j = k
            while j < len(c) and c[j] in "  ": j += 1
            if seen_text and j < len(c) and not after_br and not re.match(r"<br\b", c[j:j + 4]): pos.append(("ws", k, j))
            k = j; continue
        seen_text = True; after_br = False; k += 1
    return pos

def main():
    rows = json.load(open(sys.argv[1]))
    dry = "--dry" in sys.argv
    files = sorted(glob.glob(os.path.join(ROOT, "content", "**", "*.json"), recursive=True))
    data = {f: json.load(open(f)) for f in files}
    index = {}
    for f, d in data.items():
        for path, s in leaves(d):
            lang, var = info(path)
            if lang: index.setdefault((lang, canon(s)), []).append((f, path, var, s))
    votes = {}   # content string -> per gap: what each device's Figma says
    for r in rows:
        ftxt = r.get("fig_txt"); flines = (r.get("fig") or {}).get("lines")
        if not ftxt or not r.get("site") or not flines: continue
        dev, lang = r["dev"], r["page"][:2]
        gaps = figma_gaps(ftxt, flines)
        # one content string may hold the whole text (with <br>); otherwise each Figma paragraph is its own string
        if [h for h in index.get((lang, canon(ftxt)), []) if h[2] in DEV_VARIANTS[dev]]: parts = [(ftxt, 0, len(gaps))]
        else:
            parts = []; g0 = 0
            for p in ftxt.split("\n"):
                ng = len(figma_gaps(p, None)); parts.append((p, g0, g0 + ng)); g0 += ng + (1 if p.strip() else 0)
        for p, g0, g1 in parts:
            if not p.strip(): continue
            for f, path, var, s in [h for h in index.get((lang, canon(p)), []) if h[2] in DEV_VARIANTS[dev]]:
                cg = content_gaps(s); fg = gaps[g0:g1]
                if len(cg) != len(fg): print("skip (gaps differ)", dev, r["page"], p[:50]); continue
                v = votes.setdefault((f, path), {"s": s, "gaps": [[] for _ in cg]})
                for k, (kind, brk) in enumerate(fg): v["gaps"][k].append((dev, kind, brk))
    changed = 0
    for (f, path), v in votes.items():
        s = v["s"]; out = []; last = 0
        for (typ, a, b), vs in zip(content_gaps(s), v["gaps"]):
            if typ == "br": continue
            nb = any(kind == "nb" for _, kind, _ in vs) and not any(brk for _, _, brk in vs)
            out.append(s[last:a]); out.append(" " if nb else " "); last = b
        out.append(s[last:]); new = "".join(out)
        if new != s:
            changed += 1
            print("changed", os.path.relpath(f, ROOT) + ":" + "/".join(map(str, path)), sorted({d for g in v["gaps"] for d, _, _ in g}))
            set_at(data[f], path, new)
    print(changed, "strings changed")
    if not dry:
        for f, d in data.items():
            txt = json.dumps(d, ensure_ascii=False, indent=2) + "\n"
            if txt != open(f).read(): open(f, "w").write(txt)

if __name__ == "__main__":
    main()
