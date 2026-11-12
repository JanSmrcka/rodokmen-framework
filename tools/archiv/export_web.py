#!/usr/bin/env python3
"""Export dat rodokmenu (data/*) do webu ve složce web/.

Čte data/osoby.py, data/zaznamy.json, data/svazky.json, data/prepisy.json, data/zvyrazneni.json,
data/mista.json, data/web.json, data/dokumenty.json a markdownové poznámky. Zapisuje
web/src/data/site.json, web/src/generated/*, web/public/{img,zdroje}, web/public/prihlaseni.html,
web/nginx.conf a web/netlify/edge-functions/brana.js.

Spouští se z web/ příkazem `npm run data` (nebo přímo `python3 -I tools/export_web.py`, na Windows `python -I -X utf8 …`).
"""
import hashlib, html, json, os, re, shutil, subprocess, sys, unicodedata
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(TOOLS))   # tools/archiv/ → kořen projektu
DATA = os.path.join(ROOT, "data")
WEB = os.path.join(ROOT, "web")
VYREZY = os.path.join(ROOT, "vyrezy")      # výřezy zápisů a dokumentů (asi 1800 px) – zobrazují se na webu
ZDROJE = os.path.join(ROOT, "zdroje")      # tytéž výřezy v plném rozlišení (proklik)

ROOT_KEY = None   # výchozí kořen (KORENY["hlavni"], jinak první v KORENY): Kekulé čísla, rody a vějíř se počítají od něj
LINE_COLORS = {8: "#EFB45F", 9: "#F09A78", 10: "#E58AA6", 11: "#B99AE0",
               12: "#86B8E8", 13: "#6FCBB9", 14: "#9CD17A", 15: "#D3D46A"}
STATUS = {"doc": "doloženo matrikou", "prob": "pravděpodobné", "fam": "údaj od rodiny",
          "mh": "jen z cizího rodokmenu", "unk": "neznámé"}
KINDS = {"N": "křest / narození", "O": "sňatek", "Z": "úmrtí", "I": "rejstřík", "S": "sčítání lidu",
         "G": "gruntovní / pozemková kniha", "K": "katastr", "M": "mapa", "C": "kronika", "L": "literatura", "J": "jiný pramen"}


def jload(name, default):
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


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


def slugify(text):
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def norm_answer(text):
    """Stejná normalizace jako v prihlaseni.html: bez diakritiky, malá písmena, jen a-z0-9."""
    t = unicodedata.normalize("NFD", text)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]", "", t)


def years(y):
    y = (y or "").strip()
    ys = re.findall(r"\d{4}", y)
    if not ys:
        return ""
    approx = "≈" if re.match(r"^(asi|≈)", y) else ""
    head, dash, tail = y.partition("–")
    if y.startswith(("?", "†")) or (dash and not re.search(r"\d", head)) or re.match(r"po\b", y):
        # neznámé narození: ukázat jen úmrtí („? – před 1743“ → „† před 1743“, „– po 1921“ → „žil 1921“)
        if re.search(r"\bpo\b", tail or y):
            return "žil " + ys[-1]
        return "† " + ("před " if "před" in y else "") + ys[-1]
    if y.startswith("*"):
        return "* " + ys[0]
    if len(ys) == 1:
        return approx + ys[0]
    second = "?" if "před" in tail else ("po " if re.search(r"\bpo\b", tail) else "") + \
        ("≈" if re.search(r"(asi|≈)", tail) else "") + ys[-1]
    return f"{approx}{ys[0]}–{second}"


NOW = 2026
YR = re.compile(r"\b(1[0-9]{3}|20[0-9]{2})\b")


def year_part(s, death=False):
    """Jedna strana roků („asi 1720“, „před 1743“, „1960–1970“) → {y, lo, hi, q}; None když rok chybí."""
    ys = [int(x) for x in YR.findall(s or "")]
    if not ys:
        return None
    if re.search(r"\bpřed\b", s):
        return dict(y=None, lo=ys[-1] - 30, hi=ys[-1], q="est")
    if re.search(r"\bpo\b", s):
        return dict(y=None, lo=ys[-1], hi=ys[-1] + 30 if death else ys[-1] + 10, q="est")
    if len(ys) > 1:
        return dict(y=round(sum(ys[:2]) / 2), lo=min(ys[:2]), hi=max(ys[:2]), q="est")
    y = ys[0]
    if re.search(r"(asi|≈)", s):
        return dict(y=y, lo=y - 5, hi=y + 5, q="est")
    if "(?)" in s:
        return dict(y=y, lo=y - 2, hi=y + 2, q="est")
    return dict(y=y, lo=y, hi=y, q="doc")


def life(y, note=""):
    """Roky života z pole y (např. „asi 1720 – před 1785“, „* 1893, † asi 1960–1970“) → (birth, death, alive).
    Web pak neparsuje text; q: doc = rok uveden, est = odhad (asi/před/po/?), calc = dopočteno z příbuzných, unk = neznámé."""
    y = (y or "").strip()
    b = d = None
    if y.startswith("†"):
        d = y[1:]
    elif y.startswith("*"):
        b, _, d = y[1:].partition("†")
        b = b.rstrip(", ")
        if not d and re.match(r"^\s*[^–]*\d{4}[^–]*–\s*\S", b):   # „* 1850/1851 (?) – 1910“
            b, _, d = b.partition("–")
    elif y.startswith("?"):
        d = y.partition("–")[2]
    else:
        m = re.match(r"^(.*?\d{4}[^–]*?)\s*–\s*(.*)$", y)
        b, d = (m.group(1), m.group(2)) if m else (y, "")
    birth, death = year_part(b), year_part(d, death=True)
    if birth and death:
        death["lo"] = max(death["lo"], birth["lo"])
        birth["hi"] = min(birth["hi"], death["hi"])
    return birth, death, ("Žijící" in (note or "") and not death)


