#!/usr/bin/env python3
"""Slušný přístup k webům archivů: společný limit rychlosti a zastavení, když server dá najevo, že ho zatěžujeme.

Archivy (MZA Brno, SOA Litoměřice, ZA Opava…) banují IP adresu po sérii rychlých dotazů. Ban dopadne na uživatele
a archivy pak přitvrzují vůči všem. Proto:
- limit platí pro každý web zvlášť a je SPOLEČNÝ všem procesům (pomocníci/subagenti, dva nástroje najednou),
- dotazy (hledání, API, HTML) přísně – výchozí 1 za 2 s; obrázky a dlaždice volněji – 20 za s
  (ban způsobují rychlé dotazy, ne dlaždice jednoho snímku),
- po HTTP 429 nebo 503 (a po 403 na dotaz uprostřed práce) se web zablokuje na 30 minut pro všechny procesy a nástroj hned skončí –
  žádné další pokusy.

Nástroje v tools/ to mají zapnuté samy (`slusne.instaluj()` na začátku). Vlastní skript nebo curl spouštěj takhle:
  python3 -I tools/slusne.py pracovni/muj_skript.py [argumenty]   -> skript běží se stejným limitem (urllib, requests)
  python3 -I tools/slusne.py curl [argumenty curl]                -> curl se stejným limitem
  python3 -I tools/slusne.py stav                                 -> které weby jsou teď zablokované a do kdy
  python3 -I tools/slusne.py zablokuj <web> [důvod]               -> zablokovat web na 30 min (429/503/403 v prohlížeči)
  python3 -I tools/slusne.py odblokuj <web>                       -> zrušit blokaci (jen když víš, že šlo o omyl)
Stav je ve ~/.cache/dejiny-domu/slusne/ (jinde: proměnná SLUSNE_DIR).
"""
import http.client, json, os, re, subprocess, sys, threading, time, urllib.parse
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

# (s mezi dotazy, s mezi obrázky). Weby, které banují, přísně; velké státní služby volněji.
VYCHOZI = (2.0, 0.05)
LIMITY = {
    "ags.cuzk.gov.cz": (0.5, 0.05), "ags.cuzk.cz": (0.5, 0.05),   # ArcGIS ČÚZK – mapy jsou dotazy na export
    "kramerius5.nkp.cz": (1.0, 0.05), "anno.onb.ac.at": (1.0, 0.05),
    "nominatim.openstreetmap.org": (1.1, 1.1),                       # pravidla OSM: nejvýš 1 dotaz za s
    "gs-pub.praha.eu": (0.5, 0.05),
}
BLOKACE = 30 * 60
OBRAZEK = re.compile(r"\.(jpe?g|png|gif|webp|tiff?|jp2|dzi)(\?|$)|_files/|iipsrv|IIIF=|Deepzoom=|ximage|zoomify|"
                     r"TileGroup|ImageProperties\.xml|isrv\d*\.cgi|/full/|default\.jpg|/image/|mrimage|/tiles?/", re.I)


class Zablokovano(SystemExit):   # SystemExit: nástroje chytají OSError/Exception – tohle jim neproklouzne do opakování
    pass


def adresar():
    d = os.environ.get("SLUSNE_DIR") or os.path.join(os.path.expanduser("~"), ".cache", "dejiny-domu", "slusne")
    os.makedirs(d, exist_ok=True)
    return d


def _soubor(host, co):
    return os.path.join(adresar(), re.sub(r"[^a-z0-9.-]", "_", host.lower()) + "." + co)


def _zamkni(f):
    if os.name == "nt":
        import msvcrt
        f.seek(0)
        while True:
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
                return
            except OSError:   # LK_LOCK to zkouší jen 10 s
                pass
    else:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_EX)


def _odemkni(f):
    if os.name == "nt":
        import msvcrt
        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl
        fcntl.flock(f, fcntl.LOCK_UN)


def host_z(arg):
    """„https://www.mza.cz/x“ i „www.mza.cz“ → „www.mza.cz“."""
    return (urllib.parse.urlsplit(arg).hostname if "://" in arg else arg).lower()


def druh(url):
    return "obr" if OBRAZEK.search(url) else "dotaz"


def blokace(host):
    """(do kdy, proč) nebo None."""
    try:
        with open(_soubor(host, "blok"), encoding="utf-8") as f:
            b = json.load(f)
    except (OSError, ValueError):
        return None
    if b.get("do", 0) <= time.time():
        return None
    return b["do"], b.get("proc", "")


