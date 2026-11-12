#!/usr/bin/env python3
"""Staré mapy z Archivu ČÚZK (ags.cuzk.gov.cz/archiv) bez prohlížeče: stabilní katastr, indikační skici, pozemkový katastr.

Archiv ČÚZK je webová aplikace nad službami ArcGIS. Token pro ně vydává veřejná služba ČÚZK (stejně jako v aplikaci),
nástroj si ho obstará sám a uloží na hodinu do pracovni/.cuzk_token.

Použití (z kořene projektu):
  cuzk_archiv.py listy "Horní Lhota 12" | lat,lon
      které listy stabilního katastru pokrývají místo: katastrální obec v roce 1827 (často jiná než dnes – malá ves
      bývala součástí sousední), originální mapa (om_SIGN_INV, rok reambulace, listy om_SOUB), císařský otisk
      (cio_SIGN_INV) a indikační skica (S0X = předpona rastrů ve službě skici).
  cuzk_archiv.py rastry <sluzba> "vzor"
      rastry (listy) ve službě: stable = originální mapy a císařské otisky (vzor např. B2_a_4C_518),
      skici = indikační skici (vzor = S0X bez „c|“, např. BUD286018270), nonstable = ostatní.
      Vypíše id | název | rozměr listu (v jednotkách listu).
  cuzk_archiv.py export <sluzba> <id> <vystup.jpg> [x0,y0,x1,y1] [sirka_px]
      list v plném rozlišení nebo jeho výřez. Výřez jako u vyrez.py: podíly 0–1 od levého horního rohu
      (celý list = 0,0,1,1; výchozí). Výchozí šířka 4000 px, max. asi 15000. Nejdřív stáhni celý list menší
      (sirka 1500), najdi ves, pak výřez ve velkém.
  cuzk_archiv.py mapa <vrstva> "Horní Lhota 12" | lat,lon <vystup.jpg> [polomer_m] [px]
      georeferencovaná (spojená) vrstva kolem místa: pk = pozemkový katastr (~1900–1950, v S-JTSK, sedí na dnešní
      domy), originalni_mapy, cisarske_otisky. Malé obce spojené vrstvy často nepokrývají (bílý obrázek) –
      pak listy + export. Výchozí poloměr 150 m, 1500 px.
Ber ohled na server: stahuj jen listy a výřezy, které čteš. Výsledek ulož do dokumentů a dál vyrez.py + mapy.json.
"""
import json, math, os, sys, time, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT, "tools", "rdb_klient.py")):   # spuštěno mimo projekt (např. ze složky skillu)
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí tools/rdb_klient.py). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")
REFERER = "https://ags.cuzk.gov.cz/archiv/"
ARCHIV = "https://ags.cuzk.gov.cz/arcgis4/rest/services/Archiv"
GEN = "https://ags.cuzk.gov.cz/arcgis2/rest/services/GenerateToken/Token/GPServer/GenerateToken"
RUIAN = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer"
TOKEN = os.path.join(ROOT, "pracovni", ".cuzk_token")


def get(url, params=None, binary=False):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Referer": REFERER, "User-Agent": "Mozilla/5.0 (rodokmen-plus)"})
    for pokus in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = r.read()
                return d if binary else json.loads(d)
        except OSError:
            if pokus == 2:
                raise
            time.sleep(2)


def token():
    if os.path.exists(TOKEN) and time.time() - os.path.getmtime(TOKEN) < 50 * 60:
        return open(TOKEN).read().strip()
    job = get(f"{GEN}/submitJob", {"GenerateTokenURL": "https://ags.cuzk.gov.cz/arcgis4/tokens/", "referer": REFERER,
                                   "parametr": "", "expiration": 60, "f": "json"})["jobId"]
    for _ in range(20):
        time.sleep(1)
        if get(f"{GEN}/jobs/{job}", {"f": "json"}).get("jobStatus") == "esriJobSucceeded":
            break
    else:
        sys.exit("ČÚZK nevydal token do 20 s – zkus to za chvíli znovu")
    t = get(f"{GEN}/jobs/{job}/results/Token", {"f": "json"})["value"]
    os.makedirs(os.path.dirname(TOKEN), exist_ok=True)
    open(TOKEN, "w").write(t)
    return t


def archiv(cesta, params, binary=False):
    d = get(f"{ARCHIV}/{cesta}", dict(params, token=token()), binary)
    if not binary and "error" in d:
        sys.exit(f"ČÚZK: {d['error']}")
    return d


def save_jpeg(img, out):
    if not img.startswith(b"\xff\xd8"):
        sys.exit("ČÚZK nevrátil obrázek: " + img[:300].decode("utf-8", "replace"))
    open(out, "wb").write(img)


def misto(m):
    """'lat,lon' nebo adresa pro RÚIAN ('Horní Lhota 12') → (lat, lon)."""
    try:
        lat, lon = (float(x) for x in m.split(","))
        return lat, lon
    except ValueError:
        f = get(f"{RUIAN}/1/query", {"where": f"adresa LIKE '{m.replace(chr(39), '')},%'", "outFields": "adresa",
                                     "outSR": 4326, "f": "json"}).get("features", [])
        if not f:
            sys.exit(f"RÚIAN „{m}“ nezná – zadej lat,lon (mista.py hledej) nebo jiný tvar adresy")
        print("místo:", f[0]["attributes"]["adresa"])
        return f[0]["geometry"]["y"], f[0]["geometry"]["x"]