def unk_span(birth, death, alive):
    """Doplní neznámý konec, aby šel nakreslit (q=unk); jinak nechá None."""
    if birth and not death and not alive:
        base = birth["y"] or birth["hi"]
        death = dict(y=None, lo=min(base + 20, NOW), hi=min(base + 85, NOW), q="unk")
    if death and not birth:
        base = death["y"] or death["lo"]
        birth = dict(y=None, lo=base - 85, hi=base - 15, q="unk")
    return birth, death


def gen(k):
    return k.bit_length() - 1


def relation(k):
    g, male = gen(k), (k % 2 == 0)
    if g == 0:
        return "výchozí osoba rodokmenu"
    if g == 1:
        return "otec" if male else "matka"
    base = "dědeček" if male else "babička"
    if g <= 5:
        return "pra" * (g - 2) + base
    return f"{'předek' if male else 'předkyně'} v {g}. generaci ({'pra' * (g - 2)}{base})"


def placeholder(p):
    return p["n"].startswith(("otec neuveden", "matka neuvedena")) or p["n"] in ("", "?")


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


def login_files(cfg):
    """Přihlašovací brána: otázka na webu, na serveru (nginx i Netlify) jen otisk odpovědi (SHA-256).
    Stejný otisk spočítá přihlašovací stránka a uloží ho do cookie – samotná odpověď se nikam neukládá."""
    login = cfg.get("prihlaseni") or {}
    answer = norm_answer(login.get("odpoved", ""))
    tpl = open(os.path.join(WEB, "prihlaseni.sablona.html"), encoding="utf-8").read()
    if "rodokmen:" not in tpl:   # stará šablona (do 0.4.0) ukládá do cookie odpověď – s novou bránou by se nikdo nepřihlásil
        sys.exit("CHYBA: web/ má starou šablonu přihlášení. Aktualizujte projekt: python3 -I <skill>/tools/novy_projekt.py <složka projektu>")
    contact = cfg.get("kontakt") or {}
    hint = ""
    if contact.get("email"):
        hint = (f'Neznáte odpověď? Napište {html.escape(contact.get("jmeno", ""))} na '
                f'<a href="mailto:{html.escape(contact["email"])}">{html.escape(contact["email"])}</a>.')
    page = (tpl.replace("{{NAZEV}}", html.escape(cfg.get("nazev", "Rodokmen")))
               .replace("{{UVOD}}", html.escape(login.get("uvod", "Tenhle web je jen pro rodinu a příbuzné.")))
               .replace("{{OTAZKA}}", html.escape(login.get("otazka", "Odpověď na rodinnou otázku")))
               .replace("{{NAPOVEDA}}", hint))
    write(os.path.join(WEB, "public", "prihlaseni.html"), page)

    edge = os.path.join(WEB, "netlify", "edge-functions", "brana.js")
    if answer:
        digest = hashlib.sha256(("rodokmen:" + answer).encode()).hexdigest()
        nginx_map = f'  "{digest}" 1;'
        write(edge, open(os.path.join(WEB, "netlify", "brana.sablona.js"), encoding="utf-8").read().replace("{{HASH}}", digest))
    else:   # bez přihlášení – web je otevřený
        nginx_map = "  default 1;"
        if os.path.exists(edge):
            os.remove(edge)
    nginx = open(os.path.join(WEB, "nginx.sablona.conf"), encoding="utf-8").read().replace("{{ODPOVED}}", nginx_map)
    write(os.path.join(WEB, "nginx.conf"), nginx)
    return bool(answer)


