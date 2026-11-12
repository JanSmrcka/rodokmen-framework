#!/usr/bin/env python3
"""Tisk 20. století z Krameria NK (ndk.cz): hledání, úryvky z neveřejných stran, hromadné čtení a hledání adres.

Většina tisku 1900–2000 je „private“, ale s DNNT – čitelná po přihlášení na ndk.cz (reference/portaly.md → DNNT).
Vyhledávání a úryvky fungují bez přihlášení; celý text a sken neveřejné strany jen přes přihlášený prohlížeč.

Použití (z kořene projektu):
  dnnt.py hledej '<solr dotaz>' [--od 1925 --do 1940] [--titul 'Adresář*'] [--max 200] [--ulozit nazev]
      stránky s nálezem: rok | titul | strana | přístup (public / DNNT / jen knihovna) | pid | úryvky.
      Dotaz jako v kramerius.py, např. 'text_ocr:"Dlouhá 14"'. --ulozit uloží seznam do pracovni/dnnt/<nazev>.tsv.
      Pozor: --od/--do vyřadí čísla periodik bez data – při malém počtu nálezů zkus i bez nich.
  dnnt.py kontext <pid> '<slova>'
      úryvky ze zadané stránky (i neveřejné) kolem slov – kontext bez přihlášení; 0 úryvků = slova na stránce nejsou.
      Úryvek z OCR je „lit“, ne „doc“ (doc = přečteno na skenu).
  dnnt.py ocr <seznam.tsv | klic=pid | pid ...> [--slozka pracovni/dnnt/ocr]
      stáhne OCR text veřejných stránek (<klic>.txt); u neveřejných vypíše, ať použiješ „js“.
  dnnt.py js <seznam.tsv | klic=pid ...> [--obrazky]
      vypíše JS funkci pro chrome-devtools evaluate_script na přihlášené stránce ndk.cz (uživatel se přihlásí sám
      v okně, které otevře new_page). Výstup ulož parametrem filePath do souboru a pak „rozbal“.
      --obrazky přidá skeny (base64, ~1–9 MB na stranu – jen pár stran najednou).
  dnnt.py rozbal <vystup.json> [slozka=pracovni/dnnt/ocr]
      z výstupu JS udělá <klic>.txt a <klic>.jpg.
  dnnt.py adresa <slozka> "<Ulice>" <číslo> [číslo ...]
      projde *.txt a najde adresu i rozdělenou na konci řádku („Dlou-\\nhá 14“), s variantami „č.“, „čp.“, „čís.“;
      vypíše soubor, hlavičku stránky (obor adresáře) a okolí nálezu.
"""
import base64, glob, json, os, re, sys, time, unicodedata, urllib.error, urllib.parse, urllib.request
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT, "tools", "rdb_klient.py")):   # spuštěno mimo projekt (např. ze složky skillu)
    sys.exit(f"{os.path.basename(__file__)}: {ROOT} není složka projektu (chybí tools/rdb_klient.py). "
             f"Spusť projektovou kopii z kořene projektu: python3 -I tools/{os.path.basename(__file__)} …")
