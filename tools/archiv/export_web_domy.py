#!/usr/bin/env python3
"""Knihovna pro dějiny domů (data/domy.py) – používá ji tools/export_web.py (load_houses, build_houses a pomocné funkce).

Dějiny domů nemají samostatný web – jsou součástí společného webu web/;
web se exportuje přes `python3 -I tools/export_web.py` (z web/: `bun run data`).
"""
import hashlib, html, json, os, re, shutil, subprocess, sys, unicodedata
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(TOOLS))   # tools/archiv/ → kořen projektu
if not os.path.exists(os.path.join(ROOT, "data", "STAV.md")):   # spuštěno ze složky skillu: data projektu tam nejsou, zápis by šel do skillu
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí data/STAV.md). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")
DATA = os.path.join(ROOT, "data")
VYREZY = os.path.join(ROOT, "vyrezy")      # výřezy zápisů, map a dokumentů (asi 1800 px) – zobrazují se na webu
ZDROJE = os.path.join(ROOT, "zdroje")      # tytéž výřezy v plném rozlišení (proklik)

STATUS = {"doc": "doloženo pramenem", "lit": "z literatury", "prob": "pravděpodobné", "fam": "od pamětníků",
          "unk": "neznámé"}
KINDS = {"N": "křest / narození", "O": "sňatek", "Z": "úmrtí", "I": "rejstřík", "S": "sčítání lidu",
         "G": "gruntovní / pozemková kniha", "K": "katastr", "M": "mapa", "C": "kronika", "L": "literatura",
         "J": "jiný pramen"}


def jload(name, default):
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_houses():
    ns = {}
    exec(open(os.path.join(DATA, "domy.py"), encoding="utf-8").read(), ns)
    for name, default in (("OBEC", {}), ("OBEC_UDALOSTI", []), ("D", {}), ("ISSUES", [])):
        ns.setdefault(name, default)
    return ns


def record_rows():
    svazky = jload("svazky.json", {})
    rows = []
    for z in jload("zaznamy.json", []):
        sv = svazky.get(z.get("svazek", ""), {})
        key = z["klic"]
        rows.append(dict(
            key=key, kind=z.get("druh", "J"), date=z.get("datum", ""), title=z.get("nazev", key),
            summary=z.get("shrnuti", ""), scan=z.get("snimek", ""),
            archive=sv.get("archiv", ""), volume=sv.get("svazek", ""), vdesc=sv.get("popis", ""),
            portal=sv.get("portal", "archivu"), url=z.get("odkaz") or sv.get("url", ""),
            img=os.path.exists(os.path.join(VYREZY, key + ".jpg")),
            full=os.path.exists(os.path.join(ZDROJE, key + ".jpg")),
        ))
    return rows


def strip_comments(md):
    """Poznámky <!-- … --> v markdownu jsou pro Clauda, ne pro web."""
    return re.sub(r"<!--.*?-->\n?", "", md, flags=re.S)


def group_buttons(md):
    """Odkaz hned pod nadpisem ## skupiny („Celý příběh … →“) přesune na konec skupiny jako tlačítko."""
    parts = re.split(r"(?m)^(?=## )", md)
    for i, part in enumerate(parts):
        m = re.match(r"(## .*\n)\s*\[([^\]]+)\]\(([^)\s]+)\)[ \t]*\n", part)
        if m:
            btn = f'<p class="group-more"><a class="btn btn-ghost" href="{html.escape(m.group(3))}">{html.escape(m.group(2))}</a></p>\n\n'
            parts[i] = m.group(1) + part[m.end():].rstrip("\n") + "\n\n" + btn
    return "".join(parts)


def slugify(text):
    t = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def norm_answer(text):
    """Stejná normalizace jako v prihlaseni.html: bez diakritiky, malá písmena, jen a-z0-9."""
    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]", "", t)


def year_key(text):
    """Řadicí klíč z „1351“, „22. 7. 1351“, „asi 1600“, „1786–1820“ (první čtyřčíslí, pak den a měsíc)."""
    t = str(text or "")
    m = re.search(r"\d{4}", t)
    if not m:
        return 99999999
    parts = re.findall(r"\d+", t[:m.start()])
    d, mo = (parts + [0, 0])[:2] if len(parts) >= 2 else (0, (parts or [0])[0])
    return int(m.group(0)) * 10000 + int(mo) * 100 + int(d)


def magick_bin():   # ImageMagick 7 (magick), jinak 6 (convert) – ten ale ne na Windows, tam je convert.exe jiný program
    return shutil.which("magick") or (os.name != "nt" and shutil.which("convert")) or None