def listy(m):
    lat, lon = misto(m)
    d = archiv("klady/MapServer/identify", {
        "geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "sr": 4326, "layers": "all:3",
        "tolerance": 0, "mapExtent": f"{lon - .01},{lat - .01},{lon + .01},{lat + .01}",
        "imageDisplay": "1000,1000,96", "returnGeometry": "false", "f": "json"})
    if not d.get("results"):
        print("stabilní katastr: žádný list (zkus jiné místo)")
    for r in d.get("results", []):
        a = {k: v for k, v in r["attributes"].items() if v and v.strip() and v != "Null"}
        print(f"katastrální obec 1827: {a.get('NAZ_PUV_CS', '?')} ({a.get('NAZ_PUV_NE', '')})")
        print(f"  originální mapa: {a.get('om_NAZEV_JEDNOTKY', '–')}, sign. {a.get('om_SIGNATURA', '?')}, "
              f"inv. č. {a.get('om_INV_CISLO', '?')}, mapováno {a.get('om_ROZPIS_DAT', '?')}, "
              f"reambulace {a.get('om_REAMBULACE', '–')}")
        print(f"     → rastry stable \"{a.get('om_SIGN_INV', '')}\", listy {a.get('om_SOUB', '?')}")
        print(f"  císařský otisk: sign. {a.get('cio_SIGNATURA', '?')}, inv. č. {a.get('cio_INV_CISLO', '?')}, "
              f"{a.get('cio_DAT_OD', '?')}, listů {a.get('cio_LISTU_CELK', '?')} → rastry stable \"{a.get('cio_SIGN_INV', '')}\"")
        s0x = a.get("S0X", "").split("|")[-1]
        print("  indikační skica: " + (f"→ rastry skici \"{s0x}\"" if s0x else "není v kladu"))


def rastry(sluzba, vzor):
    d = archiv(f"archiv_nespojene_{sluzba}/ImageServer/query", {
        "where": f"Name LIKE '{vzor.replace(chr(39), '')}%'", "outFields": "OBJECTID,Name",
        "returnGeometry": "true", "f": "json"})
    feats = [f for f in d.get("features", []) if f["attributes"]["Name"].startswith(vzor)
             and not f["attributes"]["Name"][len(vzor):len(vzor) + 1].isdigit()]   # 518 ≠ 5180
    for f in feats:
        r = f["geometry"]["rings"][0]
        xs, ys = [p[0] for p in r], [p[1] for p in r]
        print(f"{f['attributes']['OBJECTID']} | {f['attributes']['Name']} | {max(xs) - min(xs):.1f} × {max(ys) - min(ys):.1f}")
    if not feats:
        print("nic – zkus kratší vzor")


def export(sluzba, rid, out, vyrez="0,0,1,1", sirka=4000):
    d = archiv(f"archiv_nespojene_{sluzba}/ImageServer/query", {"objectIds": rid, "outFields": "OBJECTID",
                                                                "returnGeometry": "true", "f": "json"})
    r = d["features"][0]["geometry"]["rings"][0]
    X0, X1 = min(p[0] for p in r), max(p[0] for p in r)
    Y0, Y1 = min(p[1] for p in r), max(p[1] for p in r)
    a, b, c, e = (float(x) for x in vyrez.split(","))
    bbox = (X0 + a * (X1 - X0), Y1 - e * (Y1 - Y0), X0 + c * (X1 - X0), Y1 - b * (Y1 - Y0))   # y roste nahoru
    sirka = int(sirka)
    vyska = round(sirka * (bbox[3] - bbox[1]) / (bbox[2] - bbox[0]))
    img = archiv(f"archiv_nespojene_{sluzba}/ImageServer/exportImage", {
        "f": "image", "bbox": ",".join(f"{v:.4f}" for v in bbox), "size": f"{sirka},{vyska}", "format": "jpg",
        "compressionQuality": 92,
        "mosaicRule": json.dumps({"ascending": True, "lockRasterIds": [int(rid)], "mosaicMethod": "esriMosaicLockRaster"})},
        binary=True)
    save_jpeg(img, out)
    print(f"{out} {sirka}×{vyska}")


def mapa(vrstva, m, out, polomer=150, px=1500):
    lat, lon = misto(m)
    dlat = float(polomer) / 111320
    dlon = dlat / math.cos(math.radians(lat))
    img = archiv(f"archiv_spojene_{vrstva}/MapServer/export", {
        "bbox": f"{lon - dlon},{lat - dlat},{lon + dlon},{lat + dlat}", "bboxSR": 4326, "imageSR": 5514,
        "size": f"{px},{px}", "format": "jpg", "dpi": 96, "f": "image"}, binary=True)
    save_jpeg(img, out)
    print(f"{out} – zkontroluj, jestli není bílý (vrstva tu nemusí být)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == "listy":
        listy(a[1])
    elif len(a) >= 3 and a[0] == "rastry":
        rastry(a[1], a[2])
    elif len(a) >= 4 and a[0] == "export":
        export(*a[1:6])
    elif len(a) >= 4 and a[0] == "mapa":
        mapa(*a[1:6])
    else:
        sys.exit(__doc__)