def zablokuj(host, proc, sekund=BLOKACE):
    with open(_soubor(host, "blok"), "w", encoding="utf-8") as f:
        json.dump({"do": time.time() + sekund, "proc": proc}, f, ensure_ascii=False)


def _hlaska(host, do, proc):
    zbyva = max(1, round((do - time.time()) / 60))
    return (f"STOP: web {host} je zablokovaný ještě {zbyva} min ({proc}). Server dal najevo, že ho zatěžujeme – "
            f"NEZKOUŠEJ to znovu ani jinou cestou (jiný nástroj, curl, prohlížeč). Pokračuj jiným pramenem "
            f"a k tomuhle se vrať po {time.strftime('%H:%M', time.localtime(do))}. Řekni to uživateli.")


class Fronta(SystemExit):
    pass


def _zkontroluj_blokaci(host):
    b = blokace(host)
    if b:
        raise Zablokovano(_hlaska(host, *b))


def pockej(host, co, nejdele=None):
    """Počká, až je na webu volno (společně pro všechny procesy). Zablokovaný web → Zablokovano.
    nejdele: kolik s nejvýš čekat (hook má časový limit) – jinak Fronta a termín se nezabere."""
    host = (host or "").lower()
    _zkontroluj_blokaci(host)
    rozestup = LIMITY.get(host, VYCHOZI)[0 if co == "dotaz" else 1]
    with open(_soubor(host, co), "a+", encoding="utf-8") as f:
        _zamkni(f)
        try:
            f.seek(0)
            try:
                posledni = float(f.read().strip() or 0)
            except ValueError:
                posledni = 0.0
            ted = time.time()
            slot = max(ted, posledni + rozestup)   # rezervace termínu – další proces dostane až ten po něm
            if nejdele is not None and slot - ted > nejdele:
                raise Fronta(f"{host}: na web čeká fronta dotazů ({slot - ted:.0f} s) – zkus to za chvíli")
            f.seek(0)
            f.truncate()
            f.write(repr(slot))
            f.flush()
        finally:
            _odemkni(f)
    if slot > ted:
        time.sleep(slot - ted)
        _zkontroluj_blokaci(host)   # mezitím mohl jiný proces dostat 429


def _byl_uspech(host):
    """Odpověděl web v posledních 30 min v pořádku (kterémukoli procesu)? Pak 403 není špatný User-Agent, ale zátěž."""
    try:
        return time.time() - os.path.getmtime(_soubor(host, "ok")) < BLOKACE
    except OSError:
        return False


def posoudit(host, co, kod, retry_after=None):
    """Po odpovědi: 429/503 (a 403 na dotaz) → zablokovat web a skončit.
    403 hned na první dotaz bývá špatný User-Agent nebo neveřejná stránka, ne zátěž – skončí bez blokace."""
    host = host.lower()
    if kod < 400:
        with open(_soubor(host, "ok"), "w"):
            pass
        return
    if kod == 403 and co == "dotaz" and not _byl_uspech(host):
        raise SystemExit(f"{host} odmítl dotaz (HTTP 403) – buď chybí prohlížečový User-Agent / stránka není veřejná, "
                         "nebo web zablokoval IP adresu (v prohlížeči „Sorry, you have been blocked“ → vypni VPN nebo "
                         "zkus jinou síť). Neopakuj dotaz ve smyčce.")
    if kod in (429, 503) or (kod == 403 and co == "dotaz"):
        sekund = BLOKACE
        if retry_after and str(retry_after).isdigit():
            sekund = max(BLOKACE, int(retry_after))
        proc = f"HTTP {kod}"
        zablokuj(host, proc, sekund)
        raise Zablokovano(_hlaska(host, time.time() + sekund, proc))


_lokalni = threading.local()
_instalovano = False


def vlastni_api(host):
    """Localhost nebo host z RODOKMEN_API_URL (vlastní API rodokmenu, ne web archivu)."""
    host = (host or "").lower().split(":")[0].strip("[]")
    if host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        return True
    try:
        import urllib.parse, rdb_klient
        return host == (urllib.parse.urlsplit(rdb_klient.konfig()[0]).hostname or "").lower()
    except Exception:
        return False


