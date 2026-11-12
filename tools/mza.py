#!/usr/bin/env python3
"""Matriky MZA Brno (Acta Publica, www.mza.cz/actapublica) bez prohlížeče a bez přihlášení.

Použití (z kořene projektu `python3 -I tools/mza.py …`, na Windows `python -I -X utf8 tools/mza.py …`):
  mza.py hledat "Obec"                 -> obce z našeptávače portálu: obec_id | název (německý název, obec, okres)
                                          (hledá i bez diakritiky a podle začátku: „Pohorel“ najde Pohořelice)
  mza.py matriky <obec_id|"Obec">      -> knihy obce: id | kniha | původce (fara) | N | O | Z (roky, i = index) | obce | snímků
                                          s názvem místo id jen tehdy, když ho našeptávač najde jednoznačně
  mza.py info <id>                     -> kniha, původce, roky, obce, jazyk, poznámky a části knihy se snímky
                                          („narození (1673–1716) 1–162“ = snímky 1–162)
  mza.py snimek <id> <snímek> <vystup.jpg> [nahled] [x0,y0,x1,y1]
                                       -> snímek v plném rozlišení (IIIF, jeden požadavek); „nahled“ = 1/4;
                                          x0,y0,x1,y1 = jen výřez (zlomky 0..1)
  mza.py link <id> <snímek>            -> trvalý odkaz na snímek (pole „odkaz“ v zaznamy.json)
  mza.py svazek <id>                   -> zapíše svazek do databáze přes API (klíč mza_<id>)
<id> = číslo z adresy knihy …/actapublica/matrika/detail/<id> (není to číslo knihy). Snímky se číslují od 1
jako v prohlížeči portálu. Obrázkový server bere jen HTTP/2 – snímky proto stahuje `curl` (Python dostane HTTP 426).
Ber ohled na server: stahuj jen snímky, které čteš.
"""
import html, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

BASE = "https://www.mza.cz/actapublica/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT, "tools", "rdb_klient.py")):   # spuštěno mimo projekt (např. ze složky skillu)
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí tools/rdb_klient.py). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")
UA = "Mozilla/5.0 (rodokmen-plus)"   # s výchozím User-Agentem Pythonu portál vrací 403


def get(path, ajax=False):
    url = path if path.startswith("http") else BASE + path
    hdr = {"User-Agent": UA}
    if ajax:   # našeptávač bez téhle hlavičky vrací 404
        hdr["X-Requested-With"] = "XMLHttpRequest"
    # Rozestupy a zastavení po 429/503/403 hlídá slusne.py; tady se opakuje jen výpadek spojení a chyba 500/502/504.
    # MZA banuje IP po sérii rychlých dotazů – nikdy sem nepřidávej smyčku bez slusne.py.
    err = None
    for attempt in range(3):
        if attempt:
            time.sleep(5 * attempt)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=hdr), timeout=90) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code < 500:   # 403 sem nedojde – zastaví ho slusne.py
                sys.exit(f"MZA odmítla požadavek ({e.code}): {url}")
            err = e
        except OSError as e:
            err = e
    sys.exit(f"MZA neodpovídá ({err}): {url}")


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ")).strip()


# ---------- obce a seznam knih ----------

def hledat(nazev):
    d = json.loads(get("ajax/matrika/autocomplete_obec?" + urllib.parse.urlencode({"term": "::all::" + nazev}), ajax=True))
    return [(x["id"], x["label"]) for x in d if isinstance(x, dict) and str(x.get("id")) not in ("0", "")]


def obec_id(arg):
    if arg.isdigit():
        return arg
    obce = hledat(arg)
    presne = [o for o in obce if re.match(re.escape(arg) + r"\b", o[1], re.I)]
    vyber = presne if len(presne) == 1 else obce
    if len(vyber) == 1:
        return vyber[0][0]
    if not obce:
        sys.exit(f"Obec „{arg}“ portál nezná – zkus starý nebo německý název, začátek názvu nebo farní obec.")
    sys.exit(f"„{arg}“ odpovídá víc obcí – zadej obec_id:\n" + "\n".join(f"  {i} | {n}" for i, n in obce))