def main():
    sys.path.insert(0, TOOLS)
    import graf
    g = graf.nacti()
    O = g.osoby
    global ROOT_KEY
    ROOT_KEY = g.hlavni_koren()
    if ROOT_KEY is None:
        sys.exit("V data/osoby.py chybí KORENY (výchozí osoba rodokmenu, např. KORENY = {\"hlavni\": \"<id>\"}).")
    root_id = g.koreny[ROOT_KEY]
    # Kekulého čísla jen jako odvozená pole pro výchozí kořen (rody, vějíř, přehled předků)
    kek = g.kekule(ROOT_KEY)                 # {k: id}; osoba ve více větvích má víc čísel
    first, aliases_of = {}, {}
    for k, i in kek.items():
        if i in first:
            aliases_of.setdefault(i, []).append(k)
        else:
            first[i] = k
    SAME = {a: first[i] for i, al in aliases_of.items() for a in al}   # alias Kekulé → kanonické Kekulé
    leg = g.legacy(ROOT_KEY)
    LINES, ISSUES = leg["LINES"], leg["ISSUES"]
    cfg = jload("web.json", {})
    login = cfg.get("prihlaseni") or {}
    if "--nasazeni" in sys.argv and not norm_answer(login.get("odpoved", "")) and not login.get("otevreny"):
        sys.exit("CHYBA: v data/web.json není odpověď na přihlašovací otázku – web by byl otevřený komukoli.\n"
                 "Nastavte prihlaseni.odpoved, nebo (jen když to opravdu chcete) prihlaseni.otevreny: true.")
    docs_cfg = jload("dokumenty.json", [])
    recs = {r["key"]: r for r in record_rows()}

    # stránka /osoba/<id>/ pro každou osobu grafu kromě placeholderů, bočních souhrnů a druhých výskytů
    slugs = {i: i for i, d in O.items() if not (placeholder(d) or d.get("druh") == "bocni" or d.get("tataz"))}
    kslug = {k: i for k, i in kek.items() if i in slugs}          # Kekulé → adresa (i pro aliasy)
    twins = {}                                                    # hlavní osoba → její druhé výskyty (tataz)
    for i, d in O.items():
        if d.get("tataz"):
            twins.setdefault(d["tataz"], []).append(d)
    # odkaz na osobu = id grafu (str); Kekulého čísla v datech neplatí (kontrola.py je hlásí jako chybu)
    ref = lambda x: g.id_osoby(x) if isinstance(x, str) and not x.isdigit() else None
    doc_people = lambda d: [s for s in (ref(x) for x in d.get("osoby", [])) if s in slugs]

    def line_of(k):
        g_ = gen(k)
        return k >> (g_ - 3) if g_ >= 3 else None

    def graph_rel(i):
        """Vztah osoby mimo předky výchozí osoby, popsaný přes graf („sestra: Jan Novák (praděděček)“)."""
        F = O[i].get("sex") == "F"
        for key, r in g.koreny.items():
            if r == i:
                return "výchozí osoba rodokmenu" + ("" if key == ROOT_KEY else f" ({key})")
        who = lambda j: f"{O[j]['n']}" + (f" ({relation(first[j])})" if j in first else "")
        for j in g.sourozenci(i):
            if j in first:
                return f"{'sestra' if F else 'bratr'}: {who(j)}"
        for j in g.manzele(i):
            if j in first:
                return f"{'manželka' if F else 'manžel'}: {who(j)}"
        for j in g.rodice(i):
            if j in first:
                return f"{'dcera' if F else 'syn'}: {who(j)}"
        for j in g.deti(i):
            if j in first or j in g.koreny.values():
                return f"{'matka' if F else 'otec'}: {who(j)}"
        for j in g.manzele(i):
            if j in slugs:
                return f"{'manželka' if F else 'manžel'}: {who(j)}"
        for j in g.rodice(i):
            if j in slugs:
                return f"{'dcera' if F else 'syn'}: {who(j)}"
        for j in g.deti(i):
            if j in slugs:
                return f"{'matka' if F else 'otec'}: {who(j)}"
        return "příbuzná mimo přímou linii" if F else "příbuzný mimo přímou linii"

    order = {i: (first.get(i, 10 ** 12), n) for n, i in enumerate(O)}   # předci podle Kekulé, ostatní podle osoby.py
    byorder = lambda xs: sorted(xs, key=lambda i: order[i])
    people = {}
    for i in byorder(slugs):
        d, k = O[i], first.get(i)
        o, m = g.rodice(i)
        al = aliases_of.get(i, [])
        path = []
        c = k or 0
        while c >= 1:
            path.append(kslug.get(c))
            c //= 2
        line_kids = [kslug[c] for c in [k // 2] + [a // 2 for a in al] if c in kslug] if k and k > 1 else []
        kids = list(dict.fromkeys(line_kids + byorder(c for c in g.deti(i) if c in slugs)))
        spouse = kslug.get(k ^ 1) if k and k > 1 else None
        spouses = list(dict.fromkeys(([spouse] if spouse else []) + byorder(j for j in g.manzele(i) if j in slugs)))
        side = [dict(name=O[e["a"]]["n"], text=O[e["a"]].get("t", ""), records=[r for r in O[e["a"]].get("r", []) if r in recs])
                for e in g.vztahy if e["t"] == "pribuzny" and e["b"] == i and O.get(e["a"], {}).get("druh") == "bocni"]
        records = [r for r in d.get("r", []) if r in recs]
        facts = list(d.get("f", []))
        for t in twins.get(i, []) if al else []:
            records = list(dict.fromkeys(records + [r for r in t.get("r", []) if r in recs]))
        if al:
            facts = [f for f in facts if not f.startswith("TÁŽ OSOBA")]
        people[i] = dict(
            k=k, slug=i, name=d["n"], y=d.get("y", ""), years=years(d.get("y")), st=d.get("st", "unk"),
            status=STATUS.get(d.get("st"), ""), gen=gen(k) if k else None, sex=d.get("sex", "M"),
            rel=relation(k) if k else graph_rel(i), line=line_of(k) if k else None, facts=facts, note=d.get("note", ""), records=records,
            father=o if o in slugs else None, mother=m if m in slugs else None,
            fatherUnknown=bool(o and placeholder(O[o])), motherUnknown=bool(m and placeholder(O[m])),
            child=kslug.get(k // 2) if k and k > 1 else None, spouse=spouses[0] if spouses else None, spouses=spouses,
            siblings=byorder(j for j in g.sourozenci(i) if j in slugs),
            family=None, ownFamily=None, path=path, side=side,
            docs=[dict(img=x["img"], caption=x["popis"]) for x in docs_cfg if i in doc_people(x)],
            children=kids,
            also=[dict(k=a, rel=relation(a), line=line_of(a), child=kslug.get(a // 2)) for a in al],
        )

    # rodiny = rodičovské páry (hrany rodic) + manželé bez dětí (hrany manzele)
    families = {}
    def family(fs, ms, unknown):
        fid = f"{fs}-a-{ms}" if fs and ms else (fs or ms) + "-rodina"
        if fid not in families:
            fk, mk = first.get(fs), first.get(ms)
            surname = (O[ms]["n"].split()[-1] if ms else "").strip("()?")
            mfacts = [x for x in (O[fs].get("f", []) if fs else []) + (O[ms].get("f", []) if ms else []) if x.startswith("×")]
            frec = (O[fs].get("r", []) if fs else []) + (O[ms].get("r", []) if ms else [])
            families[fid] = dict(id=fid, father=fs, mother=ms, fatherUnknown=unknown, child=None, children=[],
                                 marriage=[x for x in mfacts if surname and surname[:5] in x] or mfacts,
                                 records=[r for r in dict.fromkeys(frec) if r in recs and recs[r]["kind"] == "O"],
                                 line=line_of(fk) if fk else (line_of(mk) if mk else None),
                                 gen=gen(fk) if fk else (gen(mk) if mk else None), side=[])
        return families[fid]
    for c in byorder(slugs):
        o, m = g.rodice(c)
        fs, ms = (o if o in slugs else None), (m if m in slugs else None)
        if not fs and not ms:
            continue
        fam = family(fs, ms, bool(o and placeholder(O[o])))
        fam["children"].append(c)
        fam["child"] = fam["child"] or c
        fam["records"] = list(dict.fromkeys(fam["records"] + [r for r in people[c]["records"] if recs[r]["kind"] == "N"]))
        fam["side"] += people[c]["side"]
        people[c]["family"] = fam["id"]
    for e in g.vztahy:
        if e["t"] == "manzele" and e["a"] in slugs and e["b"] in slugs:
            fs, ms = sorted((e["a"], e["b"]), key=lambda j: O[j].get("sex") != "M")
            family(fs, ms, False)
    for fam in families.values():
        for x in (fam["father"], fam["mother"]):
            if x and (not people[x]["ownFamily"] or (people[x]["child"] and people[x]["child"] in fam["children"]
                                                     and people[x]["child"] not in families[people[x]["ownFamily"]]["children"])):
                people[x]["ownFamily"] = fam["id"]

    refs = {}
    for s, p in people.items():
        for r in p["records"] + [r for e in p["side"] for r in e["records"]]:
            refs.setdefault(r, []).append(s)
    hl = jload("zvyrazneni.json", {})
    prep = jload("prepisy.json", {})
    records = []
    for key, r in recs.items():
        r = dict(r)
        r["boxes"] = hl.get(key, {}).get("boxes", [])
        tr = prep.get(key, {})
        r["orig"], r["cs"] = tr.get("orig", ""), tr.get("cs", "")
        r["kindName"] = KINDS.get(r["kind"], r["kind"])
        r["people"] = list(dict.fromkeys(refs.get(key, [])))
        records.append(r)

    lines = {}
    for k, (name, desc) in sorted(LINES.items()):
        if k not in LINE_COLORS:
            continue
        members = [(p["k"], p) for p in people.values() if p["line"] == k]
        members += [(a["k"], p) for p in people.values() for a in p["also"] if a["line"] == k]
        members.sort(key=lambda x: x[0])
        lines[slugify(name)] = dict(k=k, slug=slugify(name), name=name, desc=desc, color=LINE_COLORS[k],
                                    root=kslug.get(k), people=[p["slug"] for _, p in members],
                                    gens={p["slug"]: gen(kk) for kk, p in members})
    lines = {s: l for s, l in lines.items() if l["root"]}
    for p in people.values():
        p["lineSlug"] = next((l["slug"] for l in lines.values() if l["k"] == p["line"]), None)

    # normalizované roky života pro časovou osu; chybějící narození dopočtené z dětí / rodičů (q=calc)
    for p in people.values():
        p["birth"], p["death"], p["alive"] = life(p["y"], O[p["slug"]].get("note", ""))
    for _ in range(3):
        for p in people.values():
            if p["birth"]:
                continue
            kb = [people[c]["birth"]["y"] or people[c]["birth"]["lo"] for c in p["children"] if c in people and people[c]["birth"] and people[c]["birth"]["q"] != "calc"]
            pb = [people[r]["birth"]["y"] or people[r]["birth"]["hi"] for r in (p["father"], p["mother"]) if r and people[r]["birth"] and people[r]["birth"]["q"] != "calc"]
            if kb:
                c = min(kb)
                lo, hi = c - (55 if p["sex"] == "M" else 45), c - 17
                if p["death"]:
                    hi = min(hi, p["death"]["hi"])
                    lo = min(lo, hi)
                p["birth"] = dict(y=round((lo + hi) / 2), lo=lo, hi=hi, q="calc")
            elif pb:
                c = max(pb)
                p["birth"] = dict(y=c + 30, lo=c + 17, hi=c + 50, q="calc")
    for p in people.values():
        p["birth"], p["death"] = unk_span(p["birth"], p["death"], p["alive"])
        born = next((f for f in p["facts"] if f.startswith("*")), "")
        m = re.search(r"\d{4}\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\d(,;]*?)(?:\s+čp\.|\s*[(,;]|$)", born)
        p["place"] = m.group(1).split(" nebo ")[0].strip() if m else None   # bydliště z domů ho níž přepíše

    places = []
    for name, e in jload("mista.json", {}).items():
        if "lat" not in e:
            continue
        rx = re.compile(e.get("re") or re.escape(name))
        hits = [p for p in people.values() if p["k"] and rx.search(" ".join(p["facts"]))]   # mapa = kde žili předci
        byline = {}
        for p in sorted(hits, key=lambda p: p["k"]):
            byline.setdefault(p["line"] or 0, []).append(p["slug"])
        if e.get("hypoteza"):
            byline = {e.get("rod", 0): []}
        if not byline:
            continue
        yrs = [int(y) for p in hits for y in re.findall(r"\b1[4-9]\d\d\b", p["y"] or "")]
        places.append(dict(name=name, lat=e["lat"], lon=e["lon"], lines=[dict(k=k, people=v) for k, v in sorted(byline.items())],
                           years=[min(yrs), max(yrs)] if yrs else None, hypothesis=bool(e.get("hypoteza"))))

    # Domy rodiny: zpracované dějiny z data/domy.py (export_web_domy.py) + ostatní domy z pole `bydliste`
    # (data/domy_rodiny.json, generuje tools/domy_rodiny.py). Adresa domu: /dum/<obec>-<čp>/.
    import importlib.util
    spec = importlib.util.spec_from_file_location("export_web_domy", os.path.join(TOOLS, "export_web_domy.py"))
    ewd = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ewd)
    hns = ewd.load_houses()
    village_name = hns["OBEC"].get("nazev", "")
    house_slug = lambda obec, cp: slugify(f"{obec} {cp}")
    houses = {}
    # domy.py: dům bez pole `obec` patří do OBEC (village_name), jinak má vlastní obec= a cp= (klíč „Obec čp“)
    for h in ewd.build_houses(hns["D"], recs, docs_cfg, village_name).values():
        for x in h["owners"] + h["people"]:
            x["person"] = (lambda s: s if s in people else None)(ref(x.pop("k", None)))
        h.update(slug=house_slug(h["obec"], h["cp"]), processed=True, family=[], approx=False)
        houses[h["slug"]] = h
    place_xy = {n: (e["lat"], e["lon"]) for n, e in jload("mista.json", {}).items() if "lat" in e}
    house_xy = {k: v for k, v in jload("polohy_domu.json", {}).items() if isinstance(v, dict)}
    for h in houses.values():   # zpracovaný dům bez polohy v domy.py → data/polohy_domu.json, jinak střed obce
        h["center"] = False
        if h.get("lat") is None:
            exact = house_xy.get(f"{h['obec']} {h['cp']}", {})
            if "lat" in exact:
                h["lat"], h["lon"], h["approx"] = exact["lat"], exact["lon"], bool(exact.get("nejiste"))
            elif place_xy.get(h["obec"]):
                (h["lat"], h["lon"]), h["approx"], h["center"] = place_xy[h["obec"]], True, True
    for d in jload("domy_rodiny.json", []):
        slug = house_slug(d["obec"], d["cp"])
        if slug not in houses:
            exact = house_xy.get(f"{d['obec']} {d['cp']}", {})
            if "lat" in exact:   # přesná poloha domu z data/polohy_domu.json (RÚIAN), jinak střed obce
                xy, approx, center = (exact["lat"], exact["lon"]), bool(exact.get("nejiste")), False
            else:
                xy, approx, center = place_xy.get(d["obec"]), True, True
            houses[slug] = dict(slug=slug, obec=d["obec"], cp=str(d["cp"]), name="", processed=False, approx=approx, center=center,
                                lat=xy[0] if xy else None, lon=xy[1] if xy else None, family=[])
        fam = houses[slug]["family"]
        for o in d["osoby"]:
            s = ref(o.get("osoba"))
            if s not in people:
                continue
            fam.append(dict(person=s, role=o.get("role", ""), since=o.get("od"), until=o.get("do"),
                            records=[r for r in o.get("zdroj", []) if r in recs]))
    for h in houses.values():
        h["family"].sort(key=lambda f: (f["since"] or 9999, people[f["person"]]["k"] or 10 ** 12))
        h["ancestors"] = list(dict.fromkeys(f["person"] for f in h["family"]))
    houses = dict(sorted(houses.items(), key=lambda kv: (not kv[1]["processed"], kv[1]["obec"],
                                                        int(re.match(r"\d*", kv[1]["cp"]).group(0) or 99999))))
    for p in people.values():
        p["homes"] = []
    for i, pp in O.items():
        s = pp.get("tataz") or i
        if s not in people:
            continue
        for b in pp.get("bydliste", []):
            hs = house_slug(b.get("obec", ""), b.get("cp", ""))
            people[s]["homes"].append(dict(house=hs if hs in houses else None, obec=b.get("obec", ""), cp=str(b.get("cp", "")),
                                           since=b.get("od"), until=b.get("do"), role=b.get("role", ""),
                                           records=[r for r in b.get("zdroj", []) if r in recs]))
    for p in people.values():
        p["homes"].sort(key=lambda b: b["since"] or 9999)
        if p["homes"] and p["homes"][0]["obec"]:
            p["place"] = p["homes"][0]["obec"]
    house_maps = [dict(img=m["img"], year=str(m.get("rok", "")), title=m.get("nazev", ""), source=m.get("zdroj", ""),
                       url=m.get("url", ""), desc=m.get("popis", ""), group=m.get("skupina", ""),
                       full=os.path.exists(os.path.join(ZDROJE, m["img"] + ".jpg")), obec=m.get("obec") or village_name)
                  for m in jload("mapy.json", []) if os.path.exists(os.path.join(VYREZY, m["img"] + ".jpg"))]
    house_maps.sort(key=lambda m: ewd.year_key(m["year"]))
    for h in houses.values():   # mapy z mapy.json patří obci z pole „obec“ (chybí-li, OBEC z domy.py) – jen zpracované domy té obce
        h["maps"] = [m for m in house_maps if m["obec"] == h["obec"]] if h["processed"] else []

    house_refs = {}
    for h in houses.values():
        for r in h.get("records", []) + [r for f in h["family"] for r in f["records"]]:
            house_refs.setdefault(r, []).append(h["slug"])
    for r in records:
        r["houses"] = list(dict.fromkeys(house_refs.get(r["key"], [])))

    # obce: stránka /misto/<obec>/ pro každé místo na mapě a každou obec s domem rodiny
    mista = jload("mista.json", {})
    villages = {}
    for name in dict.fromkeys([x["name"] for x in places] + [h["obec"] for h in houses.values() if h["obec"]]):
        rx = re.compile(mista.get(name, {}).get("re") or re.escape(name))
        pl = next((x for x in places if x["name"] == name), None)
        hs = [h["slug"] for h in houses.values() if h["obec"] == name]
        ppl = byorder(s for s, p in people.items() if p["place"] == name or any(b["obec"] == name for b in p["homes"])
                      or rx.search(" ".join(p["facts"])))
        lks = sorted({x["k"] for x in pl["lines"]} if pl else set()) + [people[s]["line"] for s in ppl]
        vrec = [r["key"] for r in records if rx.search(r["title"] + " " + r["summary"]) or set(r["houses"]) & set(hs)]
        villages[slugify(name)] = dict(slug=slugify(name), name=name, lat=pl["lat"] if pl else None, lon=pl["lon"] if pl else None,
                                       lines=[l["slug"] for k in dict.fromkeys(lks) for l in lines.values() if l["k"] == k],
                                       people=ppl, houses=hs, records=vrec, years=pl["years"] if pl else None)
    for x in places:
        x["slug"] = slugify(x["name"])
    for h in houses.values():
        h["obecSlug"] = slugify(h["obec"]) if slugify(h["obec"]) in villages else None
    for p in people.values():
        p["placeSlug"] = slugify(p["place"]) if p["place"] and slugify(p["place"]) in villages else None
        for b in p["homes"]:
            b["obecSlug"] = slugify(b["obec"]) if slugify(b["obec"]) in villages else None

    # otevřené otázky (ISSUES) – volitelně navázané na osoby a rody: (otázka, odpověď, dict(osoby=[…], rody=[…]))
    issues, bad = [], []
    for i in ISSUES:
        if isinstance(i, str):
            i = (i, "")
        extra = i[2] if len(i) > 2 else {}
        ip = [g.id_osoby(x, ROOT_KEY) if not isinstance(x, str) else x for x in extra.get("osoby", [])]
        bad += [f"osoba {x}" for x in ip if x not in people] + [f"rod {x}" for x in extra.get("rody", []) if x not in lines]
        issues.append(dict(title=i[0], text=i[1], people=ip, lines=list(extra.get("rody", []))))
    if bad:
        sys.exit("CHYBA: ISSUES v data/osoby.py odkazují na neexistující " + ", ".join(bad))

    known = [p for p in people.values() if p["k"] and p["k"] > 1]
    stats = dict(houses=len(houses), housesDone=sum(h["processed"] for h in houses.values()), ancestors=len(known), documented=sum(p["st"] == "doc" for p in known), records=len(records),
                 generations=max(p["gen"] for p in people.values() if p["gen"] is not None) + 1, people=len(people))
    hypotheses = [dict(line=h.get("rod"), title=h.get("nadpis", "Hypotéza"), text=h.get("text", ""),
                       items=[dict(name=a, text=b) for a, b in h.get("polozky", [])],
                       records=[r for r in h.get("zaznamy", []) if r in recs]) for h in leg["HYPOTEZY"]]

    has_story = any(os.path.exists(os.path.join(DATA, f)) for f in ("pribeh.md", "pribeh_domy.md"))
    public_cfg = {k: v for k, v in cfg.items() if k != "prihlaseni"}
    public_cfg["maPribeh"] = has_story
    has_house_story = os.path.exists(os.path.join(DATA, "pribeh_domy.md"))
    # příběh domu (data/pribeh_domy.md) patří jen hlavnímu domu z web_domy.json, ne každému zpracovanému domu
    story_house = house_slug(village_name, jload("web_domy.json", {}).get("hlavni_dum", ""))
    public_cfg["pribehDum"] = story_house if story_house in houses and has_house_story else None
    # oba příběhy zvlášť: /pribeh-rodu/ = příběh rodu (pribeh.md, jinak příběh domu), /pribeh-domu/ = příběh domu, když jsou oba
    public_cfg["pribehDomuStranka"] = has_house_story and os.path.exists(os.path.join(DATA, "pribeh.md"))
    # další příběhy (např. jednoho rodu) z web.json „pribehy“: [{slug, titulek, soubor}] → /pribeh/<slug>/
    extra_stories = []
    for x in cfg.get("pribehy", []):
        if not re.fullmatch(r"[a-z0-9-]+", x.get("slug", "")):
            sys.exit(f"CHYBA: web.json „pribehy“: neplatný slug {x.get('slug')!r} (jen a-z, 0-9, pomlčka)")
        if os.path.exists(os.path.join(DATA, x["soubor"])):
            extra_stories.append(dict(slug=x["slug"], titulek=x.get("titulek") or x["slug"], soubor=x["soubor"]))
        else:
            print(f"POZOR: příběh {x['slug']} – soubor data/{x['soubor']} neexistuje, stránka se nevytvoří")
    public_cfg["pribehy"] = [dict(slug=x["slug"], titulek=x["titulek"]) for x in extra_stories]
    gen_dir = os.path.join(WEB, "src", "generated")
    def house_links(text):   # odkazy z dějin domu (/dum/12/) → adresy společného webu (/dum/horni-lhota-12/)
        return re.sub(r"/dum/([^/\s)\"'#?<>\]]+)/", lambda m: f"/dum/{house_slug(village_name, m.group(1))}/"
                      if house_slug(village_name, m.group(1)) in houses else m.group(0), text)

    def md(name):
        path = os.path.join(DATA, name)
        text = open(path, encoding="utf-8").read() if os.path.exists(path) else ""
        return strip_comments(re.sub(r"^# .*\n", "", text, count=1))

    # Wiki odkazy v příbězích a zajímavostech: [[osoba:id]], [[osoba:id|popisek]], [[dum:obec-cp]], [[zdroj:klic]],
    # [[rod:slug]], [[misto:Obec]]. Export je rozbalí na markdown odkazy; neplatný cíl zastaví export.
    # Zároveň vzniká zpětný index „Zmíněno v příběhu“ (osoba, dům, zápis) s kotvou odstavce.
    wiki_rx = re.compile(r"\[\[(osoba|dum|zdroj|rod|misto):([^\]|]+?)(?:\|([^\]]+))?\]\]")
    mentions = dict(osoba={}, dum={}, zdroj={})
    wiki_err = []

    def wiki_target(kind, x):
        if kind == "osoba" and x in people:
            return x, people[x]["name"]
        if kind == "dum" and x in houses:
            return x, f"{houses[x]['obec']} čp. {houses[x]['cp']}"
        if kind == "zdroj" and x in recs:
            return x, recs[x]["title"]
        if kind == "rod" and x in lines:
            return x, f"rod {lines[x]['name']}"
        if kind == "misto" and slugify(x) in villages:
            return slugify(x), villages[slugify(x)]["name"]
        return None

    def render(text, fname, page=None):
        """Rozbalí wiki odkazy; page=(adresa, název) → zapíše zmínky do zpětného indexu a doplní kotvy odstavců."""
        front = re.match(r"---\n.*?\n---\n", text, re.S)
        head, body = (front.group(0), text[front.end():]) if front else ("", text)
        title = (re.search(r"^title:\s*(.+)$", head, re.M).group(1).strip().strip("'\"") if "title:" in head else None) \
            or (page[1] if page else "")
        out, heading, n = [], None, 0
        for block in body.split("\n\n"):
            for line in block.split("\n"):
                hm = re.match(r"#{1,6}\s+(.*)", line)
                if hm:
                    heading = hm.group(1).strip()
            found = []

            def rep(m):
                kind, x, label = m.group(1), m.group(2).strip(), m.group(3)
                t = wiki_target(kind, x)
                if not t:
                    wiki_err.append((fname, m.group(0)))
                    return m.group(0)
                return f"[{label or t[1]}](/{kind}/{t[0]}/)"
            block = wiki_rx.sub(rep, block)
            found = [(m.group(1), m.group(2)) for m in re.finditer(r"\]\(/(osoba|dum|zdroj)/([^/\s)#?]+)/\)", block)]
            if page and found:
                n += 1
                aid = f"odst-{n}"
                lines_ = block.split("\n")
                plain = [j for j, l in enumerate(lines_) if l.strip() and not re.match(r"#{1,6}\s|<", l)]
                j = plain[0] if plain else 0
                pre = re.match(r"(#{1,6}\s+|\s*(?:[-*+]|\d+\.)\s+|>\s*)?", lines_[j]).group(0)
                lines_[j] = f'{pre}<span id="{aid}" class="kotva"></span>{lines_[j][len(pre):]}'
                block = "\n".join(lines_)
                for kind, x in dict.fromkeys(found):
                    lst = mentions[kind].setdefault(x, [])
                    if not any(e["page"] == title and e["section"] == heading for e in lst):
                        lst.append(dict(href=f"{page[0]}#{aid}", page=title, section=heading))
            out.append(block)
        return head + "\n\n".join(out)

    def story(name, empty):
        path = os.path.join(DATA, name)
        return house_links(strip_comments(open(path, encoding="utf-8").read())) if os.path.exists(path) else empty
    for src, dst in (("archivni_dotazy.md", "dotazy.md"), ("research_log.md", "denik.md")):
        write(os.path.join(gen_dir, dst), md(src))
    # zajímavosti z rodokmenu i z dějin domů na jedné stránce (duplicity se hlídají v datech, ne tady)
    write(os.path.join(gen_dir, "zajimavosti.md"), render(md("zajimavosti.md").rstrip() + "\n\n" + house_links(md("zajimavosti_domy.md")).strip() + "\n",
                                                          "zajimavosti.md", ("/zajimavosti/", "Zajímavosti")))
    main_story = "pribeh.md" if os.path.exists(os.path.join(DATA, "pribeh.md")) else "pribeh_domy.md"
    write(os.path.join(gen_dir, "pribeh.md"), render(story(main_story, "---\ntitle: Příběh\nlead: ''\n---\n"), main_story, ("/pribeh-rodu/", "Příběh")))
    write(os.path.join(gen_dir, "pribeh_domu.md"), render(story("pribeh_domy.md", "---\ntitle: Příběh domu\nlead: ''\n---\n"), "pribeh_domy.md",
                                                          ("/pribeh-domu/", "Příběh domu") if public_cfg["pribehDomuStranka"] else None))
    story_dir = os.path.join(gen_dir, "pribehy")
    shutil.rmtree(story_dir, ignore_errors=True)
    os.makedirs(story_dir, exist_ok=True)
    for x in extra_stories:
        write(os.path.join(story_dir, x["slug"] + ".md"),
              render(story(x["soubor"], f"---\ntitle: {x['titulek']}\nlead: ''\n---\n"), x["soubor"], (f"/pribeh/{x['slug']}/", x["titulek"])))
    # karty zajímavostí na úvodu vedou na kotvu nadpisu (id jako github-slugger v Astru); kotva = text nadpisu, jinak začátek nadpisu = nadpis karty
    zaj = open(os.path.join(gen_dir, "zajimavosti.md"), encoding="utf-8").read()
    heads = [h.strip() for h in re.findall(r"^#{2,3}\s+(.*)$", zaj, re.M)]
    gh_slug = lambda t: re.sub(r"\s", "-", re.sub(r"[^\w\s-]", "", re.sub(r"<[^>]+>", "", t).lower()))
    for c in public_cfg.get("zajimavosti_na_uvodu", []):
        want = c.get("kotva") or c.get("nadpis", "")
        h = next((h for h in heads if h == want), None) or next((h for h in heads if h.startswith(want)), None)
        c["href"] = "/zajimavosti/" + (f"#{gh_slug(h)}" if h else "")
        if not h:
            print(f"POZOR: karta zajímavosti „{want}“ v data/web.json nemá nadpis v zajímavostech – doplňte pole kotva")
    if wiki_err:
        for f, link in dict.fromkeys(wiki_err):
            print(f"CHYBA: neplatný odkaz {link} v data/{f} – cíl neexistuje (adresy stránek jsou ve web/src/data/site.json)", file=sys.stderr)
        sys.exit(1)
    for s_, p in people.items():
        p["mentions"] = mentions["osoba"].get(s_, [])
    for s_, h in houses.items():
        h["mentions"] = mentions["dum"].get(s_, [])
    for r in records:
        r["mentions"] = mentions["zdroj"].get(r["key"], [])

    # galerie příběhu: dokument patří příběhu, když v něm vystupuje osoba z dokumentu (odkaz [[osoba:…]]),
    # nebo když ho příběh jmenuje v poli „pribeh“ dokumentu (pribehy | pribeh-domu | slug z web.json „pribehy“, i seznam)
    story_files = {"pribehy": "pribeh.md", "pribeh-domu": "pribeh_domu.md", **{x["slug"]: os.path.join("pribehy", x["slug"] + ".md") for x in extra_stories}}
    story_people = {k: set(re.findall(r"\]\(/osoba/([^/\s)#?]+)/\)", open(os.path.join(gen_dir, f), encoding="utf-8").read()))
                    for k, f in story_files.items()}

    def doc_stories(d):
        want = d.get("pribeh") or []
        want = [want] if isinstance(want, str) else list(want)
        for k in want:
            if k not in story_files:
                print(f"POZOR: dokument {d['img']} v data/dokumenty.json má neznámý příběh „{k}“ (možné: {', '.join(story_files)})")
        return [k for k in story_files if k in want or story_people[k] & set(doc_people(d))]

    site = dict(config=public_cfg, places=places, houses=houses, root=root_id, roots=[dict(key=key, id=i, name=O[i]["n"]) for key, i in g.koreny.items() if i in people],
                aliases={a: kslug[a] for a in SAME if a in kslug}, people=people,
                families=families, records=records, lines=lines, milestones=jload("milniky.json", []),
                villages=villages, issues=issues, stats=stats, hypotheses=hypotheses,
                docs=[dict(img=d["img"], caption=d["popis"], people=doc_people(d), stories=doc_stories(d))
                      for d in docs_cfg if os.path.exists(os.path.join(VYREZY, d["img"] + ".jpg"))])

    write(os.path.join(WEB, "src", "data", "site.json"), json.dumps(site, ensure_ascii=False, indent=1))

    # vějíř pro každý kořen: fan.svg = výchozí kořen, fan-<klíč>.svg = ostatní (vějíř volí ?o=<id>)
    for f in os.listdir(gen_dir):
        if re.match(r"fan-.+\.svg$", f):
            os.remove(os.path.join(gen_dir, f))
    hrefs = os.path.join(gen_dir, "fan_hrefs.json")
    for key, rid in g.koreny.items():
        if rid not in people:
            continue
        json.dump({k: f"/osoba/{i}/" for k, i in g.kekule(key).items() if i in people}, open(hrefs, "w", encoding="utf-8", newline="\n"))
        out = os.path.join(gen_dir, "fan.svg" if key == ROOT_KEY else f"fan-{key}.svg")
        subprocess.run([sys.executable, "-I", "-X", "utf8", os.path.join(TOOLS, "fan_chart.py"),
                        out, "--web", hrefs, "--koren", key], check=True, capture_output=True)

    gated = login_files(cfg)

    copied = 0
    zv = os.path.join(DATA, "zvyrazneni.json")
    hl_mtime = os.path.getmtime(zv) if os.path.exists(zv) else 0
    for sub, src_dir in (("img", VYREZY), ("zdroje", ZDROJE)):
        dst_dir = os.path.join(WEB, "public", sub)
        os.makedirs(dst_dir, exist_ok=True)
        for key in list(recs) + [d["img"] for d in docs_cfg] + [m["img"] for m in house_maps] + ([cfg["uvod"]["foto"]] if cfg.get("uvod", {}).get("foto") else []):
            src = os.path.join(src_dir, key + ".jpg")
            dst = os.path.join(dst_dir, key + ".jpg")
            if not os.path.exists(src):
                continue
            boxes = hl.get(key, {}).get("boxes", [])
            stale = not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst) \
                or (sub == "zdroje" and boxes and hl_mtime > os.path.getmtime(dst))
            if not stale:
                continue
            if sub == "zdroje" and boxes and draw_boxes(src, dst, boxes, os.path.join(VYREZY, key + ".jpg")):
                copied += 1
                continue
            shutil.copy2(src, dst)
            copied += 1
    print(f"{len(people)} osob, {len(families)} rodin, {len(records)} zápisů, {len(lines)} rodů, {len(places)} míst; "
          f"zkopírováno {copied} obrázků; přihlášení {'zapnuté' if gated else 'VYPNUTÉ (web je otevřený)'}")

    # odkazy v textech, které nikam nevedou (adresa osoby se změní třeba doplněním roku narození: jan-novak → jan-novak-1798)
    targets = dict(osoba=people, zdroj=recs, rod=lines, rodina=families, dum=houses)
    texts = {f: open(os.path.join(gen_dir, f), encoding="utf-8").read()
             for f in ("pribeh.md", "pribeh_domu.md", "zajimavosti.md", *(os.path.join("pribehy", x["slug"] + ".md") for x in extra_stories))}
    texts["web.json"] = json.dumps(cfg, ensure_ascii=False)
    texts["osoby.py (hypotézy)"] = json.dumps(hypotheses, ensure_ascii=False)
    broken = [(f, m.group(0)) for f, t in texts.items()
              for m in re.finditer(r"/(osoba|zdroj|rod|rodina|dum)/([^/\s)\"'#?<>\]]+)", t) if m.group(2) not in targets[m.group(1)]]
    for f, link in dict.fromkeys(broken):
        print(f"POZOR: nefunkční odkaz {link}/ v {f} – oprav ho (adresy stránek jsou ve web/src/data/site.json)")


if __name__ == "__main__":
    main()
