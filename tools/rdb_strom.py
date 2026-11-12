#!/usr/bin/env python3
"""Předci z API v jednoduchém tvaru pro nástroje, které pracují s Kekulého čísly (napady.py, fan_chart.py).

    import rdb_strom
    s = rdb_strom.predci(koren=None)   # koren = id osoby; výchozí = nastavení „vychozi_koren“, jinak přihlášený
    s["P"][k]    -> {"id", "n" (jméno), "y" (roky), "st" (jistota), "sex", "note", "f" ([fakta]), "bydliste" ([...])}
    s["SAME"][k] -> Kekulé první pozice téže osoby (předek v rodokmenu vícekrát)
    s["LINES"][k]-> (název rodu, popis) pro zakladatele rodu na pozici k
    s["ids"][id] -> první Kekulé osoby
Fakta: „* 12. 3. 1850 Lhota“, „* (křest) …“, „× 1875 Lhota (s Anna Dvořáková)“, „† 1910 Lhota“, povolání jako text,
„bydliště Lhota čp. 12 1875–1910“. Bere jen události, kde je osoba hlavní (ne kmotr, rodič dítěte…).
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rdb_klient as api

SYMBOL = {"narozeni": "*", "krest": "* (křest)", "snatek": "×", "umrti": "†", "pohreb": "† (pohřeb)"}
VLASTNI = {"hlavni", "zenich", "nevesta", "manzel", "manzelka", "snoubenec", "snoubenka"}


def vychozi_koren():
    try:
        return (api.get("nastaveni") or {}).get("vychozi_koren")
    except api.ChybaAPI:
        return None


def _fakta(d, mista, jmena):
    f = []
    for e in sorted(d.get("events", []), key=lambda e: (e.get("yearFrom") or 9999, e.get("month") or 0, e.get("day") or 0)):
        if e.get("role", "hlavni") not in VLASTNI:
            continue
        misto = e.get("placeText") or mista.get(e.get("placeSlug"), e.get("placeSlug") or "")
        if e["type"] in SYMBOL:
            s = " ".join(x for x in (SYMBOL[e["type"]], e.get("dateText") or "", misto) if x)
            if e["type"] == "snatek":
                druzi = [jmena.get(p["personId"], p["personId"]) for p in e.get("persons", []) if p["personId"] != d["id"]]
                if druzi:
                    s += f" (s {', '.join(druzi)})"
            if e.get("text"):
                s += f"; {e['text']}"
            f.append(s)
        elif e.get("text"):
            f.append(e["text"] + (f" ({e['dateText']})" if e.get("dateText") else ""))
    for b in d.get("residences", []):
        misto = b.get("placeText") or mista.get(b.get("placeSlug"), b.get("placeSlug") or "")
        obd = "–".join(x for x in (b.get("fromText") or "", b.get("toText") or "") if x)
        f.append(" ".join(x for x in ("bydliště", misto, f"čp. {b['cp']}" if b.get("cp") else "", obd, b.get("role") or "") if x))
    return f


def predci(koren=None):
    koren = koren or vychozi_koren()
    kek = sorted(api.get("graf/kekule", koren=koren), key=lambda x: x["k"])
    if not kek:
        raise api.ChybaAPI(f"Osoba {koren} nemá v grafu žádné předky (nebo neexistuje).")
    det = api.detaily_osob(x["id"] for x in kek)
    mista = {m["slug"]: m["name"] for m in api.get("mista")}
    jmena = {x["id"]: x["name"] for x in api.get("osoby")}
    ids, P, SAME = {}, {}, {}
    for x in kek:
        k, i = x["k"], x["id"]
        if i in ids:
            SAME[k] = ids[i]
            P[k] = dict(P[ids[i]], f=[f"viz č. {ids[i]} – tatáž osoba"])
            continue
        ids[i] = k
        d = det[i]
        P[k] = {"id": i, "n": api.jmeno(d), "y": d.get("yearsText") or "", "st": d.get("certainty"), "sex": d.get("sex"),
                "note": d.get("note") or "", "f": _fakta(d, mista, jmena), "bydliste": d.get("residences", [])}
    LINES = {}
    for r in api.get("rody")["rody"]:
        k = ids.get(r.get("founderId"))
        if k is not None:
            LINES[k] = (r["name"], r.get("description") or "")
    return {"P": P, "SAME": SAME, "LINES": dict(sorted(LINES.items())), "ids": ids, "koren": kek[0]["id"]}
