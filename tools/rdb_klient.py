#!/usr/bin/env python3
"""Klient API rodokmenu (/api/v1) – jen standardní knihovna. Data projektu jsou v Postgresu za API, ne v souborech.

Nastavení: proměnné RODOKMEN_API_URL a RODOKMEN_API_TOKEN – z prostředí, jinak ze souboru .env
(hledá se od složky tohoto skriptu nahoru ke kořeni repa; vzor .env.example).

Použití v nástroji (spouštět přes `python3 -I`):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import rdb_klient as api
    osoba = api.get("osoby/petr-novak-1980")
    api.put("svazky/mza_123", {"archive": "…", "title": "…"})
    api.put_soubor("zaznamy/n-lhota-1880-josef/vyrez", "pracovni/vyrezy/x.jpg", varianta="web")
Cesta bez „/“ na začátku je relativní k /api/v1/, s „/“ (např. „/media/<sha256>“) od kořene webu.
Chyba API → výjimka ChybaAPI (status, chyba, detail); v CLI ji vypíše `hlavni(fn)` a skončí s kódem 1.
"""
import json, mimetypes, os, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
TIMEOUT = 60          # s, běžné volání
TIMEOUT_SOUBOR = 180  # s, nahrávání obrázku


class ChybaAPI(Exception):
    def __init__(self, zprava, status=None, detail=None):
        super().__init__(zprava)
        self.status, self.chyba, self.detail = status, zprava, detail

    def __str__(self):
        s = f"Chyba API {self.status}: {self.chyba}" if self.status else f"Chyba: {self.chyba}"
        if self.detail not in (None, "", {}, []):
            d = self.detail if isinstance(self.detail, str) else json.dumps(self.detail, ensure_ascii=False, indent=1)
            s += "\n" + (d if len(d) < 4000 else d[:4000] + " …")
        return s


def _najdi_env():
    d = TOOLS
    while True:
        p = os.path.join(d, ".env")
        if os.path.isfile(p):
            return p
        if os.path.isdir(os.path.join(d, ".git")) or os.path.isfile(os.path.join(d, ".git")) or os.path.dirname(d) == d:
            return None   # kořen repa (u worktree je .git soubor) nebo kořen disku
        d = os.path.dirname(d)


def nacti_env():
    """Hodnoty z .env (bez přepisu proměnných prostředí)."""
    out = {}
    p = _najdi_env()
    if p:
        for radek in open(p, encoding="utf-8"):
            radek = radek.strip()
            if not radek or radek.startswith("#") or "=" not in radek:
                continue
            k, v = radek.split("=", 1)
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            out[k.strip()] = v
    return out


_KONFIG = None


def konfig():
    global _KONFIG
    if _KONFIG is None:
        env = nacti_env()
        url = (os.environ.get("RODOKMEN_API_URL") or env.get("RODOKMEN_API_URL") or "").rstrip("/")
        token = os.environ.get("RODOKMEN_API_TOKEN") or env.get("RODOKMEN_API_TOKEN") or ""
        _KONFIG = (url, token)
    return _KONFIG


def adresa(cesta, **query):
    url, _ = konfig()
    if not url:
        raise ChybaAPI("Chybí RODOKMEN_API_URL – doplň ho do .env v kořeni projektu (vzor .env.example).")
    cesta = str(cesta)
    if "?" in cesta:   # „svazky?druh=S“ – dotaz přímo v cestě
        cesta, dotaz = cesta.split("?", 1)
        query = {**dict(urllib.parse.parse_qsl(dotaz)), **query}
    if cesta.startswith(("http://", "https://")):
        base = cesta
    else:
        p = cesta if cesta.startswith("/") else "/api/v1/" + cesta.strip("/")
        p = urllib.parse.quote(p.rstrip("/") + "/", safe="/-_.~")   # aplikace má trailingSlash – bez lomítka by přesměrovala
        base = url + p
    q = {k: ("1" if v is True else v) for k, v in query.items() if v not in (None, False, "")}
    return base + ("?" + urllib.parse.urlencode(q) if q else "")


