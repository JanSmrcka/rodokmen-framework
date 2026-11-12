#!/usr/bin/env python3
"""Místa pro mapu na webu: okolní body (kaple, mlýn, hamr, sousední ves) a poloha domů – ukládá se přes API.

Použití:
  mista.py hledej "dotaz"
      vypíše souřadnice z OpenStreetMap – pro dům zkus "Horní Lhota 12, Pelhřimov" (čísla domů OSM většinou zná),
      pro obec "Horní Lhota, Pelhřimov". Výsledek ulož přes API: dům = rdb.py dum pridej (lat/lon v JSON),
      obec = rdb.py misto pridej <slug> --lat … --lon …. Když OSM dům nezná, vezmi polohu z mapy (mapy.cz → pravé tlačítko → souřadnice).
  mista.py ruian "Horní Lhota 12"
      dům podle RÚIAN (ČÚZK, bez klíče; najde i malé osady, které OSM nezná): adresa s dnešní obcí, lat/lon,
      parcela pod domem a katastrální území. Patří do Fáze 0/1 – dnešní obec a k. ú. se často liší od toho,
      co uživatel čeká (osada patří k jiné obci, k. ú. má jméno sousední vsi). Dotaz = "Osada čp", "Ulice čp",
      "Ulice čp/čo" nebo ve městě i "Ulice čo" (číslo orientační, jak je na domě).
  mista.py okoli <"Ulice čp/čo" | lat,lon> [polomer_m=80]
      všechny dnešní adresy v okolí (RÚIAN) seřazené podle čp. – rohové domy mají dvě adresy; podklad pro tabulku
      adres domu v čase a pro rozlišení domů se stejnou starou adresou (reference/prameny.md → Čísla domů).
  mista.py pridej "Název" ["dotaz pro vyhledání"] ["popis na mapě"]
      založí / doplní bod v DB (slug z názvu, druh „bod“; výchozí dotaz = "Název, Česko")
  mista.py
      dohledá souřadnice u míst v DB, která je ještě nemají (OpenStreetMap Nominatim, 1 dotaz za sekundu),
      a vypíše seznam. Když bod nesedí: rdb.py misto pridej <slug> --lat … --lon …
"""
import json, math, os, sys, time, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

import rdb_klient as api


