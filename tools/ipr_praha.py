#!/usr/bin/env python3
"""Staré plány a letecké snímky Prahy z IPR Praha (gs-pub.praha.eu) – celá série se stejným výřezem.

Mapy jsou georeferencované v S-JTSK, takže všechny obrázky série mají stejný výřez a na webu je jde prolínat
(mapy.json, stejná „skupina“). Mimo Prahu služby vrací prázdné obrázky – tam použij cuzk_archiv.py.

Použití (z kořene projektu):
  ipr_praha.py vrstvy
      vypíše plány a letecké snímky, které nástroj zná (klíč, rok, název)
  ipr_praha.py serie <lat,lon | "Ulice čp/čo"> [polomer_m=300] [px=1200] [--jen klic1,klic2] [--zapsat skupina]
      stáhne všechny vrstvy do pracovni/ipr/<klic>_r<polomer>.jpg (prázdné – mimo pokrytí – smaže a vypíše).
      Střed = bod (dům); „Ulice čp/čo“ se dohledá v RÚIAN. Výřez je čtverec 2×polomer metrů, sever nahoře
      (osy S-JTSK jsou proti severu pootočené jen o pár stupňů).
      --zapsat skupina   rovnou založí přes API historické mapy (POST /mapy se zdrojem, rokem a skupinou) a nahraje
                         k nim obrázky (max. 1800 px, kopie v pracovni/vyrezy/mapa_<skupina>_<klic>.jpg);
                         popis doplň potom v aplikaci (API zatím úpravu mapy nemá).
Šetři server: jedna série = ~20 požadavků. Výřez kolem domu: polomer 80–100 m, okolí: 300 m.
"""
import json, os, subprocess, sys, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT, "tools", "rdb_klient.py")):   # spuštěno mimo projekt (např. ze složky skillu)
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí tools/rdb_klient.py). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")
B = "https://gs-pub.praha.eu"
RUIAN = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer"
UA = {"User-Agent": "Mozilla/5.0 (rodokmen-plus)"}
ZDROJ = "IPR Praha, Geoportál hl. m. Prahy (geoportalpraha.cz)"
# klíč: (rok, název, typ, služba nebo id vrstvy)
VRSTVY = {
    "stabilni_katastr": ("1840", "Stabilní katastr – císařský otisk", "img", "stabilni_katastr_cisarske_otisky_2880"),
    "herget_1791": ("1791", "Plán Prahy (Herget)", "img", "plan_herget_1791"),
    "juttner_1816": ("1816", "Plán Prahy (Jüttner)", "img", "plan_juttner_1816"),
    "mayr_1869": ("1869", "Plán Prahy (Mayr)", "img", "plan_mayr_1869"),
    "poloh_1884": ("1884", "Polohopisný plán Prahy", "img", "plan_poloh_1884"),
    "plan_1889": ("1889", "Plán Prahy", "img", "plan_pav_1889"),
    "poloh_1891": ("1891", "Polohopisný plán Prahy", "img", "plan_poloh_1891"),
    "orient_1909": ("1909", "Orientační plán Prahy", "img", "plan_orient_1909"),
    "vysko_1920": ("1920", "Výškopisný plán Prahy", "img", "plan_vysko_1920"),
    "orient_1938": ("1938", "Orientační plán Prahy (s čísly popisnými)", "img", "plan_orient_1938"),
    "plan_1944": ("1944", "Plán Prahy (za okupace)", "img", "plan_prahy_1944"),
    "pozemkovy_katastr": ("asi 1930–1950", "Pozemkový katastr", "img", "byvaly_pozemkovy_katastr"),
    "letecky_1938": ("1938", "Letecký snímek", "ort", 0),
    "letecky_1945": ("1945", "Letecký snímek", "ort", 4),
    "letecky_1953": ("1953", "Letecký snímek", "ort", 8),
    "letecky_1966": ("1966", "Letecký snímek", "ort", 150),
    "letecky_1975": ("1975", "Letecký snímek", "ort", 12),
    "letecky_1989": ("1989", "Letecký snímek", "ort", 16),
    "letecky_1996": ("1996", "Letecký snímek", "ort", 20),
    "letecky_2002_povoden": ("2002", "Letecký snímek při povodni", "ort", 36),
}
PRAZDNY_B_NA_PX = 0.05   # jednobarevný JPEG mimo pokrytí má ~0.016 B/px, skutečná mapa 0.15 B/px a víc