def volani(metoda, cesta, data=None, telo=None, typ=None, timeout=TIMEOUT, surove=False, **query):
    """Jedno volání API. data = JSON tělo; telo = bajty (typ = Content-Type). Vrací JSON (nebo bajty, když surove)."""
    _, token = konfig()
    if not token:
        raise ChybaAPI("Chybí RODOKMEN_API_TOKEN – vytvoř ho (cd aplikace && npm run token -- <nazev> agent) a ulož do .env.")
    url = adresa(cesta, **query)
    hlavicky = {"Authorization": f"Bearer {token}", "Accept": "application/json", "User-Agent": "rodokmen-rdb/1.0"}
    if data is not None:
        telo = json.dumps(data, ensure_ascii=False).encode("utf-8")
        typ = "application/json; charset=utf-8"
    if telo is not None:
        hlavicky["Content-Type"] = typ or "application/octet-stream"
    req = urllib.request.Request(url, data=telo, method=metoda, headers=hlavicky)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            obsah = r.read()
            if surove:
                return obsah
            return json.loads(obsah.decode("utf-8")) if obsah else None
    except urllib.error.HTTPError as e:
        obsah = e.read()
        try:
            j = json.loads(obsah.decode("utf-8"))
        except ValueError:
            j = None
        if isinstance(j, dict) and "chyba" in j:
            raise ChybaAPI(j["chyba"], e.code, j.get("detail")) from None
        text = obsah.decode("utf-8", "replace").strip()
        raise ChybaAPI(f"{metoda} {url} → HTTP {e.code} {e.reason}", e.code, text[:500] if text and "<html" not in text[:200].lower() else None) from None
    except urllib.error.URLError as e:
        raise ChybaAPI(f"Nelze se spojit s API {konfig()[0]} ({e.reason}). Běží server? Je správně RODOKMEN_API_URL v .env?") from None
    except TimeoutError:
        raise ChybaAPI(f"API neodpovědělo do {timeout} s ({metoda} {url}).") from None


def get(cesta, **query):
    return volani("GET", cesta, **query)


def post(cesta, data=None, **query):
    return volani("POST", cesta, data if data is not None else {}, **query)


def put(cesta, data=None, **query):
    return volani("PUT", cesta, data if data is not None else {}, **query)


def patch(cesta, data=None, **query):
    return volani("PATCH", cesta, data if data is not None else {}, **query)


def delete(cesta, data=None, **query):
    return volani("DELETE", cesta, data, **query)


def put_soubor(cesta, soubor, **query):
    """Nahraje binární soubor (výřez, mapu, dokument) – tělo = obsah souboru."""
    with open(soubor, "rb") as f:
        telo = f.read()
    typ = mimetypes.guess_type(soubor)[0] or "application/octet-stream"
    return volani("PUT", cesta, telo=telo, typ=typ, timeout=TIMEOUT_SOUBOR, **query)


def stahni(cesta, cil=None, **query):
    """Stáhne binární obsah (např. „/media/<sha256>“); s cil= ho uloží a vrátí cestu."""
    obsah = volani("GET", cesta, surove=True, timeout=TIMEOUT_SOUBOR, **query)
    if cil is None:
        return obsah
    os.makedirs(os.path.dirname(os.path.abspath(cil)), exist_ok=True)
    with open(cil, "wb") as f:
        f.write(obsah)
    return cil


# ---------- pomocníci pro nástroje ----------

def cti_json(arg):
    """JSON ze souboru, nebo ze stdin („-“)."""
    try:
        if arg == "-":
            return json.load(sys.stdin)
        with open(arg, encoding="utf-8") as f:
            return json.load(f)
    except OSError as e:
        raise ChybaAPI(f"Nelze přečíst {arg}: {e.strerror}") from None
    except ValueError as e:
        raise ChybaAPI(f"{arg} není platný JSON: {e}") from None