def size(path):
    w, h = subprocess.run([magick_bin(), path + "[0]", "-format", "%w %h", "info:"],
                          capture_output=True, text=True, check=True).stdout.split()
    return int(w), int(h)


def draw_boxes(src, dst, boxes, small):
    """Kopie výřezu v plném rozlišení s nakreslenými rámečky (pokud má stejný poměr stran jako webový výřez,
    na kterém se rámečky měřily). Vrací False, pak se kopíruje bez rámečků."""
    if not os.path.exists(small) or not magick_bin():
        return False
    (W, H), (w, h) = size(src), size(small)
    if abs(W / H - w / h) > 0.015 * (w / h):
        return False
    sw = max(4, round(W / 450))
    cmd = [magick_bin(), src, "-fill", "none", "-stroke", "#d7302a", "-strokewidth", str(sw)]
    for x0, y0, x1, y1 in boxes:
        cmd += ["-draw", f"rectangle {x0 * W:.0f},{y0 * H:.0f},{x1 * W:.0f},{y1 * H:.0f}"]
    subprocess.run(cmd + ["-quality", "90", dst], check=True)
    return True


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def cited(x, recs):
    """Klíče zápisů z pole „r“, které opravdu existují (neexistující hlásí kontrola.py)."""
    return [r for r in x.get("r", []) if r in recs]


def owner_year(o):
    """Rok držitele pro řazení: „od“, a když je neznámé („?“), aspoň „do“."""
    return o["since"] if re.search(r"\d", o["since"]) else o["until"]


def event(e, recs):
    return dict(year=str(e.get("rok", "")), text=e.get("text", ""), st=e.get("st", "unk"), status=STATUS.get(e.get("st"), ""),
                source=e.get("zdroj", ""), records=cited(e, recs))


def house_id(key, d, obec_default=""):
    """(obec, čp.) domu z data/domy.py: dům jiné obce než OBEC má klíč „<Obec> <čp>“ a pole obec= a cp=;
    domy bez pole `obec` patří do OBEC (klíč = čp.)."""
    return d.get("obec") or obec_default, str(d.get("cp") or key)


def build_houses(D, recs, docs_cfg, obec_default=""):
    """Domy z data/domy.py pro web (používá i tools/export_web.py pro společný rodinný web)."""
    houses = {}
    for key, d in D.items():
        obec, cp = house_id(key, d, obec_default)
        slug = slugify(key)
        people = [dict(name=o.get("n", ""), years=o.get("y", ""), role=o.get("role", ""), facts=o.get("f", []),
                       st=o.get("st", "unk"), status=STATUS.get(o.get("st"), ""), note=o.get("note", ""),
                       k=o.get("o"), records=cited(o, recs)) for o in d.get("obyvatele", [])]
        owners = [dict(since=str(o.get("od", "")), until=str(o.get("do", "")), name=o.get("n", ""), how=o.get("jak", ""),
                       st=o.get("st", "unk"), status=STATUS.get(o.get("st"), ""), note=o.get("note", ""),
                       k=o.get("o"), records=cited(o, recs)) for o in d.get("drzitele", [])]
        # neznámý začátek („?“ do 1820) řadí podle konce – před toho, kdo ve stejném roce začal
        owners.sort(key=lambda o: (year_key(owner_year(o)), bool(re.search(r"\d", o["since"]))))
        events = sorted((event(e, recs) for e in d.get("udalosti", [])), key=lambda e: year_key(e["year"]))
        refs = [r for x in events + owners + people for r in x["records"]]
        houses[slug] = dict(
            cp=cp, obec=obec, slug=slug, name=d.get("nazev", ""), kind=d.get("druh", ""), st=d.get("st", "unk"),
            status=STATUS.get(d.get("st"), ""), desc=d.get("popis", ""), note=d.get("note", ""),
            lat=d.get("lat"), lon=d.get("lon"), numbers=[dict(when=a, num=b) for a, b in d.get("cisla", [])],
            events=events, owners=owners, people=people, records=list(dict.fromkeys(refs)),
            docs=[dict(img=x["img"], caption=x["popis"]) for x in docs_cfg if str(key) in [str(c) for c in x.get("domy", [])]
                  and os.path.exists(os.path.join(VYREZY, x["img"] + ".jpg"))],
        )
    houses = dict(sorted(houses.items(), key=lambda kv: (int(re.match(r"\d*", kv[1]["cp"]).group(0) or 99999), kv[1]["cp"])))
    return houses


if __name__ == "__main__":
    sys.exit("export_web_domy.py je jen knihovna. Web (rodokmen i dějiny domů) se exportuje přes: python3 -I tools/export_web.py")
