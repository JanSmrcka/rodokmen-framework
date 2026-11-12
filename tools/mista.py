#!/usr/bin/env python3
"""Místa předků pro mapu na webu – v databázi přes API (rdb.py misto …), tady jen geokódování.

Použití:
  mista.py pridej "Název" ["regulární výraz"] ["dotaz pro vyhledání"]
      založí / doplní místo (slug z názvu); výraz se hledá v údajích osob (výchozí = prvních 5 písmen názvu, aby sedělo
      i skloňování), dotaz pro OpenStreetMap (výchozí = "Název, Česko", když nic nenajde, zkusí Slovensko a další
      sousední země); historickou část obce, kterou mapa nezná, zadej jako celou obec; u víceznačných názvů (Podolí, Dub)
      přidej sousední obec: "Podolí, Odlochovice" – a ve výpisu vždy zkontroluj okres
  mista.py
      dohledá souřadnice u míst v DB, která je ještě nemají (OpenStreetMap Nominatim, 1 dotaz za sekundu),
      a vypíše seznam. Když bod nesedí, oprav ho: rdb.py misto pridej <slug> --lat … --lon …
Místo-hypotéza (rod jen tušený): rdb.py misto pridej <slug> --hypoteza. Staré a německé názvy: rdb.py misto nazev.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import rdb_klient as api


def geocode(q, zeme=None):
    par = {"q": q, "format": "json", "limit": 1} | ({"countrycodes": zeme} if zeme else {})
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(par)
    req = urllib.request.Request(url, headers={"User-Agent": "rodokmen-plus/1.0 (family genealogy map, occasional geocoding)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    time.sleep(1.1)
    return (round(float(res[0]["lat"]), 4), round(float(res[0]["lon"]), 4), res[0]["display_name"]) if res else None


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "pridej":
        name = sys.argv[2]
        stem = re.escape(name.split()[0][:5]) if len(name.split()) == 1 else re.escape(name)
        api.uloz_misto(api.slugify(name), name=name, kind="obec",
                       pattern=sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else stem,
                       query=sys.argv[4] if len(sys.argv) > 4 else f"{name}, Česko")
    mista = api.get("mista")
    for e in mista:
        if e.get("lat") is None:
            name = e["name"]
            g = geocode(e.get("query") or f"{name}, Česko")
            if not g and (e.get("query") or f"{name}, Česko") == f"{name}, Česko":   # výchozí dotaz: zkus sousední země
                g = geocode(name, "sk,pl,at,de,hu")
                if g:
                    print("MIMO ČESKO:", name, "→", g[2][:80], "– zkontroluj, že je to ono")
            if g:
                e["lat"], e["lon"], e["osm"] = g
                api.uloz_misto(e["slug"], lat=g[0], lon=g[1], osm=g[2])
            else:
                print("NENALEZENO:", name, "– uprav dotaz (rdb.py misto pridej", e["slug"], "--dotaz …) nebo zadej --lat/--lon")
    for e in mista:
        print(f"{e['slug']:24} {e['name']:24} {e.get('lat') or '?':>8} {e.get('lon') or '?':>8}  hledá „{e.get('pattern') or ''}“  {(e.get('osm') or '')[:60]}")


if __name__ == "__main__":
    api.hlavni(main)
