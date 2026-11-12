#!/usr/bin/env python3
"""Domy rodiny: z bydlišť osob v databázi (přes API) sestaví seznam domů (obec, čp.), ve kterých předci žili.

Výstup: tabulka na stdout (fronta pro dějiny domů), s --json surová data; --ulozit uloží
pracovni/domy_rodiny.json a .md. Priorita domu = počet generací předků v domě × 10 + doložené roky.
„V DB“ = dům už má v databázi záznam (rdb.py dum ukaz <klic>). Související zápisy = zápisy, jejichž shrnutí
zmiňuje obec a čp., ale nejsou zdrojem bydliště (sourozenci, svědci).

Použití: python3 -I tools/domy_rodiny.py [--koren <id osoby>] [--json] [--ulozit]
Projde všechny osoby (jedno volání API na osobu) – u velkého stromu to chvíli trvá.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import rdb_klient as api, rdb_strom


def kmen(obec):   # jak se obec píše v zápisech (6. pád apod.)
    return obec[:-2] if len(obec) > 5 else obec


def main():
    a = sys.argv[1:]
    koren = a[a.index("--koren") + 1] if "--koren" in a else rdb_strom.vychozi_koren()
    prvni = {}
    for x in sorted(api.get("graf/kekule", koren=koren), key=lambda x: x["k"]):
        prvni.setdefault(x["id"], x["k"])
    osoby = api.get("osoby")
    det = api.detaily_osob(o["id"] for o in osoby)
    mista = {m["slug"]: m["name"] for m in api.get("mista")}
    domy_db = {(h["placeSlug"], str(h["cp"])): h["key"] for h in api.get("domy")}
    domy = {}
    for i, d in det.items():
        hlavni = d.get("sameAsId") or i
        k = prvni.get(hlavni)
        for b in d.get("residences", []):
            if not b.get("cp"):
                continue
            obec = b.get("placeText") or mista.get(b.get("placeSlug"), b.get("placeSlug") or "?")
            klic = (b.get("placeSlug") or api.slugify(obec), str(b["cp"]))
            x = domy.setdefault(klic, {"obec": obec, "osoby": [], "zdroje": set()})
            zdr = [s["recordKey"] for s in b.get("sources", []) if s.get("recordKey")]
            x["osoby"].append({"osoba": hlavni, "generace": k.bit_length() - 1 if k else None, "jmeno": api.jmeno(det.get(hlavni, d)),
                               "roky": (det.get(hlavni) or d).get("yearsText") or "", "role": b.get("role") or "",
                               "od": b.get("yearFrom"), "do": b.get("yearTo"), "zdroj": zdr})
            x["zdroje"].update(zdr)
    out = []
    for (slug, cp), d in domy.items():
        gen = sorted({o["generace"] for o in d["osoby"] if o["generace"] is not None})
        roky = [y for o in d["osoby"] for y in (o["od"], o["do"]) if y]
        let = max(roky) - min(roky) if roky else 0
        vzor = re.compile(rf"{re.escape(kmen(d['obec']))}\w*[^.;]*?čp\.\s*{re.escape(cp)}\b")
        souv = sorted(z["key"] for z in api.get("zaznamy", q=kmen(d["obec"]), limit=500)
                      if z["key"] not in d["zdroje"] and vzor.search(z.get("summary") or ""))
        out.append({"obec": d["obec"], "misto": slug, "cp": cp, "dum_v_db": domy_db.get((slug, cp)),
                    "priorita": len(gen) * 10 + let, "pocet_generaci": len(gen), "generace": gen,
                    "od": min(roky) if roky else None, "do": max(roky) if roky else None, "dolozeno_let": let,
                    "osoby": d["osoby"], "zdroje": sorted(d["zdroje"]), "souvisejici_zaznamy": souv})
    out.sort(key=lambda x: (-x["priorita"], x["obec"], x["cp"]))
    md = ["# Domy rodiny – fronta pro dějiny domů", "",
          "Generuje `tools/domy_rodiny.py` z bydlišť osob v databázi. Priorita = generace předků v domě × 10 + doložené roky.", "",
          "| # | dům | priorita | generací | doloženo | předci | v DB |", "|---|---|---|---|---|---|---|"]
    for n, d in enumerate(out, 1):
        lidi = "; ".join(f"{o['jmeno']} [{o['osoba']}] ({o['role']})" for o in d["osoby"])
        md.append(f"| {n} | {d['obec']} čp. {d['cp']} | {d['priorita']} | {d['pocet_generaci']} | "
                  f"{(str(d['od']) + '–' + str(d['do'])) if d['od'] else '?'} | {lidi} | {d['dum_v_db'] or ''} |")
    md += ["", "## Zdroje podle domů", ""]
    for d in out:
        md.append(f"- **{d['obec']} čp. {d['cp']}**: {', '.join(d['zdroje']) or '—'}"
                  + (f"; související: {', '.join(d['souvisejici_zaznamy'])}" if d["souvisejici_zaznamy"] else ""))
    if "--ulozit" in a:
        cil = os.path.join(api.ROOT, "pracovni")
        os.makedirs(cil, exist_ok=True)
        json.dump(out, open(os.path.join(cil, "domy_rodiny.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(os.path.join(cil, "domy_rodiny.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
    if "--json" in a:
        print(json.dumps(out, ensure_ascii=False, indent=1))
    else:
        print("\n".join(md))
        print(f"\n{len(out)} domů" + (" → pracovni/domy_rodiny.json, .md" if "--ulozit" in a else ""))


if __name__ == "__main__":
    api.hlavni(main)