def roky(cell):
    """„1669 - 1716 <small> - </small>“ → „1669–1716“ (+ „i 1700–1716“, má-li kniha index)."""
    hl, _, idx = cell.partition("<small")
    r = text(hl).replace(" - ", "–").strip("–- ")
    i = text("<small" + idx).replace(" - ", "–").strip("–- ") if idx else ""
    return " ".join(x for x in (r, "i " + i if i else "") if x)


def matriky(oid):
    out, page = [], 1
    while True:
        t = get(f"matrika/hledani_obec?typ=obec&obec_id={oid}" + (f"&page={page}" if page > 1 else ""))
        for row in re.findall(r"<tr>(.*?)</tr>", t, re.S):
            m = re.search(r"matrika/detail/(\d+)", row)
            if not m:
                continue
            c = re.findall(r"<td(?:\s[^>]*)?>(.*?)</td>", row, re.S)
            if len(c) < 7:
                continue
            puv = re.sub(r"<a .*?</a>", "", c[1], flags=re.S)   # bez skryté poznámky o původci
            obce = re.findall(r"<strong>(.*?)</strong>", html.unescape(c[5]))   # názvy jsou v atributu data-content
            out.append((m.group(1), text(c[0]), text(puv), roky(c[2]), roky(c[3]), roky(c[4]),
                        zkrat(", ".join(text(o) for o in obce), 80), text(c[6]) + " sn."))
        page += 1
        if f"obec_id={oid}&amp;page={page}" not in t and f"obec_id={oid}&page={page}" not in t:
            return out


# ---------- detail knihy ----------

_DETAIL = {}


def detail(mid):
    if mid not in _DETAIL:
        if not str(mid).isdigit():
            sys.exit(f"id knihy „{mid}“ musí být číslo z adresy …/matrika/detail/<id>")
        t = get(f"matrika/detail/{mid}")
        m = re.search(r"CreateSeadragon\(\s*(\[.*?\])\s*,\s*(\[.*?\])\s*,\s*(\[.*?\])", t, re.S)
        if not m:
            sys.exit(f"Kniha {mid}: na stránce chybí seznam snímků – kniha neexistuje, není online, "
                     "nebo portál změnil stránku (nahlas to do poznamky_pro_skill.md).")
        dzi, jmena, stavy = (json.loads(m.group(i)) for i in (1, 2, 3))
        pole = {}
        for lab, val in re.findall(r'<td class="table-item-label">(.*?)</td>\s*<td class="table-item-value[^"]*">(.*?)</td>', t, re.S):
            l1, _, l2 = lab.partition("<br>")
            v1, _, v2 = val.partition("<br>")
            pole[text(l1)] = text(v1)
            if text(l2) and text(v2).strip("- "):
                pole[text(l2)] = text(v2)
        obce = [text(x) for x in re.findall(r'hledani_obec\?obec_id=\d+"[^>]*>(.*?)</a>', t, re.S)]
        casti = [text(x).removeprefix("Část matriky: ") for x in re.findall(r'title="(Část matriky:[^"]*)"', t)]
        _DETAIL[mid] = dict(pole=pole, obce=obce, casti=casti, dzi=dzi, jmena=jmena, stavy=stavy)
    return _DETAIL[mid]


def scan(mid, n):
    d = detail(mid)
    try:
        n = int(n)
    except ValueError:
        sys.exit(f"snímek „{n}“ musí být číslo")
    if not 1 <= n <= len(d["dzi"]):
        sys.exit(f"Kniha {mid} má snímky 1–{len(d['dzi'])}, ne {n}.")
    return d, n


def odkaz(mid, n):
    d, n = scan(mid, n)
    return f"{BASE}matrika/detail/{mid}?image={d['jmena'][n - 1]}"


