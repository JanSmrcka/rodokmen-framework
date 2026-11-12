#!/usr/bin/env python3
"""Matriky SOA Třeboň (digi.ceskearchivy.cz) bez prohlížeče.

Použití (z kořene projektu):
  trebon.py misto "Obec"                 -> id místa a jeho název (diakritiku a mezery nástroj odstraní sám; portál vybere
                                            jedno místo – VŽDY zkontroluj vypsaný název a okres, u stejnojmenných obcí
                                            a měst vrací i okres nebo synagogu; pak použij id přímo)
  trebon.py svazky <id_mista|"Obec">     -> seznam matrik: id_knihy | kniha | druh | roky | obce
  trebon.py rejstrik <id_knihy> <písmeno> -> jmenný rejstřík (dobrovolnický): příjmení | jméno | místo | rok | snímek
                                            (ne každá kniha ho má; prázdný výsledek = rejstřík chybí, ne „osoba tam není“)
  trebon.py snimek <id_knihy> <snímek> <vystup.jpg> [nahled]
                                         -> stáhne snímek v plném rozlišení (slepí dlaždice); "nahled" = 1/4 rozlišení
  trebon.py popis <id_knihy>             -> karta svazku z portálu (archiv, fond, inv. č., obsah, roky, obce) – jen čte
  trebon.py svazek <id_knihy>            -> zapíše svazek do databáze přes API (klíč trebon_<id_knihy>) podle karty;
                                            jen čtení bez zápisu: `popis`
  trebon.py strom [<kód> ["Obec"]]       -> strom materiálů portálu (to, co `svazky` neukáže: gruntovní knihy,
                                            urbáře, kroniky…). Bez kódu kořen. Vypíše podsložky (kód | název) a svazky
                                            (id | …). S "Obec" projde obce u každého svazku a vypíše jen ty, kde obec je.
                                            Kódy: 1k kroniky, 1q pozemkové knihy, 1s sčítání lidu, 1t vrchnostenské
                                            registra, 1U urbáře (pod nimi archivy a fondy, např. 1qano)
  trebon.py obce <id_knihy>              -> obce, které svazek obsahuje
Trvalý odkaz na snímek: https://digi.ceskearchivy.cz/<id_knihy>/<snímek>
Ber ohled na server: stahuj jen snímky, které čteš.
"""
import glob, html, json, os, re, shutil, subprocess, sys, tempfile, time, unicodedata, urllib.parse, urllib.request, http.cookiejar
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

BASE = "https://digi.ceskearchivy.cz"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT, "tools", "rdb_klient.py")):   # spuštěno mimo projekt (např. ze složky skillu)
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí tools/rdb_klient.py). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")


def magick():
    """Cesta k ImageMagicku; když chybí, skončí hned (před stahováním) srozumitelnou hláškou."""
    m = (shutil.which("magick") or next(iter(sorted(glob.glob(r"C:\Program Files\ImageMagick*\magick.exe"))), None)
         or (os.name != "nt" and shutil.which("convert")))   # ImageMagick 6 bez magick; na Windows je convert.exe jiný program
    if not m:
        sys.exit("Chybí ImageMagick (příkaz magick). Nainstaluj ho (macOS: brew install imagemagick, "
                 "Windows: winget install ImageMagick.ImageMagick a restart Claude Code) a spusť nástroj znovu.")
    return m
_cj = http.cookiejar.CookieJar()
_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cj))
_op.addheaders = [("User-Agent", "Mozilla/5.0 (rodokmen-plus)")]


def get(path, referer=None, binary=False):
    url = path if path.startswith("http") else BASE + path
    req = urllib.request.Request(url)
    if referer:
        req.add_header("Referer", referer)
    for attempt in range(4):
        try:
            with _op.open(req, timeout=90) as r:
                data = r.read()
                return (data, r.geturl()) if binary else (data.decode("utf-8", "replace"), r.geturl())
        except OSError:
            if attempt == 3:
                raise


def text(s):
    return html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ").strip()


