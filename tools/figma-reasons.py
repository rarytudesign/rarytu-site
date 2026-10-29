#!/usr/bin/env python3
"""Sort what is left after a Figma check into reasons. Usage: python3 tools/figma-reasons.py report.json [out.json]
Prints rows no rule explains (to review by hand) and writes every remaining row with its reason."""
import json, re, sys

REASONS = {
  "last": "Последний экран: на сайте он ровно в высоту экрана (решение 29.10), в Figma это блок фиксированной высоты, поэтому всё ниже его сдвинуто",
  "font": "Ширина шрифта в браузере на 0.5–1 px отличается от Figma; группа выровнена по правому краю, правый край совпадает",
  "content": "Текст на сайте отличается от Figma намеренно (RU-вступления кейсов переписаны 27.10, в Figma старые), поэтому всё ниже сдвинуто",
  "orphan": "Правило «без висячих строк» (последние два слова вместе, ваш фидбек 28.10); в Figma в конце абзаца остаётся одно слово",
  "hyphen": "Слово с дефисом на сайте не переносится по дефису (правило для RU-текстов); в Figma перенос по дефису",
  "conflict": "Один и тот же абзац в Figma переносится по-разному на разных устройствах; общая строка контента не может совпасть везде",
  "figma-circle": "Ошибка автолейаута в Figma: у блока текста в кружке зафиксирована высота меньше содержимого, поэтому он не по центру; на сайте по центру",
  "figma-dots": "В RU-фрейме Figma кружки не сдвинуты вместе с карточкой видео (стоят по EN-координатам); на сайте они привязаны к видео, как в EN",
  "figma-style": "В Figma одна строка набрана другим стилем (16/22 вместо 14/20), похоже на случайность; на сайте как у остальных",
  "width": "Ширина рамки отличается, но строки и переносы совпадают, видимой разницы нет",
  "render": "Разница в отрисовке шрифта (браузер шире или уже Figma на 1–2 px в строке), переносы почти совпадают",
  "tool": "Карусель: в кадре Figma видны 2 фото, остальные за краем (не расхождение)",
  "principle": "Принципы на телефоне: в Figma текст в 5 из 6 кругов на 3 px выше центра, в первом по центру; на сайте у всех 3 px выше",
}

def reason(r, after_last):
    iss = r.get("issues") or []
    kinds = {i.split()[0] for i in iss}
    s = r.get("site") or {}; cls = s.get("cls", "") or ""; txt = r.get("text", "")
    if r["name"] == "page height": return "last" if r["page"][3:] in ("", "about/", "approach/") else ("content" if r["page"].startswith("ru/work") else "last")
    if "dfoot" in cls or "sfoot" in cls or after_last: return "last"
    if r["page"].startswith("ru/work/") and kinds & {"media", "spacing", "lines", "breaks"}: return "content"
    if kinds == {"x"} and re.search(r"Contact|Download|Контакты|Скачать|HEVY →|Approach|Caption|Рабочий", txt + r["name"]): return "font"
    if r["name"] == "dot" and r["dev"] == "desktop" and r["page"] == "ru/approach/": return "figma-dots"
    if r["name"] == "dot": return "render"
    if "font" in kinds and "Institute" in txt or "Институт" in txt and "font" in kinds: return "figma-style"
    fl = (r.get("fig") or {}).get("lines") or []; sl = s.get("lines") or []
    if kinds & {"breaks", "lines"} and fl and sl:
        w = lambda l: re.sub(r"[\s ]+", " ", l).strip()
        if len(w(fl[-1]).split(" ")) == 1 and len(w(sl[-1]).split(" ")) >= 2: return "orphan"
        if any(w(l).endswith("-") for l in fl[:-1]): return "hyphen"
        return "conflict"
    if r["dev"] == "mobile" and r["page"] in ("en/", "ru/") and kinds <= {"spacing", "width"} and ("circle" in cls or r["name"] in ("A little about me", "About me", "First, I ask questions", "How I work", "Label", "Body")): return "figma-circle"
    if r["dev"] == "mobile" and "approach" in r["page"] and kinds <= {"spacing", "width"} and r["name"] in ("Title", "Body", "Counter"): return "principle"
    if r["name"] == "media count": return "tool"
    if r["dev"] == "tablet" and r["page"] == "en/approach/" and r["name"] in ("Title", "Body"): return "conflict"
    if r["dev"] == "tablet" and r["page"] == "en/about/" and kinds == {"spacing"}: return "conflict"
    if kinds <= {"font", "width", "spacing", "x"} and (re.search(r"HEVY →|I’m Anastasia|I like understanding|Вникаю", txt) or r["name"] == "About me"): return "render"
    if kinds == {"width"}: return "width"
    return None

def main():
    rows = json.load(open(sys.argv[1])); out = []
    last_y = {}
    for r in rows:
        if (r.get("site") or {}).get("cls", "").startswith("dfoot"): last_y[(r["dev"], r["page"])] = r["fig"]["y"]
    for r in rows:
        if not r.get("issues"): continue
        f = r.get("fig") or {}
        after = (r["dev"], r["page"]) in last_y and f.get("y") is not None and f["y"] > last_y[(r["dev"], r["page"])]
        k = reason(r, after)
        if not k: print("??", r["dev"], r["page"], r.get("fid"), r["name"], r.get("text", "")[:30], r["issues"])
        out.append({**r, "reason": k})
    if len(sys.argv) > 2: json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