def snimek(mid, n, out, nahled=False, crop=None):
    d, n = scan(mid, n)
    if str(d["stavy"][n - 1]) not in ("0", ""):
        print(f"POZOR: snímek {n} má na portálu stav {d['stavy'][n - 1]} (může být neveřejný)", file=sys.stderr)
    iiif = d["dzi"][n - 1].replace("Deepzoom=", "IIIF=").removesuffix(".dzi")
    region = "full"
    if crop:
        x0, y0, x1, y1 = crop
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
            sys.exit("výřez x0,y0,x1,y1 musí být zlomky 0–1 a x0 < x1, y0 < y1")
        region = "pct:" + ",".join(f"{v * 100:.3f}" for v in (x0, y0, x1 - x0, y1 - y0))
    size = "pct:25" if nahled else "full"
    if not shutil.which("curl"):
        sys.exit("chybí curl – obrázkový server MZA bere jen HTTP/2, které Python neumí (curl je ve Windows 10+, macOS i Linuxu)")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    p = slusne.curl(["-s", "-f", "--http2", "-m", "180", "-A", UA, "-o", out, f"{iiif}/{region}/{size}/0/default.jpg"],
                    stdout=subprocess.PIPE, text=True)
    ok = p.returncode == 0 and os.path.exists(out)
    if ok:
        with open(out, "rb") as f:
            ok = f.read(2) == b"\xff\xd8"
    if not ok:
        if os.path.exists(out):
            os.remove(out)
        sys.exit(f"MZA nevrátila obrázek (curl {p.returncode}{', ' + p.stderr.strip() if p.stderr.strip() else ''}). "
                 "Kód 1 nebo 16 = curl neumí HTTP/2 (starý curl) – nainstaluj novější; jinak zkus později.")
    print(out, f"{os.path.getsize(out) // 1024} kB", "odkaz:", odkaz(mid, n))


# ---------- registrace svazku (API) ----------

def zkrat(s, n=300):
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + " …"


def nazev_svazku(p):
    druhy = [f"{z} {p[k]}" for z, k in (("N", "Narození od-do"), ("O", "Oddaní od-do"), ("Z", "Zemřelí od-do"))
             if p.get(k, "").strip("- ")]
    return ", ".join(x for x in (f"kniha {p.get('Číslo knihy', '?')}", p.get("Původce", ""), " ".join(druhy).replace(" - ", "–")) if x)


def svazek(mid):
    d = detail(mid)
    import rdb_klient as api
    api.hlavni(lambda: api.uloz_svazek(f"mza_{mid}", "Moravský zemský archiv v Brně – Sbírka matrik", nazev_svazku(d["pole"]),
                                       portal="Acta Publica", popis=zkrat("; ".join(d["obce"])), snimku=len(d["dzi"]),
                                       url=f"{BASE}matrika/detail/{mid}"))


def main(a):
    if a[:1] == ["hledat"] and len(a) > 1:
        obce = hledat(a[1])
        if not obce:
            sys.exit(f"Obec „{a[1]}“ portál nezná – zkus starý nebo německý název nebo začátek názvu.")
        for i, n in obce:
            print(i, "|", n)
    elif a[:1] == ["matriky"] and len(a) > 1:
        oid = obec_id(a[1])
        knihy = matriky(oid)
        if not knihy:
            sys.exit(f"Obec {oid}: žádné matriky.")
        print(f"# obec {oid}: {len(knihy)} knih")
        for k in knihy:
            print(" | ".join(x or "–" for x in k))
    elif a[:1] == ["info"] and len(a) > 1:
        d = detail(a[1])
        for k, v in d["pole"].items():
            if v:
                print(f"{k}: {v}")
        print("obce:", "; ".join(d["obce"]))
        for c in d["casti"]:
            print("část:", c)
        print("snímků:", len(d["dzi"]))
    elif a[:1] == ["snimek"] and len(a) > 3:
        crop = None
        for x in a[4:]:
            if "," in x:
                try:
                    crop = tuple(float(v) for v in x.split(","))
                except ValueError:
                    crop = ()
                if len(crop) != 4:   # špatný výřez nesmí potichu stáhnout celou stránku
                    sys.exit(f"výřez „{x}“ zadej jako čtyři čísla x0,y0,x1,y1 (zlomky 0–1)")
        snimek(a[1], a[2], a[3], "nahled" in a[4:], crop)
    elif a[:1] == ["link"] and len(a) > 2:
        print(odkaz(a[1], a[2]))
    elif a[:1] == ["svazek"] and len(a) > 1:
        svazek(a[1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