POLE_SVAZKU = ("archive", "portal", "title", "description", "url", "kind", "yearFrom", "yearTo", "imageCount", "placeSlug", "meta")


def uloz_svazek(klic, archiv, svazek, portal=None, popis=None, url=None, snimku=None, druh=None, rok_od=None, rok_do=None, misto=None, meta=None):
    """Registrace svazku (PUT /svazky/<klic>) – pro stahovače. U existujícího svazku změní jen uvedená pole."""
    try:
        stare = get(f"svazky/{klic}")
        zaklad = {k: stare.get(k) for k in POLE_SVAZKU}
    except ChybaAPI as e:
        if e.status != 404:
            raise
        zaklad = {}
    nove = {"archive": archiv, "portal": portal, "title": svazek, "description": popis, "url": url, "imageCount": snimku,
            "kind": druh, "yearFrom": rok_od, "yearTo": rok_do, "placeSlug": misto}
    d = {k: v for k, v in {**zaklad, **{k: v for k, v in nove.items() if v is not None}}.items() if v is not None}
    if meta:
        d["meta"] = {**(d.get("meta") or {}), **meta}
    d.setdefault("archive", "?")
    r = put(f"svazky/{klic}", d)
    print(f"{klic} -> {d.get('title')} (uloženo přes API)")
    return r


def slugify(text):
    """„Horní Lhota“ → „horni-lhota“ (stejně jako API)."""
    import re, unicodedata
    t = unicodedata.normalize("NFD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


POLE_MISTA = ("name", "kind", "parentSlug", "lat", "lon", "osm", "query", "pattern", "hypothesis", "description",
              "parish", "estate", "district", "modernName")


def uloz_misto(slug, **pole):
    """Založí místo, nebo u existujícího změní jen uvedená pole (PUT /mista nahrazuje celý řádek)."""
    try:
        stare = get(f"mista/{slug}")
        zaklad = {k: stare.get(k) for k in POLE_MISTA}
    except ChybaAPI as e:
        if e.status != 404:
            raise
        zaklad = {}
    d = {k: v for k, v in {**zaklad, **{k: v for k, v in pole.items() if v is not None}}.items() if v is not None}
    if not d.get("name"):
        raise ChybaAPI(f"Nové místo {slug} potřebuje název (name).")
    return put(f"mista/{slug}", d)


def paralelne(fn, polozky, vlaken=6):
    """fn pro každou položku souběžně (šetrně – pár vláken); výsledky ve stejném pořadí."""
    polozky = list(polozky)
    if len(polozky) < 3:
        return [fn(x) for x in polozky]
    with ThreadPoolExecutor(max_workers=vlaken) as ex:
        return list(ex.map(fn, polozky))


def detaily_osob(ids):
    """{id: detail osoby} – GET /osoby?detail=1&id=… po dávkách (pevný počet dotazů v DB na dávku)."""
    ids = list(dict.fromkeys(ids))
    out = {}
    for i in range(0, len(ids), 100):
        for d in get("osoby", detail=1, id=",".join(ids[i:i + 100])):
            out[d["id"]] = d
    return out


def jmeno(detail_nebo_radek):
    """Hlavní jméno z detailu osoby (names[isPrimary]) nebo z řádku seznamu (name / given+surname)."""
    d = detail_nebo_radek or {}
    if d.get("name"):
        return d["name"]
    jm = next((n for n in d.get("names", []) if n.get("isPrimary")), None) or (d.get("names") or [d])[0]
    return " ".join(x for x in (jm.get("given"), jm.get("surname")) if x) or d.get("id", "?")


def hlavni(fn):
    """Spustí fn() a chybu API vypíše srozumitelně česky (exit 1)."""
    try:
        return fn()
    except ChybaAPI as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)