API = "https://kramerius5.nkp.cz/search/api/v5.0/"
DIR = os.path.join(ROOT, "pracovni", "dnnt")
UA = {"User-Agent": "Mozilla/5.0 (rodokmen-plus)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def solr(params):
    return json.loads(get(API + "search?" + urllib.parse.urlencode({"wt": "json", **params})))


def pristup(x):
    d = x.get("dostupnost") or "?"
    dn = x.get("dnnt") or "dnnto" in (x.get("dnnt-labels") or [])   # „dnnto“ = online po přihlášení
    return "DNNT" if d == "private" and dn else ("jen knihovna" if d == "private" else d)


def strana(x):
    return str(x["details"][0]).split()[0] if x.get("details") else ""


def cisty(h):
    return re.sub(r"\s+", " ", h).replace("<em>", "[").replace("</em>", "]")


def opt(a, name, default=None):
    if name in a:
        i = a.index(name)
        v = a[i + 1]
        del a[i:i + 2]
        return v
    return default


def hledej(a):
    od, do, titul = opt(a, "--od"), opt(a, "--do"), opt(a, "--titul")
    mx, ulozit = int(opt(a, "--max", "200")), opt(a, "--ulozit")
    q = f"({a[0]}) AND fedora.model:page"
    if od or do:
        q += f" AND datum_begin:[{od or '*'} TO {do or '*'}]"
    if titul:
        q += f' AND root_title:{titul}'
    rows, start, docs, hl, total = min(mx, 100), 0, [], {}, 0
    while start < mx:
        d = solr({"q": q, "rows": rows, "start": start, "fl": "PID,root_title,datum_str,details,dostupnost,dnnt,dnnt-labels",
                  "hl": "true", "hl.fl": "text_ocr", "hl.fragsize": "200", "hl.snippets": "3"})
        total = d["response"]["numFound"]
        docs += d["response"]["docs"]
        hl.update(d.get("highlighting", {}))
        start += rows
        if start >= total:
            break
        time.sleep(0.5)
    print(f"nalezeno {total} stránek, vypisuji {len(docs)}")
    radky = []
    for x in sorted(docs, key=lambda x: (x.get("datum_str") or "")[-4:]):
        u = " || ".join(cisty(h) for h in hl.get(x["PID"], {}).get("text_ocr", []))[:300]
        print(f"{x.get('datum_str', '')} | {str(x.get('root_title'))[:45]} | s. {strana(x)} | {pristup(x)} | {x['PID']}\n    {u}")
        radky.append("\t".join([x["PID"], x.get("datum_str", ""), strana(x), pristup(x), str(x.get("root_title"))[:80]]))
    if ulozit:
        os.makedirs(DIR, exist_ok=True)
        path = os.path.join(DIR, ulozit + ".tsv")
        open(path, "w", encoding="utf-8").write("pid\tdatum\tstrana\tpristup\ttitul\n" + "\n".join(radky) + "\n")
        print("uloženo:", os.path.relpath(path, ROOT))


def kontext(pid, slova):
    d = solr({"q": f'PID:"{pid}" AND text_ocr:({slova})', "rows": 1, "fl": "PID,root_title,datum_str,details,dostupnost,dnnt,dnnt-labels",
              "hl": "true", "hl.fl": "text_ocr", "hl.fragsize": "400", "hl.snippets": "20", "hl.mergeContiguous": "true"})
    if not d["response"]["docs"]:
        print("0 úryvků – slova na stránce nejsou (nebo je OCR přečetlo jinak).")
        return
    x = d["response"]["docs"][0]
    print(f"{x.get('datum_str', '')} | {x.get('root_title')} | s. {strana(x)} | {pristup(x)}")
    for h in d.get("highlighting", {}).get(pid, {}).get("text_ocr", []):
        print("  …", cisty(h))


def seznam(args):
    """[(klic, pid)] ze souboru .tsv, z „klic=pid“ nebo z holých pid."""
    out = []
    for a in args:
        if a.endswith(".tsv") and os.path.exists(a):
            for r in open(a, encoding="utf-8").read().splitlines()[1:]:
                c = r.split("\t")
                if c and c[0].startswith("uuid:"):
                    out.append((re.sub(r"\W+", "_", f"{c[1][-4:]}_{c[2]}_{c[0][5:13]}").strip("_"), c[0]))
        elif "=" in a:
            k, p = a.split("=", 1)
            out.append((k, p))
        elif a.startswith("uuid:"):
            out.append((a[5:13], a))
    return out


def ocr(args):
    slozka = opt(args, "--slozka", os.path.join(DIR, "ocr"))
    polozky = seznam(args)
    os.makedirs(slozka, exist_ok=True)
    nejde = []
    for k, pid in polozky:
        out = os.path.join(slozka, k + ".txt")
        if os.path.exists(out):
            continue
        try:
            open(out, "wb").write(get(f"{API}item/{pid}/streams/TEXT_OCR"))
            time.sleep(0.3)
        except urllib.error.HTTPError as e:
            if e.code == 403:
                nejde.append(f"{k}={pid}")
            else:
                raise
    print(f"staženo do {os.path.relpath(slozka, ROOT)}; neveřejných {len(nejde)}")
    if nejde:
        print("Neveřejné stránky přečti přes přihlášený prohlížeč:  dnnt.py js " + " ".join(nejde[:40]) + (" …" if len(nejde) > 40 else ""))


def js(args):
    obr = "--obrazky" in args
    polozky = seznam([a for a in args if a != "--obrazky"])
    if not polozky:
        sys.exit("Žádné stránky – zadej klic=pid nebo seznam .tsv.")
    if obr and len(polozky) > 6:
        print("// POZOR: skenů je víc než 6 – výstup bude velký; rozděl na menší dávky.", file=sys.stderr)
    mapa = json.dumps(dict(polozky), ensure_ascii=False)
    print(f"""async () => {{ const p = {mapa}; const out = {{}};
  for (const [k, v] of Object.entries(p)) {{
    const r = await fetch('/search/api/v5.0/item/' + v + '/streams/TEXT_OCR');
    out[k] = {{pid: v, status: r.status, text: await r.text()}};{'''
    const ri = await fetch('/search/img?pid=' + v + '&stream=IMG_FULL&action=GETRAW');
    const b = new Uint8Array(await ri.arrayBuffer()); let s = '';
    for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
    out[k].img = btoa(s);''' if obr else ''}
  }}
  return out; }}""")


def rozbal(path, slozka):
    d = json.load(open(path, encoding="utf-8"))
    if isinstance(d, str):   # chrome-devtools někdy uloží výsledek jako řetězec s JSONem
        d = json.loads(d)
    os.makedirs(slozka, exist_ok=True)
    for k, v in d.items():
        if v.get("status") == 200 and v.get("text"):
            open(os.path.join(slozka, k + ".txt"), "w", encoding="utf-8").write(v["text"])
        elif v.get("status"):
            print(f"{k}: HTTP {v['status']} – je uživatel přihlášený na ndk.cz?")
        if v.get("img"):
            open(os.path.join(slozka, k + ".jpg"), "wb").write(base64.b64decode(v["img"]))
    print(f"rozbaleno {len(d)} stránek do {os.path.relpath(slozka, ROOT)}")


def bez_diakritiky(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def adresa(slozka, ulice, cisla):
    # spojit dělená slova („Dlou-\nhá“) a sjednotit mezery; porovnávat bez diakritiky (OCR „Dlouha“, „Dlóuhá“)
    vzor_ul = r"\W*".join(re.escape(c) for c in bez_diakritiky(ulice).replace(" ", ""))
    vzor = re.compile(rf"{vzor_ul}\W{{0,3}}(?:c\.?\s*p\.?|cis\.?|c\.)?\s*({'|'.join(map(re.escape, cisla))})(?!\d)")
    n = 0
    for f in sorted(glob.glob(os.path.join(slozka, "*.txt"))):
        t = open(f, encoding="utf-8-sig", errors="replace").read()
        spoj = re.sub(r"[-¬]\s*\n\s*", "", t)
        jednoradek = re.sub(r"\s+", " ", spoj)
        nd = bez_diakritiky(jednoradek)
        hlava = " / ".join(r.strip() for r in t.splitlines()[:3] if r.strip())[:90]
        for m in vzor.finditer(nd):
            n += 1
            print(f"{os.path.basename(f)} | {hlava}\n    …{jednoradek[max(0, m.start() - 160):m.end() + 40]}")
    print(f"{n} nálezů. Ověř na skenu (doc) a převeď adresu podle data na číslo popisné (prameny.md → Čísla domů).")


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    c, a = a[0], a[1:]
    if c == "hledej" and a:
        hledej(a)
    elif c == "kontext" and len(a) == 2:
        kontext(*a)
    elif c == "ocr" and a:
        ocr(a)
    elif c == "js" and a:
        js(a)
    elif c == "rozbal" and a:
        rozbal(a[0], a[1] if len(a) > 1 else os.path.join(DIR, "ocr"))
    elif c == "adresa" and len(a) >= 3:
        adresa(a[0], a[1], a[2:])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