def misto(nazev):
    # portál zná jen tvar bez diakritiky a mezer (Ratibořské Hory → RatiborskeHory), jinak vrací 404
    holy = "".join(c for c in unicodedata.normalize("NFKD", nazev) if not unicodedata.combining(c)).replace(" ", "")
    _, url = get("/" + urllib.parse.quote(holy))
    m = re.search(r"[?&]id=(\d+)", url) or re.search(r"/(\d+)-", url)
    if not m:
        sys.exit(f"místo „{nazev}“ nenalezeno – portál ho jako místo nezná (malé osady chybějí). Zkus farní nebo sousední obec\n"
                 f"(Malá Chyška → Chyšky) a v popisu jejích knih najdi tuto osadu; id knihy jinak najdi na portálu v prohlížeči.")
    pid = m.group(1)
    page, _ = get(f"/pages/klicova/rejinfo.php?typ=&id={pid}&l=&bookid=")
    t = re.search(r"document\.title=\"([^\"]*)\"", page)
    if not t:
        page, _ = get(f"/description.php?id={pid}&menu=4")
        t = re.search(r"document\.title=\"([^\"]*)\"", page)
    return pid, (t.group(1).strip() if t else "")


def svazky(arg):
    pid = arg if arg.isdigit() else misto(arg)[0]
    page, _ = get(f"/pages/klicova/klicmaterial1.php?typ=2&id={pid}&pomid={pid}&l=&bookid=")
    out = []
    for m in re.finditer(r"<tr[^>]*onclick=\"otevri\('menu=3&id=(\d+)'\)\">(.*?)</tr>", page, re.S):
        bid, row = m.group(1), m.group(2)
        cells = [text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        cells = [re.sub(r"\s+", " ", c) for c in cells]
        out.append((bid, cells))
    return out


def rejstrik(bid, pis):
    page, _ = get(f"/pages/indexes.php?druh=1&menu2=0&pis={urllib.parse.quote(pis)}&id={bid}&page=")
    rows = []
    for m in re.finditer(r"<tr id='\d+' onclick=\"otevri2\('[^']*page=(\d+)[^']*'\)\">(.*?)</tr>", page, re.S):
        cells = [text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", m.group(2), re.S)]
        rows.append(cells + [m.group(1)])
    return rows


def snimek(bid, n, out, nahled=False):
    MAGICK = magick()
    ref = f"{BASE}/{bid}/{n}"
    get(ref)
    page, _ = get(f"/view.php?menu=3&id={bid}&page={n}&r=0", referer=ref)
    m = re.search(r'showImage\("[^"]*","([^"]+)"', page)
    if not m:
        sys.exit("token obrázku nenalezen (snímek neexistuje?)")
    src = f"{BASE}/cgi-bin/isrv8.cgi?{m.group(1)}"
    # najdi nejvyšší úroveň a počet dlaždic
    def tile(t, x, y):
        d, _ = get(f"{src}.0.{t}-{x}-{y}", referer=ref, binary=True)
        return d
    tier = 1
    while tile(tier + 1, 0, 0):
        tier += 1
    if nahled:
        tier = max(1, tier - 2)
    tmp = tempfile.mkdtemp(prefix="trebon_")
    rows, y = [], 0
    while True:
        x, row = 0, []
        while True:
            d = tile(tier, x, y)
            if not d:
                break
            p = os.path.join(tmp, f"t_{y}_{x}.jpg")
            open(p, "wb").write(d)
            row.append(p)
            x += 1
        if not row:
            break
        rp = os.path.join(tmp, f"row_{y}.png")
        subprocess.run([MAGICK, *row, "-crop", "768x769+0+0", "+repage", "+append", rp], check=True)
        rows.append(rp)
        y += 1
    subprocess.run([MAGICK, *rows, "-crop", "100%x768+0+0", "+repage", "-append", out], check=True)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    r = subprocess.run([MAGICK, out + "[0]", "-format", "%wx%h", "info:"], capture_output=True, text=True)
    print(out, r.stdout, "odkaz:", ref)


def popis(bid):
    """Karta svazku: {popisek: hodnota} z /description.php (popisky jsou anglicky)."""
    page, _ = get(f"/description.php?id={bid}&menu=3")
    page = re.sub(r"<script.*?</script>", "", page, flags=re.S)
    k = {}
    casti = re.split(r"<td[^>]*class='popis3b_nadpis'>", page)[1:]   # hodnota = vše do dalšího popisku (bývají v ní tabulky)
    for c in casti:
        a, _, b = c.partition("</td>")
        k.setdefault(re.sub(r"\s+", " ", text(a)), re.sub(r"\s+", " ", text(re.sub(r"<[^>]+>", " ", b))).strip(" ,"))
    return k


def strom(dt="1", obec=None):
    page, _ = get(f"/tree.php?doctree={dt}&menu=1")
    for c, n in re.findall(r"<a[^>]*doctree=(\w+)[^>]*>(.*?)</a>", page, re.S):
        if c.startswith(dt) and c != dt:
            print(c, "|", re.sub(r"\s+", " ", text(n)))
    i = page.find("fixed table header")
    # list stromu (obec ve sčítání) nemá „fixed table header“, řádky mají title='Open' a poslední končí </tbody>
    for bid, row in re.findall(r"id='(\d+)'[^>]*>(.*?)</t(?:r|body)>", page[i:] if i > 0 else page, re.S):
        cells = [re.sub(r"\s+", " ", text(c)) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]
        cells = [c for c in cells if c and c != "List of localities"]
        if obec:
            o = obce(bid)
            time.sleep(0.3)   # šetrně k serveru
            if obec.lower() not in o.lower():
                continue
            cells.append("obce: " + o)
        print(bid, "|", " | ".join(cells))


def obce(bid):
    t, _ = get(f"/pages/ajaxobec4.php?id={bid}")
    return re.sub(r"\s+", " ", text(t))


def svazek(bid):
    k = popis(bid)
    obsah = k.get("Title") or k.get("Content") or ""
    roky = k.get("Time extent") or k.get("Time extent BMD", "")
    if "sčítání lidu" in k.get("Access points", "").lower():
        nazev = f"Sčítání lidu {roky}, {k.get('Locality', obsah).split(' /')[0]}"
    elif k.get("Capital of parish"):   # matrika: „BMD M 1874-1911“ = N(arození) O(ddaní) Z(emřelí)
        druh = {"B": "N", "M": "O", "D": "Z"}
        r = roky.split()
        if len(r) > 1 and set(r[0]) <= set("BMD"):
            r[0] = "".join(druh[x] for x in r[0])
            roky = " ".join(r)
        nazev = f"Matrika {k['Capital of parish']} {k.get('Ordinal number', '')}, {roky}".replace("  ", " ")
    else:
        nazev = f"{obsah}, {roky}".strip(", ") or f"kniha {bid} (název doplň ručně)"
    fond = k.get("Archives Fond", "").split(",")[0].strip()
    archiv = "SOA Třeboň" + (f" – {k['Archives'].replace('SDA ', 'SOkA ')}" if k.get("Archives") and "Třeboň" not in k["Archives"] else "")
    archiv += (f", fond {fond}" if fond else "") + (f", inv. č. {k['Inventory number']}" if k.get("Inventory number") else "")
    import rdb_klient as api
    api.hlavni(lambda: api.uloz_svazek(f"trebon_{bid}", archiv, nazev, portal="digi.ceskearchivy.cz", url=f"{BASE}/{bid}"))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "misto":
        print(*misto(a[1]), sep=" | ")
    elif a[0] == "svazky":
        for bid, c in svazky(a[1]):
            print(bid, "|", " | ".join(x[:300] for x in c if x))
    elif a[0] == "rejstrik":
        for r in rejstrik(a[1], a[2]):
            print(" | ".join(r[:2] + r[3:]))
    elif a[0] == "snimek":
        snimek(a[1], a[2], a[3], len(a) > 4)
    elif a[0] == "svazek":
        svazek(a[1])
    elif a[0] == "popis":
        for x, y in popis(a[1]).items():
            print(f"{x}: {y}")
    elif a[0] == "strom":
        strom(a[1] if len(a) > 1 else "1", a[2] if len(a) > 2 else None)
    elif a[0] == "obce":
        print(obce(a[1]))
    else:
        sys.exit(__doc__)