def get(url, binary=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        d = r.read()
    return d if binary else json.loads(d)


def sjtsk(lat, lon):
    g = json.dumps({"geometryType": "esriGeometryPoint", "geometries": [{"x": lon, "y": lat}]})
    for srv in (B + "/arcgis", "https://ags.cuzk.gov.cz/arcgis"):
        try:
            p = get(f"{srv}/rest/services/Utilities/Geometry/GeometryServer/project?"
                    + urllib.parse.urlencode({"inSR": 4326, "outSR": 5514, "geometries": g, "f": "json"}))["geometries"][0]
            return p["x"], p["y"]
        except Exception:
            continue
    sys.exit("Převod souřadnic do S-JTSK selhal (služby IPR i ČÚZK) – zkus později.")


def bod(m):
    if "," in m and all(c in "0123456789., -" for c in m):
        lat, lon = (float(v) for v in m.split(","))
        return lat, lon
    d = m.replace(chr(39), "")
    ulice, _, cislo = d.rpartition(" ")
    vzory = [f"{d},%"] + ([f"{ulice} %/{cislo},%"] if ulice and cislo.isdigit() else [])   # i „Ulice čo“
    for vzor in vzory:
        q = urllib.parse.urlencode({"where": f"adresa LIKE '{vzor}'", "outFields": "adresa",
                                    "returnGeometry": "true", "outSR": 4326, "f": "json"})
        f = get(f"{RUIAN}/1/query?" + q).get("features")
        if f:
            break
    else:
        sys.exit(f"RÚIAN adresu „{m}“ nezná – zadej „Ulice čp/čo“ (např. „Dlouhá 712/14“) nebo lat,lon.")
    print("střed:", f[0]["attributes"]["adresa"])
    return f[0]["geometry"]["y"], f[0]["geometry"]["x"]


def stahni(klic, bbox, px, out):
    _, _, typ, sl = VRSTVY[klic]
    q = {"bbox": ",".join(f"{v:.1f}" for v in bbox), "bboxSR": 5514, "imageSR": 5514, "size": f"{px},{px}",
         "format": "jpg", "f": "image"}
    if typ == "img":
        url = f"{B}/imgs/rest/services/arch/{sl}/ImageServer/exportImage?" + urllib.parse.urlencode(q)
    else:
        url = f"{B}/arcgis/rest/services/ort/ortofotomapa_archiv/MapServer/export?" + urllib.parse.urlencode({**q, "layers": f"show:{sl}", "dpi": 96})
    d = get(url, binary=True)
    if len(d) < PRAZDNY_B_NA_PX * px * px:
        return False
    open(out, "wb").write(d)
    return True


def main():
    a = sys.argv[1:]
    if a[:1] == ["vrstvy"]:
        for k, (rok, nazev, typ, sl) in VRSTVY.items():
            print(f"{k:22} {rok:14} {nazev}")
        return
    if len(a) < 2 or a[0] != "serie":
        sys.exit(__doc__)
    opt = {}
    for o in ("--jen", "--zapsat"):
        if o in a:
            i = a.index(o)
            opt[o] = a[i + 1]
            a = a[:i] + a[i + 2:]
    lat, lon = bod(a[1])
    polomer = float(a[2]) if len(a) > 2 else 300
    px = int(a[3]) if len(a) > 3 else 1200
    x, y = sjtsk(lat, lon)
    bbox = (x - polomer, y - polomer, x + polomer, y + polomer)
    klice = opt["--jen"].split(",") if "--jen" in opt else list(VRSTVY)
    neznam = [k for k in klice if k not in VRSTVY]
    if neznam:
        sys.exit(f"Neznámé vrstvy {neznam} – seznam: ipr_praha.py vrstvy")
    os.makedirs(os.path.join(ROOT, "pracovni", "ipr"), exist_ok=True)
    hotove = []
    for k in klice:
        out = os.path.join(ROOT, "pracovni", "ipr", f"{k}_r{polomer:g}.jpg")
        ok = stahni(k, bbox, px, out)
        print(f"{'OK    ' if ok else 'prázdné'} {k:22} {VRSTVY[k][0]}" + (f"  → {os.path.relpath(out, ROOT)}" if ok else "  (mimo pokrytí)"))
        if ok:
            hotove.append((k, out))
    if "--zapsat" in opt:
        import rdb_klient as api, vyrez
        sk = opt["--zapsat"]
        for k, out in hotove:
            rok, nazev, typ, sl = VRSTVY[k]
            _, small = vyrez.vytvor(out, f"mapa_{sk}_{k}")
            def zapis():
                m = api.post("mapy", {"title": nazev, "year": int(rok) if rok.isdigit() else None, "url": "https://www.geoportalpraha.cz",
                                      "source": f"{ZDROJ}, {'archivní ortofotomapa' if typ == 'ort' else 'služba arch/' + sl}",
                                      "groupName": sk})
                api.put_soubor(f"mapy/{m['id']}/obrazek", small)
                print(f"mapa #{m['id']} {rok} {nazev} → uložena přes API")
            api.hlavni(zapis)
        print("Doplň popisy map (co je na mapě vidět u domu) v aplikaci.")
    print(f"Výřez S-JTSK {', '.join(f'{v:.0f}' for v in bbox)} – stejný pro všechny obrázky série.")


if __name__ == "__main__":
    main()