def geocode(q):
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 1})
    req = urllib.request.Request(url, headers={"User-Agent": "rodokmen-plus/1.0 (local history map, occasional geocoding)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    time.sleep(1.1)
    return (round(float(res[0]["lat"]), 5), round(float(res[0]["lon"]), 5), res[0]["display_name"]) if res else None


RUIAN = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer"


def ruian_q(vrstva, where, pole, geo=False):
    q = urllib.parse.urlencode({"where": where, "outFields": pole, "returnGeometry": str(geo).lower(),
                                "outSR": 4326, "f": "json"})
    with urllib.request.urlopen(f"{RUIAN}/{vrstva}/query?{q}", timeout=60) as r:
        return json.load(r).get("features", [])


def adresni_mista(dotaz, pole):
    """Adresní místa RÚIAN pro „Osada čp“, „Ulice čp“, „Ulice čp/čo“ i „Ulice čo“."""
    d = dotaz.replace(chr(39), "")
    adr = ruian_q(1, f"adresa LIKE '{d},%'", pole, True)
    ulice, _, cislo = d.rpartition(" ")
    if not adr and ulice and cislo.isdigit():   # „Ulice čo“ – v RÚIAN je „Ulice čp/čo, Část obce, …“
        adr = ruian_q(1, f"adresa LIKE '{ulice} %/{cislo},%'", pole, True)
    return adr


def ruian(dotaz):
    adr = adresni_mista(dotaz, "adresa,stavebniobjekt")
    if not adr:
        sys.exit(f"RÚIAN „{dotaz}“ nezná – zkus jiný tvar (\"Osada čp\", \"Ulice čp\") nebo jen \"Osada\" v nahlizenidokn.cuzk.cz")
    for a in adr[:5]:
        at, g = a["attributes"], a["geometry"]
        print(f"{at['adresa']}   lat={g['y']:.5f}, lon={g['x']:.5f}")
        so = ruian_q(3, f"kod={at['stavebniobjekt']}", "identifikacniparcela")
        if not so or not so[0]["attributes"].get("identifikacniparcela"):
            continue
        par = ruian_q(5, f"id={int(so[0]['attributes']['identifikacniparcela'])}",
                      "kmenovecislo,poddelenicisla,druhcislovanikod,katastralniuzemi")
        if par:
            pa = par[0]["attributes"]
            cislo = f"{pa['kmenovecislo']}" + (f"/{pa['poddelenicisla']}" if pa.get("poddelenicisla") else "")
            ku = ruian_q(7, f"kod={pa['katastralniuzemi']}", "nazev")
            print(f"   parcela {'st. ' if pa.get('druhcislovanikod') == 1 else ''}{cislo}, "
                  f"k. ú. {ku[0]['attributes']['nazev'] if ku else '?'} ({pa['katastralniuzemi']})")


def okoli(misto, polomer=80):
    if "," in misto and all(c in "0123456789., -" for c in misto):
        lat, lon = (float(v) for v in misto.split(","))
    else:
        f = adresni_mista(misto, "adresa")
        if not f:
            sys.exit(f"RÚIAN „{misto}“ nezná – zadej „Ulice čp/čo“ nebo lat,lon.")
        lat, lon = f[0]["geometry"]["y"], f[0]["geometry"]["x"]
        print("střed:", f[0]["attributes"]["adresa"])
    dlat = polomer / 111320
    dlon = dlat / math.cos(math.radians(lat))
    q = urllib.parse.urlencode({"geometry": f"{lon - dlon},{lat - dlat},{lon + dlon},{lat + dlat}",
                                "geometryType": "esriGeometryEnvelope", "inSR": 4326, "spatialRel": "esriSpatialRelIntersects",
                                "outFields": "adresa", "returnGeometry": "true", "outSR": 4326, "f": "json"})
    with urllib.request.urlopen(f"{RUIAN}/1/query?{q}", timeout=60) as r:
        feats = json.load(r).get("features", [])

    def cislo_popisne(adresa):   # „Ulice 12/3, Obec, …“ → 12
        c = adresa.split(",")[0].rsplit(" ", 1)[-1].split("/")[0]
        return int(c) if c.isdigit() else 0

    def metry(g):
        return round(math.hypot((g["y"] - lat) * 111320, (g["x"] - lon) * 111320 * math.cos(math.radians(lat))))
    rows = sorted((cislo_popisne(f["attributes"]["adresa"]), f["attributes"]["adresa"].split(",")[0], metry(f["geometry"]))
                  for f in feats)
    for c, a, m in rows:
        print(f"čp. {c:<6} {a:40} {m:>4} m")
    print(f"{len(rows)} adres do {polomer:g} m. Stejné čp. dvakrát = rohový dům se dvěma adresami.")


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "okoli":
        okoli(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 80)
        return
    if len(sys.argv) > 2 and sys.argv[1] == "ruian":
        ruian(sys.argv[2])
        return
    if len(sys.argv) > 2 and sys.argv[1] == "hledej":
        g = geocode(sys.argv[2])
        print(f"lat={g[0]}, lon={g[1]}   {g[2]}" if g else "NENALEZENO – zkus jiný dotaz nebo polohu z mapy")
        return
    if len(sys.argv) > 2 and sys.argv[1] == "pridej":
        name = sys.argv[2]
        api.uloz_misto(api.slugify(name), name=name, kind="bod",
                       query=sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else f"{name}, Česko",
                       description=sys.argv[4] if len(sys.argv) > 4 else None)
    mista = api.get("mista")
    for e in mista:
        if e.get("lat") is None:
            g = geocode(e.get("query") or f"{e['name']}, Česko")
            if g:
                e["lat"], e["lon"], e["osm"] = g
                api.uloz_misto(e["slug"], lat=g[0], lon=g[1], osm=g[2])
            else:
                print("NENALEZENO:", e["name"], "– uprav dotaz (rdb.py misto pridej", e["slug"], "--dotaz …) nebo zadej --lat/--lon")
    for e in mista:
        print(f"{e['slug']:24} {e['name']:24} {e.get('lat') or '?':>8} {e.get('lon') or '?':>8}  {(e.get('osm') or '')[:70]}")


if __name__ == "__main__":
    api.hlavni(main)