def instaluj():
    """Zapne limit pro všechno, co v procesu jde přes http.client (urllib, requests, http.client)."""
    global _instalovano
    if _instalovano:
        return
    _instalovano = True
    put, get = http.client.HTTPConnection.putrequest, http.client.HTTPConnection.getresponse

    def putrequest(self, method, url, *a, **k):
        if vlastni_api(self.host):   # API rodokmenu (a localhost) není archiv – bez limitu a bez blokace po 403
            _lokalni.posledni = None
            return put(self, method, url, *a, **k)
        co = druh(url)
        pockej(self.host, co)
        _lokalni.posledni = (self.host, co)
        return put(self, method, url, *a, **k)

    def getresponse(self, *a, **k):
        r = get(self, *a, **k)
        if vlastni_api(self.host):
            return r
        host, co = getattr(_lokalni, "posledni", None) or (self.host, "dotaz")
        posoudit(host, co, r.status, r.getheader("Retry-After"))
        return r

    http.client.HTTPConnection.putrequest = putrequest
    http.client.HTTPConnection.getresponse = getresponse


HODNOTOVE = {"-e", "--referer", "-x", "--proxy", "-H", "--header", "-b", "--cookie", "-A", "--user-agent",
             "-u", "--user", "-d", "--data", "--data-urlencode", "-F", "--form"}   # volby curl, jejichž hodnota může být adresa


def curl(args, **kw):
    """Spustí curl s limitem: počká podle první adresy, po odpovědi posoudí kód. Vrací CompletedProcess (stderr jako text)."""
    urls = [a for i, a in enumerate(args) if re.match(r"https?://", a) and (i == 0 or args[i - 1] not in HODNOTOVE)]
    host = urllib.parse.urlsplit(urls[0]).hostname if urls else ""
    co = druh(urls[0]) if urls else "dotaz"
    if host:
        pockej(host, co)
    kw.setdefault("stderr", subprocess.PIPE)
    kw.setdefault("text", True)
    kw.setdefault("encoding", "utf-8")
    kw.setdefault("errors", "replace")
    args, znacka = list(args), "%{stderr}\nSLUSNE %{http_code}\n"
    for i, x in enumerate(args[:-1]):
        if x in ("-w", "--write-out"):   # vlastní -w nechat, značku připojit za něj (curl bere jen poslední -w)
            args[i + 1] += znacka
            break
    else:
        args += ["-w", znacka]
    p = subprocess.run(["curl", *args], **kw)
    kody = re.findall(r"SLUSNE (\d+)", p.stderr or "")
    p.stderr = re.sub(r"\n?SLUSNE \d+\n", "", p.stderr or "")
    if host and kody:
        posoudit(host, co, int(kody[-1]))
    return p


def main(a):
    if not a or a[0] in ("-h", "--help"):
        sys.exit(__doc__)
    if a[0] == "stav":
        nic = True
        for fn in sorted(os.listdir(adresar())):
            if fn.endswith(".blok"):
                b = blokace(fn[:-5])
                if b:
                    nic = False
                    print(f"{fn[:-5]}: zablokováno do {time.strftime('%H:%M', time.localtime(b[0]))} ({b[1]})")
        if nic:
            print("Žádný web není zablokovaný.")
    elif a[0] == "zablokuj" and len(a) > 1:
        host = host_z(a[1])
        zablokuj(host, " ".join(a[2:]) or "ručně")
        print(f"{host}: zablokováno na {BLOKACE // 60} min")
    elif a[0] == "odblokuj" and len(a) > 1:
        host = host_z(a[1])
        p = _soubor(host, "blok")
        if os.path.exists(p):
            os.remove(p)
        print(f"{host}: odblokováno")
    elif a[0] == "curl":
        try:
            p = curl(a[1:])
        except Zablokovano as e:
            print(e, file=sys.stderr)
            sys.exit(22)
        sys.stderr.write(p.stderr)
        sys.exit(p.returncode)
    else:
        import runpy
        sys.modules.setdefault("slusne", sys.modules[__name__])   # `import slusne` ve skriptu = tenhle modul, ne druhá kopie
        instaluj()
        sys.argv = a
        sys.path.insert(0, os.path.dirname(os.path.abspath(a[0])))
        runpy.run_path(a[0], run_name="__main__")


if __name__ == "__main__":
    main(sys.argv[1:])
