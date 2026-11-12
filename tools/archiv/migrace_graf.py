#!/usr/bin/env python3
"""Jednorázová migrace data/osoby.py ze starého formátu (P klíčované Kekulého číslem, LINES, SIDE,
HYPOTEZY s rod=<Kekulé>, SAME) do grafového formátu (OSOBY klíčované trvalým id, VZTAHY, RODY, KORENY).

Deterministická: stejný vstup → stejný výstup. Id osoby = dnešní slug z webu (URL /osoba/<id>/ se nemění).

  python3 tools/migrace_graf.py                 # přepíše data/osoby.py (jen pokud je ve starém formátu)
  python3 tools/migrace_graf.py STARY.py NOVY.py
Po migraci ověří, že graf.legacy() vrací přesně původní P, LINES, SIDE, ISSUES, HYPOTEZY, SAME.
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # tools/archiv/ → kořen projektu
sys.path.insert(0, os.path.join(ROOT, "tools"))


def slugify(text):
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def placeholder(p):
    return p["n"].startswith(("otec neuveden", "matka neuvedena")) or p["n"] in ("", "?")


def lit(v):
    """Python literál ve stylu osoby.py: dict(k=…), řetězce v dvojitých uvozovkách."""
    if isinstance(v, dict):
        return "dict(" + ", ".join(f"{k}={lit(x)}" for k, x in v.items()) + ")"
    if isinstance(v, (list, tuple)):
        inner = ", ".join(lit(x) for x in v)
        return f"({inner}{',' if len(v) == 1 else ''})" if isinstance(v, tuple) else f"[{inner}]"
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    return repr(v)


HEADER = '''# Osoby a vztahy rodokmenu jako GRAF. Identita osoby = trvalé id (slug), ne Kekulého číslo.
# Kekulého čísla („č. 64“ v poznámkách) se počítají z grafu pro zvolený kořen (KORENY) – jen pro zobrazení
# (vějíř, rody, přehled předků). Výpis čísel: python3 tools/graf.py cisla [koren]
#
# OSOBY = {id: dict(n=…, sex="M"/"F", y=…, st=…, f=[…], r=[…], note=…, bydliste=[…])}
#   id   malými písmeny bez diakritiky: jmeno-prijmeni-rok (např. "jan-novak-1890"); po založení se NEMĚNÍ
#        (je v URL /osoba/<id>/). Kolize → přidat pomlčku a číslo.
#   n    jméno; ženy rodným příjmením („Anna Dvořáková“), u nejistého čtení otazník („Marie Špalková (?)“)
#   sex  "M" / "F" – povinné (dřív plynulo z čísla)
#   y    roky života pro přehledy: "* 1931" (žije / úmrtí neznámé), "1850–1910", "asi 1720–1785", "1680 – před 1740"
#   st   stav doložení:  doc  = doloženo matrikou (čteno přímo ze snímku)
#                        prob = pravděpodobné (shoda údajů, ale ne přímý doklad)
#                        fam  = údaj od rodiny / z rodinného dokumentu
#                        mh   = jen z cizího rodokmenu na internetu (MyHeritage, Geni…) – neověřeno
#                        unk  = neznámé (jen místo v rodokmenu)
#   f    fakta jako krátké věty: "* 12. 3. 1873 Hořice čp. 477", "kovář", "× 28. 1. 1897 Anna Stejskalová", "† 14. 5. 1902"
#        (* narození, × sňatek, † úmrtí – podle těchto značek web pozná sňatky a místa pro mapu)
#   r    klíče zápisů z data/zaznamy.json, které osobu dokládají
#   note poznámka: proč je údaj nejistý, rozpory, odkud se vzal
#   bydliste  volitelně: kde osoba žila – seznam dict(obec, cp, od, do, role, zdroj=[klíče ze zaznamy.json]);
#        jen z doložených faktů, nejisté s (?); zdroj "rodina" = údaj od rodiny (udaje_od_rodiny.md).
#        Klíč (obec, cp) propojuje rodokmen s dějinami domů (tools/domy_rodiny.py).
#   druh "bocni" = souhrnný záznam o bočních příbuzných (dřív SIDE): n = nadpis, t = text; na webu
#        se ukáže u osoby, ke které vede vztah t="pribuzny". Lepší je zakládat boční příbuzné jako
#        normální osoby s hranami rodic/manzele (sourozenec = stejní rodiče).
#   tataz id jiné osoby: tentýž člověk zapsaný podruhé (předek v rodokmenu vícekrát, dřív SAME) –
#        nese jen údaje k druhému výskytu; hrany vedou z hlavní osoby.
# Žijící lidé: jen jméno a rok narození (soukromí), note="Žijící – údaje jen základní."
# Neznámý otec nemanželského dítěte: osoba n="otec neuveden", st="unk" s hranou rodic (na webu bez stránky).
'''

HEADER_VZTAHY = '''
# Hrany grafu. Pořadí nehraje roli; jedna hrana na řádek.
#   dict(t="rodic", a=<rodič>, b=<dítě>)                       – otec/matka podle sex rodiče
#   dict(t="manzele", a=<muž>, b=<žena>)                       – manželství (rodiče společného dítěte)
#   dict(t="kmotr", a=<kmotr>, b=<křtěnec>) / dict(t="svedek", a=<svědek>, b=<ženich nebo nevěsta>)
#   dict(t="pribuzny", a=<boční záznam>, b=<osoba>)            – volná vazba (dřív SIDE k=…)
# Volitelně u každé hrany: st="doc"/"prob"/… (jistota vazby; bez st platí jistota osob),
# r=[klíče zápisů], datum="…", note="…". Sourozenci, strýcové ap. se NEZAPISUJÍ – plynou z rodičů.
'''


def migrate(ns):
    P, LINES, SIDE, ISSUES, HYP, SAME = (ns.get(x, d) for x, d in (("P", {}), ("LINES", {}), ("SIDE", []),
                                                                       ("ISSUES", []), ("HYPOTEZY", []), ("SAME", {})))
    # 1) id = slug přesně jako tools/export_web.py (původní algoritmus)
    ids, used = {}, set()
    for k in sorted(P):
        p = P[k]
        if placeholder(p) or k in SAME:
            continue
        yv = (p.get("y") or "").strip()
        ys = [] if yv.startswith(("?", "†")) else re.findall(r"\d{4}", yv)
        s = slugify(p["n"] + (" " + ys[0] if ys else ""))
        if s in used or not s:
            s = f"{s}-{k}"
        used.add(s)
        ids[k] = s
    for k in sorted(P):                      # neznámí rodiče (placeholder) – id odvozené z dítěte
        if k not in ids and k not in SAME:
            s = slugify(P[k]["n"]) + "-" + ids.get(k // 2, str(k))
            assert s not in used, s
            used.add(s)
            ids[k] = s
    canon = lambda k: SAME.get(k, k)
    for a, c in sorted(SAME.items()):        # druhý výskyt téže osoby
        ids[a] = f"{ids[c]}-vyskyt-{a}"
        # pod aliasem nesmí být další předci (graf by je napojil na hlavní osobu)
        assert not any(x in P for x in (2 * a, 2 * a + 1)), f"alias {a} má předky – migrace to neumí"

    # 2) osoby
    osoby = {}
    for k in sorted(P):
        p = dict(P[k])
        sex = p.pop("sex", None) if k == 1 else None
        sex = sex or ("M" if k == 1 else ("M" if k % 2 == 0 else "F"))
        d = dict(n=p.pop("n"), sex=sex)
        if k == 1 and "sex" not in P[k]:
            d["_bez_sex"] = True              # původní P[1] sex neměl (default M) – kvůli bezztrátovosti
        d.update(p)
        if k in SAME:
            d["tataz"] = ids[SAME[k]]
        osoby[ids[k]] = (k, d)

    # 3) hrany
    vztahy = []
    for k in sorted(P):
        if k > 1:
            vztahy.append(dict(t="rodic", a=ids[canon(k)], b=ids[canon(k // 2)]))
    for k in sorted(P):
        if k > 1 and k % 2 == 0 and k + 1 in P:
            e = dict(t="manzele", a=ids[canon(k)], b=ids[canon(k + 1)])
            if e not in vztahy:
                vztahy.append(e)

    # 4) boční (SIDE) → uzly druh="bocni" + hrana pribuzny
    bocni = []
    for i, s in enumerate(SIDE):
        bid = "bocni-" + slugify(s["n"])
        if bid in osoby or bid in [b[0] for b in bocni]:
            bid += f"-{i}"
        d = dict(druh="bocni", n=s["n"], t=s["t"], r=list(s.get("r", [])))
        extra = {x: y for x, y in s.items() if x not in ("k", "n", "t", "r")}
        assert not extra, extra
        if "r" not in s:
            d["_bez_r"] = True
        bocni.append((bid, d))
        vztahy.append(dict(t="pribuzny", a=bid, b=ids[s["k"]]))

    # 5) rody: kořen rodu = osoba, ne číslo
    rody = {slugify(name): dict(nazev=name, popis=desc, zakladatel=ids[k]) for k, (name, desc) in sorted(LINES.items())}
    hyp = []
    for h in HYP:
        h = dict(h)
        h["rod"] = ids[h["rod"]]
        hyp.append(h)
    return ids, osoby, bocni, vztahy, rody, ISSUES, hyp


def render(osoby, bocni, vztahy, rody, issues, hyp, src_text):
    koren1 = next((oid for oid, (k, _) in osoby.items() if k == 1), None)
    out = [HEADER, "KORENY = {", f'    "hlavni": {lit(koren1)},   # výchozí osoba rodokmenu (č. 1)',
           '    # "manzelka": "<id>",            # druhý kořen – doplní se, až budou data o manželce',
           "}", "", "OSOBY = {"]
    for oid, (k, d) in osoby.items():
        out.append(f"    {lit(oid)}: {lit(d)},  # č. {k}")
    out.append("")
    out.append("    # --- boční příbuzní (dřív SIDE) ---")
    for bid, d in bocni:
        out.append(f"    {lit(bid)}: {lit(d)},")
    out.append("}")
    out.append(HEADER_VZTAHY)
    out.append("VZTAHY = [")
    for e in vztahy:
        out.append(f"    {lit(e)},")
    out.append("]")
    out.append("")
    out.append("# Rody = větve podle pradědečků a prababiček výchozí osoby: slug rodu → název, popis, zakladatel (id osoby).")
    out.append("RODY = {")
    for s, r in rody.items():
        out.append(f"    {lit(s)}: {lit(r)},")
    out.append("}")
    # ISSUES a HYPOTEZY: komentáře převzít ze zdroje
    m = re.search(r"(# Rozpory a otevřené otázky.*?)\nISSUES = \[", src_text, re.S)
    out.append("")
    out.append(m.group(1) if m else "")
    out.append("ISSUES = [")
    for x in issues:
        out.append(f"    {lit(x)},")
    out.append("]")
    out.append("")
    out.append("# Hypotézy o původu rodu nad rámec doložené linie (zobrazí se na stránce rodu); rod = id osoby (zakladatel větve):")
    out.append('# dict(rod="jan-novak-1890", nadpis="Hypotéza: …", text="…", polozky=[("Jan Novák", "kmotr 1681…")], zaznamy=["klic"])')
    out.append("HYPOTEZY = [")
    for h in hyp:
        out.append(f"    {lit(h)},")
    out.append("]")
    return "\n".join(out) + "\n"


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "osoby.py")
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    text = open(src, encoding="utf-8").read()
    ns = {}
    exec(text, ns)
    if "OSOBY" in ns:
        sys.exit("osoby.py už je v grafovém formátu – není co migrovat.")
    ids, osoby, bocni, vztahy, rody, issues, hyp = migrate(ns)
    new = render(osoby, bocni, vztahy, rody, issues, hyp, text)
    ns2 = {}
    exec(new, ns2)
    import graf
    g = graf.Graf(ns2)
    old = {x: ns.get(x, d) for x, d in (("P", {}), ("LINES", {}), ("SIDE", []), ("ISSUES", []), ("HYPOTEZY", []), ("SAME", {}))}
    leg = g.legacy()
    bad = [x for x in old if old[x] != leg[x]]
    if bad:
        for x in bad:
            if isinstance(old[x], dict):
                diff = sorted(set(old[x].items()) ^ set(leg[x].items()), key=str)[:5] if x != "P" else \
                    [(k, old[x].get(k), leg[x].get(k)) for k in sorted(set(old[x]) | set(leg[x])) if old[x].get(k) != leg[x].get(k)][:3]
            else:
                diff = [(a, b) for a, b in zip(old[x], leg[x]) if a != b][:3]
            print("ROZDÍL", x, diff)
        sys.exit("Migrace není bezztrátová – nic nezapsáno.")
    open(dst, "w", encoding="utf-8").write(new)
    print(f"Zapsáno {dst}: {len(osoby)} osob + {len(bocni)} bočních záznamů, {len(vztahy)} hran, {len(rody)} rodů, "
          f"{len(issues)} otázek, {len(hyp)} hypotéz. legacy() == původní P/LINES/SIDE/ISSUES/HYPOTEZY/SAME.")


if __name__ == "__main__":
    main()
