#!/usr/bin/env python3
"""rdb – práce s daty rodokmenu přes API (osoby, zápisy, svazky, místa, domy, vodítka, deník, úkoly, příběhy…).

Data jsou v databázi za API (lokálně Docker, v produkci Vercel). Nastavení v .env (RODOKMEN_API_URL, RODOKMEN_API_TOKEN).
Spouštěj z kořene projektu:  python3 -I tools/rdb.py <oblast> <akce> …   (nápověda: … -h)

Vstupní JSON se předává souborem (napiš ho nástrojem Write do pracovni/) nebo „-“ = ze stdin.
Výstup: stručný text; s --json surová data z API.
Nejčastější:
  rdb.py rod seznam --pro <kořen> ; rdb.py voditko seznam --otevrena ; rdb.py ukol seznam   (začátek práce, výpis po rodech)
  rdb.py voditko seznam --otevrena --rod <slug> ; rdb.py ukol seznam --rod <slug>   (práce na jednom rodu; --rod bez = bez rodu)
  rdb.py denik posledni 50 --vetev <kořen> [--prarodic 4–7]   (po větvích prarodičů kořene)
  rdb.py osoba hledej novak ; rdb.py osoba ukaz petr-novak-1980
  rdb.py denik hledej "Lhota" ; rdb.py nalez pracovni/nalez.json ; rdb.py vyrez nahraj <klic> <soubor>
  rdb.py api GET osoby/petr-novak-1980          (obecné volání libovolné cesty /api/v1/…)
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import rdb_klient as api

JISTOTA = ["doc", "prob", "fam", "mh", "unk", "lit"]
UDALOSTI = ["narozeni", "krest", "snatek", "umrti", "pohreb", "povolani", "sluzba", "jine"]
SYMBOL = {"narozeni": "*", "krest": "~", "snatek": "×", "umrti": "†", "pohreb": "▭", "povolani": "povolání", "sluzba": "služba", "jine": "·"}
STAV_VODITKA = ["nezpracovano", "overuje_se", "potvrzeno", "vyvraceno", "nelze_overit", "rozdeleno"]
STAV_UKOLU = ["otevreny", "rozpracovany", "ceka", "hotovy", "zruseny"]
VYSLEDEK = ["nalezeno", "nenalezeno", "castecne", "jine"]
REVIEW = ["rozpracovano", "ke_kontrole", "overeno"]
DRUH_ZAZNAMU = ["N", "O", "Z", "I", "S", "G", "K", "M", "C", "L", "J"]
DRUH_PRIBEHU = ["pribeh", "pribeh_rodu", "pribeh_domu", "zajimavosti", "jine"]

A = None   # argumenty


# ---------- výstup ----------

def vypis_json(d):
    print(json.dumps(d, ensure_ascii=False, indent=1))


def out(d, text=None):
    """--json → surová data; jinak text (funkce nebo řetězec), bez něj stručný obecný výpis."""
    if A.json or text is None and not isinstance(d, (list, dict)):
        vypis_json(d)
    elif callable(text):
        text(d)
    elif text is not None:
        print(text)
    else:
        obecne(d)


def obecne(d):
    if isinstance(d, list):
        for x in d:
            print(radek(x))
        print(f"({len(d)})")
    elif isinstance(d, dict):
        for k, v in d.items():
            if k in ("search", "createdAt", "createdBy", "updatedAt", "bytes") or v in (None, "", [], {}):
                continue
            print(f"{k}: {v if not isinstance(v, (list, dict)) else json.dumps(v, ensure_ascii=False)}")


def radek(x):
    if not isinstance(x, dict):
        return str(x)
    kl = next((x[k] for k in ("key", "slug", "id") if x.get(k) is not None), "")
    nazev = next((x[k] for k in ("title", "name", "question", "text") if x.get(k)), "")
    if not nazev and (x.get("given") or x.get("surname")):
        nazev = f"{x.get('given', '')} {x.get('surname', '')}".strip()
    dalsi = [str(x[k]) for k in ("yearsText", "dateText", "status", "state", "review", "result", "certainty") if x.get(k)]
    return f"{kl} | {nazev}" + (f" | {' | '.join(dalsi)}" if dalsi else "")


def ok(d, co="uloženo"):
    if A.json:
        vypis_json(d)
        return
    kl = next((d[k] for k in ("key", "slug", "id", "recordKey", "sha256") if isinstance(d, dict) and d.get(k) is not None), None)
    print(f"OK – {co}" + (f": {kl}" if kl is not None else ""))


def datum(s):
    return (s or "")[:16].replace("T", " ")


# ---------- vstupy ----------

def json_z(arg):
    """JSON ze souboru, „-“ (stdin) nebo přímo text začínající { či [."""
    if arg.lstrip().startswith(("{", "[")):
        try:
            return json.loads(arg)
        except ValueError as e:
            raise api.ChybaAPI(f"Neplatný JSON v argumentu: {e}") from None
    return api.cti_json(arg)


def bez_none(d):
    return {k: v for k, v in d.items() if v is not None}


def zdroje():
    s = [{"recordKey": k} for k in (getattr(A, "zaznam", None) or [])]
    s += [{"tipId": int(t)} for t in (getattr(A, "voditko", None) or [])]
    s += [{"documentId": int(t)} for t in (getattr(A, "dokument", None) or [])]
    return s


def ano_ne(v):
    return None if v is None else {"ano": True, "ne": False, "auto": None}[v]


def slouc(stary, zmeny, pole):
    """API u PATCH doplní výchozí hodnoty chybějících polí (review, summary, priority, personIds…) a tím je přepíše.
    Proto posíláme celý objekt: stávající hodnoty uvedených polí + změny."""
    return {**{k: stary[k] for k in pole if k in stary and stary[k] is not None}, **zmeny}


def najdi(seznam, id_):
    x = next((x for x in seznam if x.get("id") == id_), None)
    if x is None:
        raise api.ChybaAPI(f"#{id_} neexistuje.", 404)
    return x


POLE_ZAZNAMU = ("volumeKey", "imageNo", "kind", "dateText", "year", "title", "summary", "url", "transcriptOrig", "transcriptCs", "review")
POLE_UKOLU = ("title", "body", "kind", "status", "priority", "personIds")
POLE_HYPOTEZY = ("personId", "title", "text", "items", "recordKeys")
POLE_OTAZKY = ("personId", "question", "answer", "state")


def nacti_nebo(fn):
    """Tělo z --json-vstup (-j), jinak z voleb."""
    return json_z(A.vstup) if getattr(A, "vstup", None) else fn()


# ---------- osoby ----------

def osoba_ukaz():
    d = api.get(f"osoby/{A.id}")

    def text(d):
        jm = {}
        ids = {r["aId"] for r in d.get("relations", [])} | {r["bId"] for r in d.get("relations", [])}
        for i in ids - {d["id"]}:
            try:
                jm[i] = api.jmeno(api.get(f"osoby/{i}"))
            except api.ChybaAPI:
                jm[i] = "?"
        print(f"{api.jmeno(d)}  [{d['id']}]  {d.get('yearsText') or ''}  jistota {d['certainty']}  pohlaví {d['sex']}"
              + ("  ŽIJÍCÍ" if d.get("living") else "") + (f"  = tatáž osoba jako {d['sameAsId']}" if d.get("sameAsId") else "")
              + f"  rod {d.get('lineSlug') or '– (bez rodu)'}")
        for n in d.get("names", []):
            if not n.get("isPrimary"):
                print(f"  jméno ({n['kind']}): {n['given']} {n['surname']}  [{n['certainty']}]  #{n['id']}")
        for k in ("note", "notePrivate"):
            if d.get(k):
                print(f"  {'pozn.' if k == 'note' else 'soukromá pozn.'}: {d[k]}")
        rodice = [r for r in d.get("relations", []) if r["type"] == "rodic" and r["bId"] == d["id"]]
        deti = [r for r in d.get("relations", []) if r["type"] == "rodic" and r["aId"] == d["id"]]
        manz = [r for r in d.get("relations", []) if r["type"] == "manzele"]
        druhy = lambda r: r["bId"] if r["aId"] == d["id"] else r["aId"]
        for nazev, rs, f in (("rodiče", rodice, lambda r: r["aId"]), ("manželé", manz, druhy), ("děti", deti, lambda r: r["bId"])):
            if rs:
                print(f"  {nazev}: " + "; ".join(f"{jm.get(f(r), '?')} [{f(r)}] ({r['certainty']}, vztah #{r['id']})" for r in rs))
        for e in d.get("events", []):
            misto = e.get("placeText") or e.get("placeSlug") or ""
            if e.get("houseKey"):
                misto += f" (dům {e['houseKey']})"
            zdr = ", ".join(s.get("recordKey") or f"vodítko {s.get('tipId')}" if s.get("recordKey") or s.get("tipId") else f"dok. {s.get('documentId')}"
                            for s in e.get("sources", []))
            role = f" (jako {e['role']})" if e.get("role") and e["role"] != "hlavni" else ""
            print(f"  {SYMBOL.get(e['type'], e['type'])}{role} {e.get('dateText') or ''} {misto} {e.get('text') or ''}".rstrip()
                  + f"  [{e['certainty']}]  #{e['id']}" + (f"  zdroj: {zdr}" if zdr else "  BEZ ZDROJE"))
        for b in d.get("residences", []):
            print(f"  bydliště: {b.get('placeText') or b.get('placeSlug') or ''} čp. {b.get('cp') or '?'} "
                  f"{b.get('fromText') or ''}–{b.get('toText') or ''} {b.get('role') or ''} [{b['certainty']}] #{b['id']}")
        for z in d.get("records", []):
            print(f"  zápis: {z['key']} ({z['role']}) {z['title']}  [{z['review']}]")
        for s in d.get("sideNotes", []):
            print(f"  boční: {s.get('title')}")
        if d.get("relationToViewer"):
            print(f"  vůči tobě: {d['relationToViewer'].get('label')}")
    out(d, text)


def _radek_osoby(x):
    jm = x.get("name") or ""
    pres = f" [zapsán(a) jako {x['matchedName']}]" if x.get("matchedName") and x["matchedName"] != jm else ""
    rok = x.get("yearsText") or ""
    vz = f" · {x['relationToViewer']}" if x.get("relationToViewer") else ""
    print(f"{x['id']} | {jm} | {rok} | {x.get('certainty') or ''}{vz}{pres}")
    for m in x.get("matches", [])[:3]:
        print(f"    {m.get('kind')} {m.get('year') or ''}: {(m.get('text') or '')[:90]}")


def osoba_hledej():
    """Jméno (snese tvary z matrik: Wanek, Konjř, Nowakin) a/nebo místo a roky (--misto, --od, --do, --udalost)."""
    q = {"q": A.text or None, "limit": A.limit, "misto": A.misto, "od": A.od, "do": A.do, "udalost": A.udalost}
    out(api.get("osoby", **q), lambda d: [_radek_osoby(x) for x in d] or print(f"({len(d)})"))


def osoba_seznam():
    out(api.get("osoby"), lambda d: [print(f"{x['id']} | {x['name']} | {x.get('yearsText') or ''} | {x['certainty']}") for x in d] or print(f"({len(d)})"))


def osoba_pridej():
    def z_voleb():
        if not A.sex:
            raise api.ChybaAPI("Zadej --sex M|F|U (nebo celý JSON přes -j).")
        ev = []
        for typ, dat in (("narozeni", A.narozeni), ("umrti", A.umrti)):
            if dat:
                ev.append(bez_none({"type": typ, "dateText": dat, "placeSlug": A.misto if typ == "narozeni" else None,
                                    "certainty": A.jistota, "sources": zdroje()}))
        return bez_none({"id": A.id, "sex": A.sex, "given": A.jmeno or "", "surname": A.prijmeni or "", "certainty": A.jistota,
                         "yearsText": A.roky, "note": A.pozn, "living": ano_ne(A.zije), "events": ev, "sources": zdroje()})
    ok(api.post("osoby", nacti_nebo(z_voleb)), "osoba")


def osoba_uprav():
    def z_voleb():
        d = bez_none({"sex": A.sex, "certainty": A.jistota, "yearsText": A.roky, "note": A.pozn, "notePrivate": A.pozn_soukroma,
                      "placeholder": ano_ne(A.zastupna)})
        if A.zije is not None:
            d["living"] = ano_ne(A.zije)
        if A.tataz is not None:
            d["sameAsId"] = None if A.tataz == "-" else A.tataz
        return d
    ok(api.patch(f"osoby/{A.id}", nacti_nebo(z_voleb)), "osoba upravena")


def osoba_jmeno():
    ok(api.post(f"osoby/{A.id}/jmena", bez_none({"given": A.jmeno or "", "surname": A.prijmeni or "", "kind": A.druh,
                                                 "certainty": A.jistota, "note": A.pozn})), "jméno")


def osoba_bocni():
    ok(api.post(f"osoby/{A.id}/bocni", {"title": A.titulek, "text": open(A.text, encoding="utf-8").read() if os.path.isfile(A.text) else A.text}), "boční příbuzní")


def osoba_smaz():
    ok(api.delete(f"osoby/{A.id}"), "osoba smazána")


# ---------- vztahy, události, bydliště, citace ----------

def vztah_pridej():
    ok(api.post("vztahy", bez_none({"type": A.typ, "aId": A.a, "bId": A.b, "certainty": A.jistota, "note": A.pozn, "sources": zdroje()})), "vztah")


def vztah_uprav():
    ok(api.patch(f"vztahy/{A.id}", bez_none({"certainty": A.jistota, "note": A.pozn})), "vztah upraven")


def vztah_smaz():
    ok(api.delete(f"vztahy/{A.id}"), "vztah smazán")


def _udalost_z_voleb(uprava=False):
    d = bez_none({"type": getattr(A, "typ", None), "dateText": A.datum, "placeSlug": A.misto, "houseKey": A.dum, "placeText": A.misto_text,
                  "text": A.text, "certainty": A.jistota, "note": A.pozn})
    if not uprava:
        d["persons"] = [{"personId": A.osoba, "role": A.role}] + [
            {"personId": p.split(":")[0], "role": p.split(":", 1)[1] if ":" in p else "hlavni"} for p in (A.dalsi or [])]
        d["sources"] = zdroje()
    return d


def udalost_pridej():
    if not A.vstup and not (A.typ and A.osoba):
        raise api.ChybaAPI("Zadej TYP a OSOBU (nebo celý JSON přes -j).")
    ok(api.post("udalosti", nacti_nebo(_udalost_z_voleb)), "událost")


def udalost_uprav():
    d = nacti_nebo(lambda: _udalost_z_voleb(True))
    if "certainty" not in d:   # API by chybějící jistotu přepsalo na „unk“ (výchozí hodnota v PATCH)
        raise api.ChybaAPI("Zadej i --jistota (doc/prob/…) – API by ji jinak nastavilo na „unk“. Aktuální: rdb.py osoba ukaz <id>.")
    ok(api.patch(f"udalosti/{A.id}", d), "událost upravena")


def udalost_smaz():
    ok(api.delete(f"udalosti/{A.id}"), "událost smazána")


def bydliste_pridej():
    def z_voleb():
        return bez_none({"personId": A.osoba, "placeSlug": A.misto, "houseKey": A.dum, "placeText": A.misto_text, "cp": A.cp,
                         "fromText": A.od, "toText": A.do, "role": A.role, "certainty": A.jistota, "note": A.pozn, "sources": zdroje()})
    ok(api.post("bydliste", nacti_nebo(z_voleb)), "bydliště")


def bydliste_smaz():
    ok(api.delete(f"bydliste/{A.id}"), "bydliště smazáno")


def citace_pridej():
    s = zdroje()
    if len(s) != 1:
        raise api.ChybaAPI("Zadej právě jeden zdroj: --zaznam KLIC, --voditko ID nebo --dokument ID.")
    cil = bez_none({"eventId": A.udalost, "relationId": A.vztah, "residenceId": A.bydliste, "personId": A.osoba})
    if len(cil) != 1:
        raise api.ChybaAPI("Zadej právě jeden cíl: --udalost, --vztah, --bydliste nebo --osoba.")
    ok(api.post("citace", {**cil, **s[0], **({"note": A.pozn} if A.pozn else {})}), "citace")


def citace_smaz():
    ok(api.delete(f"citace/{A.id}"), "citace smazána")


# ---------- prameny ----------

def zaznam_ukaz():
    def text(d):
        print(f"{d['key']} | {d['kind']} | {d.get('dateText') or ''} | {d['title']}  [{d['review']}]")
        if d.get("volume"):
            print(f"  svazek: {d['volume']['key']} – {d['volume']['title']} ({d['volume']['archive']}), snímek {d.get('imageNo') or '?'}")
        if d.get("url"):
            print(f"  odkaz: {d['url']}")
        if d.get("summary"):
            print(f"  shrnutí: {d['summary']}")
        for p in d.get("persons", []):
            print(f"  osoba: {p['personId']} ({p['role']}) {p.get('given') or ''} {p.get('surname') or ''}"
                  + (f" – v zápisu „{p['nameAsWritten']}“" if p.get("nameAsWritten") else ""))
        print("  výřez: " + (", ".join(f"{i['variant']} {i.get('width')}×{i.get('height')} /media/{i['sha256'][:12]}…" for i in d.get("images", [])) or "CHYBÍ"))
        print("  rámeček: " + (json.dumps(d["highlight"].get("boxes")) if d.get("highlight") else "chybí"))
        for k, n in (("transcriptOrig", "přepis"), ("transcriptCs", "překlad")):
            if d.get(k):
                print(f"  {n}:\n    " + d[k].replace("\n", "\n    "))
    out(api.get(f"zaznamy/{A.klic}"), text)


def zaznam_hledej():
    out(api.get("zaznamy", q=A.text, svazek=A.svazek, review=A.review, osoba=A.osoba, limit=A.limit),
        lambda d: [print(f"{x['key']} | {x['kind']} {x.get('dateText') or x.get('year') or ''} | {x['title']} | {x['review']}") for x in d] or print(f"({len(d)})"))


def zaznam_pridej():
    ok(api.put(f"zaznamy/{A.klic}", json_z(A.soubor)), "zápis")


def zaznam_uprav():
    def z_voleb():
        d = bez_none({"review": A.review, "title": A.titulek, "summary": A.shrnuti, "dateText": A.datum, "url": A.url,
                      "volumeKey": A.svazek, "imageNo": A.snimek})
        for k, f in (("transcriptOrig", A.prepis), ("transcriptCs", A.preklad)):
            if f:
                d[k] = open(f, encoding="utf-8").read().strip() if f != "-" else sys.stdin.read().strip()
        return d
    ok(api.patch(f"zaznamy/{A.klic}", slouc(api.get(f"zaznamy/{A.klic}"), nacti_nebo(z_voleb), POLE_ZAZNAMU)), "zápis upraven")


def zaznam_smaz():
    ok(api.delete(f"zaznamy/{A.klic}"), "zápis smazán")


def svazek_ukaz():
    def text(d):
        obecne({k: v for k, v in d.items() if k != "records"})
        for z in d.get("records", []):
            print(f"  {z['key']} | snímek {z.get('imageNo') or '?'} | {z['title']}")
    out(api.get(f"svazky/{A.klic}"), text)


def svazek_seznam():
    out(api.get("svazky"), lambda d: [print(f"{x['key']} | {x['title']} | {x['archive']}") for x in d] or print(f"({len(d)})"))


def svazek_pridej():
    ok(api.put(f"svazky/{A.klic}", nacti_nebo(lambda: bez_none({"archive": A.archiv, "portal": A.portal, "title": A.nazev,
                                                                 "description": A.popis, "url": A.url}))), "svazek")


def nalez():
    d = api.post("nalez", json_z(A.soubor))
    if A.json:
        vypis_json(d)
        return
    print(f"OK – nález uložen: zápis {d['recordKey']}")
    for k, n in (("people", "nové osoby"), ("relations", "vztahy"), ("events", "události"), ("residences", "bydliště")):
        if d.get(k):
            print(f"  {n}: {', '.join(map(str, d[k]))}")
    if d.get("logId"):
        print(f"  deník: #{d['logId']}")
    print(f"Dál: python3 -I tools/vyrez.py <snímek> {d['recordKey']} x0,y0,x1,y1  a  tools/ramecek.py {d['recordKey']} …")


def vyrez_nahraj():
    d = api.put_soubor(f"zaznamy/{A.klic}/vyrez", A.soubor, varianta="plny" if A.plny else "web")
    out(d, f"OK – výřez ({d['variant']}, {d.get('width')}×{d.get('height')} px) nahrán k {A.klic}: {d['url']}")


def zvyrazneni():
    d = json_z(A.data)
    if isinstance(d, list):
        d = {"boxes": d}
    ok(api.put(f"zaznamy/{A.klic}/zvyrazneni", d), "rámeček")


# ---------- místa, domy, příjmení ----------

def misto_hledej():
    out(api.get("mista", q=A.text), lambda d: [print(f"{x['slug']} | {x['name']}" + (f" (shoda: {x['matched']})" if x.get("matched") != x["name"] else "")) for x in d] or print(f"({len(d)})"))


def misto_seznam():
    out(api.get("mista"), lambda d: [print(f"{x['slug']} | {x['name']} | {x.get('lat') or '?'}, {x.get('lon') or '?'}" + (" | hypotéza" if x.get("hypothesis") else "")) for x in d] or print(f"({len(d)})"))


def misto_ukaz():
    def text(d):
        print(f"{d['slug']} | {d['name']} | {d.get('kind') or ''} | {d.get('lat')}, {d.get('lon')}" + (" | HYPOTÉZA" if d.get("hypothesis") else ""))
        for k in ("parentSlug", "query", "pattern", "osm", "description"):
            if d.get(k):
                print(f"  {k}: {d[k]}")
        for n in d.get("names", []):
            print(f"  název: {n['name']}" + (f" ({n['lang']})" if n.get("lang") else "") + (f" – {n['note']}" if n.get("note") else ""))
        for e in d.get("events", []):
            print(f"  {e.get('year') or ''}: {e['text']}")
        for h in d.get("houses", []):
            print(f"  dům: {h['key']} čp. {h['cp']} {h.get('name') or ''}")
    out(api.get(f"mista/{A.slug}"), text)


def misto_pridej():
    """Založí místo, nebo doplní uvedená pole u existujícího (ostatní zůstanou)."""
    novy = nacti_nebo(lambda: bez_none({"name": A.nazev, "kind": A.druh, "parentSlug": A.nadrazene, "lat": A.lat, "lon": A.lon,
                                        "query": A.dotaz, "pattern": A.vzor, "description": A.popis,
                                        "hypothesis": True if A.hypoteza else None}))
    if "names" in novy:   # seznam názvů posílá PUT celý (nahradí stávající)
        ok(api.put(f"mista/{A.slug}", novy), "místo")
        return
    ok(api.uloz_misto(A.slug, **novy), "místo")


def misto_nazev():
    ok(api.post(f"mista/{A.slug}/nazvy", bez_none({"name": A.nazev, "lang": A.jazyk, "note": A.pozn})), "název místa")


def misto_udalost():
    ok(api.post(f"mista/{A.slug}/udalosti", bez_none({"year": A.rok, "text": A.text, "certainty": A.jistota,
                                                      "recordKey": (A.zaznam or [None])[0]})), "událost obce")


def dum_ukaz():
    def text(d):
        print(f"{d['key']} | {d['placeSlug']} čp. {d['cp']} | {d.get('name') or ''} | {d['certainty']}")
        if d.get("description"):
            print(f"  {d['description']}")
        for n in d.get("numbers", []):
            print(f"  číslo {n['period']}: {n['number']}")
        for h in d.get("holders", []):
            print(f"  držitel: {h['name']} {h.get('fromText') or ''}–{h.get('toText') or ''} {h.get('how') or ''} [{h['certainty']}]"
                  + (f" → {h['personId']}" if h.get("personId") else ""))
        for h in d.get("inhabitants", []):
            print(f"  obyvatel: {h['name']} {h.get('yearsText') or ''} {h.get('role') or ''}" + (f" → {h['personId']}" if h.get("personId") else ""))
        for r in d.get("residents", []):
            print(f"  bydliště osoby: {r['personId']} {r.get('fromText') or ''}–{r.get('toText') or ''}")
        for e in d.get("events", []):
            print(f"  {e.get('year') or ''}: {e['text']}")
    out(api.get(f"domy/{A.klic}"), text)


def dum_seznam():
    out(api.get("domy"), lambda d: [print(f"{x['key']} | {x['placeSlug']} čp. {x['cp']} | {x.get('name') or ''}") for x in d] or print(f"({len(d)})"))


def dum_pridej():
    d = json_z(A.soubor)
    ok(api.put(f"domy/{A.klic}", d) if A.klic else api.post("domy", d), "dům")


def prijmeni_hledej():
    out(api.get("prijmeni", q=A.text), lambda d: [print(f"{x['surname']} ~ {x['variant']}" + (f"  ({x['note']})" if x.get("note") else "")) for x in d] or print(f"({len(d)})"))


def prijmeni_pridej():
    d = api.post("prijmeni", bez_none({"surname": A.prijmeni, "variant": A.varianta, "note": A.pozn}))
    out(d, "OK – varianta uložena" if d else "už existuje")


# ---------- vodítka, deník, úkoly ----------

def nazvy_rodu():
    return {x["slug"]: x["name"] for x in api.get("rody")["rody"]}


PRARODIC = {4: "otcův otec", 5: "otcova matka", 6: "matčin otec", 7: "matčina matka"}


def po_vetvich(d, radek_):
    """Výpis seskupený pod větve prarodičů kořene (--vetev), na konci „mimo větve“ (blízcí, přiženění, bez osob)."""
    jm = {x["k"]: x["name"] for x in api.get("graf/kekule", koren=A.vetev) if 4 <= x["k"] <= 7}
    skupiny = {}
    for x in d:
        for k in x.get("branches") or [None]:
            skupiny.setdefault(k, []).append(x)
    for k in sorted(skupiny, key=lambda k: (k is None, k or 0)):
        print(f"\n## {f'{jm.get(k, k)} ({PRARODIC[k]})  [--prarodic {k}]' if k else 'mimo větve (kořen, rodiče, sourozenci, přiženění, bez osob)'}  ({len(skupiny[k])})")
        for x in skupiny[k]:
            jine = [jm.get(o, str(o)) for o in x.get("branches", []) if o != k]
            print(radek_(x) + (f"  (i: {', '.join(jine)})" if jine else ""))
    print(f"\n({len(d)} celkem)")


def po_rodech(d, radek_):
    """Výpis seskupený pod rody (položka s víc rody je u každého s „(i: …)“), na konci „bez rodu“."""
    if A.vetev and not A.prarodic:
        return po_vetvich(d, radek_)
    if A.rod or A.prarodic:   # jeden rod / jedna větev – bez nadpisů
        for x in d:
            print(radek_(x))
        print(f"({len(d)})")
        return
    jm = nazvy_rodu()
    skupiny = {}
    for x in d:
        for s in x.get("lines") or [None]:
            skupiny.setdefault(s, []).append(x)
    for s in sorted(skupiny, key=lambda s: (s is None, jm.get(s, s or ""))):
        print(f"\n## {jm.get(s, s) + f'  [--rod {s}]' if s else 'bez rodu  [--rod bez]'}  ({len(skupiny[s])})")
        for x in skupiny[s]:
            jine = [jm.get(o, o) for o in x.get("lines", []) if o != s]
            print(radek_(x) + (f"  (i: {', '.join(jine)})" if jine else ""))
    print(f"\n({len(d)} celkem)")


def voditko_seznam():
    def radek_(x):
        os_ = ", ".join(f"{p.get('name') or p['personId']} [{p['personId']}]" for p in x.get("persons", []))
        return (f"#{x['id']} [{x['status']}] {x['kind']} {datum(x.get('receivedAt'))[:10]}"
                + (f" od {x.get('toldByName') or x.get('toldByPersonId')}" if x.get("toldByName") or x.get("toldByPersonId") else "")
                + f": {x['text']}" + (f"  → osoby: {os_}" if os_ else "") + (f"  → zápisy: {', '.join(x['recordKeys'])}" if x.get("recordKeys") else "")
                + (f"  ({x['resolutionNote']})" if x.get("resolutionNote") else ""))
    out(api.get("voditka", stav=A.stav, osoba=A.osoba, rod=A.rod, vetev=A.vetev, prarodic=A.prarodic, otevrena=A.otevrena, q=A.text, limit=A.limit), lambda d: po_rodech(d, radek_))


def voditko_ukaz():
    out(api.get(f"voditka/{A.id}"))


def voditko_pridej():
    d = nacti_nebo(lambda: bez_none({"kind": A.druh, "text": A.text, "personIds": A.osoba or [], "toldByPersonId": A.od_osoby,
                                     "toldByName": A.od_jmena, "channel": A.kanal, "sensitive": True if A.citlive else None}))
    ok(api.post("voditka", d), "vodítko")


def voditko_uprav():
    ok(api.patch(f"voditka/{A.id}", nacti_nebo(lambda: bez_none({"text": A.text, "personIds": A.osoba}))), "vodítko upraveno")


def voditko_stav():
    ok(api.patch(f"voditka/{A.id}", bez_none({"status": A.stav, "resolutionNote": A.poznamka, "recordKeys": A.zaznam or None})), "stav vodítka")


def _denik_text(d):
    if A.vetev and not A.prarodic:
        return po_vetvich(list(reversed(d)), _denik_radek)
    for x in reversed(d):
        print(_denik_radek(x))
    print(f"({len(d)})")


def _denik_radek(x):
    r = (f"#{x['id']} {datum(x['at'])} [{x['result']}] {x['title']}" + (f"  | rody {', '.join(x['lines'])}" if x.get("lines") else "")
         + (f"  | svazek {x['volumeKey']}" if x.get("volumeKey") else "") + (f" {x['pages']}" if x.get("pages") else "")
         + (f"  | osoby {', '.join(x['personIds'])}" if x.get("personIds") else "")
         + (f"  | zápisy {', '.join(x['recordKeys'])}" if x.get("recordKeys") else ""))
    if x.get("textMd") and A.cely:
        r += "\n    " + x["textMd"].replace("\n", "\n    ")
    elif x.get("textMd"):
        t = x["textMd"].replace("\n", " ")
        r += "\n    " + (t if len(t) < 300 else t[:300] + " …")
    return r


def denik_posledni():
    out(api.get("denik", limit=A.n, rod=A.rod, vetev=A.vetev, prarodic=A.prarodic), _denik_text)


def denik_hledej():
    out(api.get("denik", q=A.text, osoba=A.osoba, rod=A.rod, vetev=A.vetev, prarodic=A.prarodic, svazek=A.svazek, vysledek=A.vysledek, limit=A.limit), _denik_text)


def denik_pridej():
    def z_voleb():
        text = A.text
        if text and os.path.isfile(text):
            text = open(text, encoding="utf-8").read()
        return bez_none({"title": A.titulek, "textMd": text, "volumeKey": A.svazek, "pages": A.snimky, "result": A.vysledek,
                         "personIds": A.osoba or [], "recordKeys": A.zaznam or [], "tipIds": [int(t) for t in A.voditko or []],
                         "author": A.autor})
    ok(api.post("denik", nacti_nebo(z_voleb)), "deník")


def denik_uprav():
    ok(api.patch(f"denik/{A.id}", nacti_nebo(lambda: bez_none({"title": A.titulek, "textMd": A.text, "result": A.vysledek, "personIds": A.osoba,
                                                              "recordKeys": A.zaznam}))), "deník upraven")


def ukol_seznam():
    radek_ = lambda x: (f"#{x['id']} [{x['status']}] P{x['priority']} {x['title']}" + (f"  | osoby {', '.join(x['personIds'])}" if x.get("personIds") else "")
                        + (f"\n    {x['body']}" if x.get("body") else ""))
    out(api.get("ukoly", stav=A.stav, vse=A.vse, rod=A.rod, vetev=A.vetev, prarodic=A.prarodic), lambda d: po_rodech(d, radek_))


def ukol_pridej():
    ok(api.post("ukoly", bez_none({"title": A.titulek, "body": A.text, "kind": A.druh, "priority": A.priorita, "personIds": A.osoba or []})), "úkol")


def ukol_stav():
    ok(api.patch(f"ukoly/{A.id}", slouc(najdi(api.get("ukoly", vse=True), A.id), {"status": A.stav}, POLE_UKOLU)), "stav úkolu")


def ukol_uprav():
    zmeny = nacti_nebo(lambda: bez_none({"title": A.titulek, "body": A.text, "priority": A.priorita, "status": A.stav, "personIds": A.osoba}))
    ok(api.patch(f"ukoly/{A.id}", slouc(najdi(api.get("ukoly", vse=True), A.id), zmeny, POLE_UKOLU)), "úkol upraven")


# ---------- výklad ----------

def pribeh_seznam():
    out(api.get("pribehy"), lambda d: [print(f"{x['slug']} | {x['kind']} | {x['title']}") for x in d] or print(f"({len(d)})"))


def pribeh_ukaz():
    out(api.get(f"pribehy/{A.slug}"), lambda d: print(f"# {d['title']}\n" + (f"\n_{d['lead']}_\n" if d.get("lead") else "") + f"\n{d.get('bodyMd') or ''}"))


def pribeh_uloz():
    telo = open(A.soubor, encoding="utf-8").read() if A.soubor != "-" else sys.stdin.read()
    try:
        stary = api.get(f"pribehy/{A.slug}")
    except api.ChybaAPI as e:
        if e.status != 404:
            raise
        stary = {}
    titulek = A.titulek or stary.get("title")
    if not titulek and telo.lstrip().startswith("# "):   # nadpis z prvního řádku souboru
        prvni, _, telo = telo.lstrip().partition("\n")
        titulek, telo = prvni[2:].strip(), telo.lstrip("\n")
    if not titulek:
        raise api.ChybaAPI("Chybí --titulek (nebo nadpis „# …“ na prvním řádku souboru).")
    d = {"title": titulek, "bodyMd": telo, "kind": A.druh or stary.get("kind") or "pribeh",
         "lead": A.perex if A.perex is not None else stary.get("lead"), "lineSlug": A.rod or stary.get("lineSlug"),
         "houseKey": A.dum or stary.get("houseKey"), "sort": A.poradi if A.poradi is not None else stary.get("sort", 0)}
    ok(api.put(f"pribehy/{A.slug}", d), "příběh")


def rod_seznam():
    def text(d):
        for x in d["rody"]:
            print(f"{x['slug']} | {x['name']}{' (dopočítaný)' if x.get('auto') else ''} | vrchol {x.get('topId') or '?'} | {x['size']} osob"
                  f" | vodítka {x['openTips']}, úkoly {x['openTasks']}" + (f" | {x['description']}" if x.get("description") else ""))
        b = d["bezRodu"]
        print(f"bez rodu | vodítka {b['openTips']}, úkoly {b['openTasks']}")
        for c in d.get("conflicts", []):
            print("KONFLIKT:", c)
        print(f"({len(d['rody'])} rodů)")
    out(api.get("rody", pro=A.pro), text)


def rod_ukaz():
    def text(d):
        print(f"{d['name']}  [{d['slug']}]{' – dopočítaný' if d.get('auto') else ''}  vrchol {d.get('topId')}  zakladatel {d.get('founderId')}")
        if d.get("description"):
            print(f"  {d['description']}")
        for m in sorted(d["members"], key=lambda m: m.get("birthYear") or 9999):
            print(f"  {m['name']} [{m['id']}]" + (f" * {m['birthYear']}" if m.get("birthYear") else ""))
        print(f"({len(d['members'])} osob)")
    out(api.get(f"rody/{A.slug}"), text)


def rod_pridej():
    ok(api.put(f"rody/{A.slug}", bez_none({"name": A.nazev, "description": A.popis, "color": A.barva, "founderId": A.zakladatel})), "rod")


def hypoteza_seznam():
    out(api.get("hypotezy"))


def hypoteza_pridej():
    ok(api.post("hypotezy", nacti_nebo(lambda: bez_none({"title": A.titulek, "text": A.text, "personId": A.osoba, "recordKeys": A.zaznam or []}))), "hypotéza")


def hypoteza_uprav():
    zmeny = nacti_nebo(lambda: bez_none({"title": A.titulek, "text": A.text, "personId": A.osoba, "recordKeys": A.zaznam}))
    ok(api.patch(f"hypotezy/{A.id}", slouc(najdi(api.get("hypotezy"), A.id), zmeny, POLE_HYPOTEZY)), "hypotéza upravena")


def hypoteza_smaz():
    ok(api.delete(f"hypotezy/{A.id}"), "hypotéza smazána")


def otazka_seznam():
    out(api.get("otazky"), lambda d: [print(f"#{x['id']} [{x['state']}] {x['question']}" + (f" → {x['answer']}" if x.get("answer") else "")) for x in d] or print(f"({len(d)})"))


def otazka_pridej():
    ok(api.post("otazky", bez_none({"question": A.otazka, "personId": A.osoba, "state": A.stav, "answer": A.odpoved})), "otázka")


def otazka_uprav():
    zmeny = bez_none({"question": A.otazka, "state": A.stav, "answer": A.odpoved})
    ok(api.patch(f"otazky/{A.id}", slouc(najdi(api.get("otazky"), A.id), zmeny, POLE_OTAZKY)), "otázka upravena")


# ---------- graf, kontrola, hledání ----------

def kekule():
    out(api.get("graf/kekule", koren=A.koren), lambda d: [print(f"{x['k']:>6}  {x['id']}  {x['name']}") for x in d] or print(f"({len(d)})"))


def pribuznost():
    def text(d):
        print(f"{A.k} je pro {A.od}: {d.get('label')}" + (f"  (přes {d['via']}, nahoru {d.get('up')}, dolů {d.get('down')})" if d.get("via") else ""))
    out(api.get("graf/pribuznost", od=A.od, k=A.k), text)


def predci():
    out(api.get("graf/predci", id=A.id), lambda d: [print(f"gen {x['gen']:>2}  {x['id']}  {x.get('name') or ''}") for x in d] or print(f"({len(d)})"))


def kontrola():
    d = api.get("kontrola")

    def text(d):
        for c in d.get("chyby", []):
            print("CHYBA:", c)
        if d.get("upozorneni"):
            print(f"Upozornění ({len(d['upozorneni'])}):")
            for u in d["upozorneni"]:
                print(f"  - {u}")
        if d.get("keKontrole"):
            print(f"Zápisy ke kontrole ({len(d['keKontrole'])}): {', '.join(d['keKontrole'])}")
        if not d.get("chyby") and not d.get("keKontrole") and not d.get("upozorneni"):
            print("Kontrola v pořádku – žádné chyby, upozornění ani nic ke kontrole.")
    out(d, text)
    if d.get("chyby"):
        sys.exit(1)


def hledat():
    def text(d):
        for k, nazev in (("persons", "osoby"), ("places", "místa"), ("records", "zápisy"), ("log", "deník"), ("tips", "vodítka")):
            if d.get(k):
                print(f"## {nazev}")
                for x in d[k]:
                    print("  " + radek(x))
        if not any(d.get(k) for k in d):
            print("Nic nenalezeno.")
    out(api.get("hledat", q=A.text), text)


def ja():
    out(api.get("ja"))


def obecne_api():
    m = A.metoda.upper()
    if A.soubor_bin:
        if m != "PUT":
            raise api.ChybaAPI("--binarni jde jen s PUT.")
        d = api.put_soubor(A.cesta, A.soubor_bin)
    else:
        telo = json_z(A.data) if A.data else None
        d = api.volani(m, A.cesta, telo if telo is not None or m in ("GET", "DELETE") else {})
    vypis_json(d)


# ---------- parser ----------

def main():
    global A
    spolecne = argparse.ArgumentParser(add_help=False)
    spolecne.add_argument("--json", action="store_true", default=argparse.SUPPRESS, help="surová data z API")
    p = argparse.ArgumentParser(prog="rdb.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, parents=[spolecne])
    sub = p.add_subparsers(dest="oblast", metavar="oblast", required=True)

    def oblast(nazev, napoveda):
        s = sub.add_parser(nazev, help=napoveda, parents=[spolecne])
        return s.add_subparsers(dest="akce", metavar="akce", required=True)

    def akce(sp, nazev, fn, napoveda):
        x = sp.add_parser(nazev, help=napoveda, description=napoveda, parents=[spolecne])
        x.set_defaults(fn=fn)
        return x

    def vstup(x):
        x.add_argument("-j", "--vstup", metavar="JSON", help="celé tělo jako JSON (soubor nebo -); volby se pak ignorují")

    def zdr(x):
        x.add_argument("--zaznam", action="append", metavar="KLIC", help="zdroj: zápis (lze opakovat)")
        x.add_argument("--voditko", action="append", metavar="ID", help="zdroj: vodítko")
        x.add_argument("--dokument", action="append", metavar="ID", help="zdroj: rodinný dokument")

    # osoba
    o = oblast("osoba", "osoby (jména, události, vztahy)")
    x = akce(o, "ukaz", osoba_ukaz, "detail osoby"); x.add_argument("id")
    x = akce(o, "hledej", osoba_hledej, "hledání podle jména (tvary z matrik) a/nebo místa a let")
    x.add_argument("text", nargs="?"); x.add_argument("--limit", type=int, default=30)
    x.add_argument("--misto", help="slug místa (rdb.py misto hledej …)"); x.add_argument("--od", type=int); x.add_argument("--do", type=int)
    x.add_argument("--udalost", choices=["narozeni", "krest", "snatek", "umrti", "pohreb", "bydliste"])
    akce(o, "seznam", osoba_seznam, "všechny osoby")
    x = akce(o, "pridej", osoba_pridej, "nová osoba (volby nebo -j JSON podle PersonIn)"); vstup(x); zdr(x)
    x.add_argument("--id", help="slug jmeno-prijmeni-rok (jinak ho vytvoří API)"); x.add_argument("--sex", choices=["M", "F", "U"])
    x.add_argument("--jmeno"); x.add_argument("--prijmeni"); x.add_argument("--jistota", choices=JISTOTA, default="unk")
    x.add_argument("--roky", help="text let pro přehledy, např. „asi 1720–1785“"); x.add_argument("--pozn")
    x.add_argument("--narozeni", metavar="DATUM"); x.add_argument("--umrti", metavar="DATUM"); x.add_argument("--misto", metavar="SLUG", help="místo narození")
    x.add_argument("--zije", choices=["ano", "ne", "auto"])
    x = akce(o, "uprav", osoba_uprav, "úprava osoby"); x.add_argument("id"); vstup(x)
    x.add_argument("--sex", choices=["M", "F", "U"]); x.add_argument("--jistota", choices=JISTOTA); x.add_argument("--roky"); x.add_argument("--pozn")
    x.add_argument("--pozn-soukroma"); x.add_argument("--zije", choices=["ano", "ne", "auto"]); x.add_argument("--tataz", metavar="ID|-")
    x.add_argument("--zastupna", choices=["ano", "ne"], help="zástupná osoba („otec neuveden“)")
    x = akce(o, "jmeno", osoba_jmeno, "další jméno (po sňatku, varianta, tvar v zápisu)"); x.add_argument("id")
    x.add_argument("--jmeno"); x.add_argument("--prijmeni"); x.add_argument("--druh", choices=["rodne", "po_snatku", "varianta", "v_zapisu"], default="varianta")
    x.add_argument("--jistota", choices=JISTOTA, default="unk"); x.add_argument("--pozn")
    x = akce(o, "bocni", osoba_bocni, "souhrn o bočních příbuzných"); x.add_argument("id"); x.add_argument("--titulek", required=True); x.add_argument("--text", required=True, help="text nebo soubor .md")
    x = akce(o, "smaz", osoba_smaz, "smazání osoby (admin)"); x.add_argument("id")

    # vztah
    o = oblast("vztah", "vztahy rodič–dítě a manželé")
    x = akce(o, "pridej", vztah_pridej, "rodic A B = A je rodič B; manzele A B"); x.add_argument("typ", choices=["rodic", "manzele"]); x.add_argument("a"); x.add_argument("b")
    x.add_argument("--jistota", choices=JISTOTA, default="unk"); x.add_argument("--pozn"); zdr(x)
    x = akce(o, "uprav", vztah_uprav, "jistota / poznámka vztahu"); x.add_argument("id", type=int); x.add_argument("--jistota", choices=JISTOTA); x.add_argument("--pozn")
    x = akce(o, "smaz", vztah_smaz, "smazání vztahu"); x.add_argument("id", type=int)

    # událost
    def udalost_volby(x):
        x.add_argument("--datum", help="„12. 3. 1850“, „asi 1720“, „před 1740“, „1720–1785“")
        x.add_argument("--misto", metavar="SLUG"); x.add_argument("--dum", metavar="KLIC"); x.add_argument("--misto-text")
        x.add_argument("--text", help="např. povolání"); x.add_argument("--jistota", choices=JISTOTA); x.add_argument("--pozn")
    o = oblast("udalost", "události (narození, křest, sňatek, úmrtí, povolání…)")
    x = akce(o, "pridej", udalost_pridej, "nová událost"); x.add_argument("typ", nargs="?", choices=UDALOSTI); x.add_argument("osoba", nargs="?")
    vstup(x); udalost_volby(x); zdr(x); x.add_argument("--role", default="hlavni"); x.add_argument("--dalsi", action="append", metavar="OSOBA[:ROLE]", help="další osoba události (u sňatku manžel/ka)")
    x = akce(o, "uprav", udalost_uprav, "úprava události"); x.add_argument("id", type=int); vstup(x); udalost_volby(x)
    x = akce(o, "smaz", udalost_smaz, "smazání události"); x.add_argument("id", type=int)

    o = oblast("bydliste", "bydliště osob")
    x = akce(o, "pridej", bydliste_pridej, "bydliště (obec, čp., od–do)"); x.add_argument("osoba"); vstup(x); zdr(x)
    x.add_argument("--misto", metavar="SLUG"); x.add_argument("--dum", metavar="KLIC"); x.add_argument("--misto-text"); x.add_argument("--cp")
    x.add_argument("--od"); x.add_argument("--do"); x.add_argument("--role"); x.add_argument("--jistota", choices=JISTOTA, default="unk"); x.add_argument("--pozn")
    x = akce(o, "smaz", bydliste_smaz, "smazání bydliště"); x.add_argument("id", type=int)

    o = oblast("citace", "zdroj k události / vztahu / bydlišti / osobě")
    x = akce(o, "pridej", citace_pridej, "citace: jeden cíl + jeden zdroj"); zdr(x)
    x.add_argument("--udalost", type=int); x.add_argument("--vztah", type=int); x.add_argument("--bydliste", type=int); x.add_argument("--osoba"); x.add_argument("--pozn")
    x = akce(o, "smaz", citace_smaz, "smazání citace"); x.add_argument("id", type=int)

    # prameny
    o = oblast("zaznam", "zápisy z pramenů (přepis, osoby v rolích, výřez)")
    x = akce(o, "ukaz", zaznam_ukaz, "detail zápisu"); x.add_argument("klic")
    x = akce(o, "hledej", zaznam_hledej, "hledání zápisů"); x.add_argument("text", nargs="?"); x.add_argument("--svazek"); x.add_argument("--review", choices=REVIEW)
    x.add_argument("--osoba"); x.add_argument("--limit", type=int, default=100)
    x = akce(o, "pridej", zaznam_pridej, "založení / přepsání celého zápisu (PUT, JSON podle RecordIn)"); x.add_argument("klic"); x.add_argument("soubor", help="JSON soubor nebo -")
    x = akce(o, "uprav", zaznam_uprav, "částečná úprava zápisu"); x.add_argument("klic"); vstup(x)
    x.add_argument("--review", choices=REVIEW); x.add_argument("--titulek"); x.add_argument("--shrnuti"); x.add_argument("--datum"); x.add_argument("--url")
    x.add_argument("--svazek"); x.add_argument("--snimek", type=int); x.add_argument("--prepis", metavar="SOUBOR", help="přepis originálu ze souboru"); x.add_argument("--preklad", metavar="SOUBOR")
    x = akce(o, "smaz", zaznam_smaz, "smazání zápisu (admin)"); x.add_argument("klic")

    o = oblast("svazek", "svazky (matriky, knihy)")
    x = akce(o, "ukaz", svazek_ukaz, "svazek se zápisy"); x.add_argument("klic")
    akce(o, "seznam", svazek_seznam, "všechny svazky")
    x = akce(o, "pridej", svazek_pridej, "založení / úprava svazku"); x.add_argument("klic"); vstup(x)
    x.add_argument("--archiv"); x.add_argument("--portal"); x.add_argument("--nazev"); x.add_argument("--popis"); x.add_argument("--url")

    x = sub.add_parser("nalez", help="nález v jedné transakci (svazek, zápis, osoby, vztahy, události, deník)", parents=[spolecne])
    x.add_argument("soubor", help="JSON soubor nebo -"); x.set_defaults(fn=nalez)

    o = oblast("vyrez", "obrázek výřezu zápisu")
    x = akce(o, "nahraj", vyrez_nahraj, "nahraje výřez (JPEG/PNG/WebP, max 4 MB)"); x.add_argument("klic"); x.add_argument("soubor"); x.add_argument("--plny", action="store_true", help="plné rozlišení")

    x = sub.add_parser("zvyrazneni", help="rámečky zápisu ve výřezu: JSON {boxes: [[x0,y0,x1,y1]]} nebo [[…]]", parents=[spolecne])
    x.add_argument("klic"); x.add_argument("data", help="JSON text, soubor nebo -"); x.set_defaults(fn=zvyrazneni)

    # místa, domy, příjmení
    o = oblast("misto", "místa (obce, osady) a jejich staré názvy")
    x = akce(o, "hledej", misto_hledej, "hledání i podle starých/německých názvů"); x.add_argument("text")
    akce(o, "seznam", misto_seznam, "všechna místa")
    x = akce(o, "ukaz", misto_ukaz, "detail místa"); x.add_argument("slug")
    x = akce(o, "pridej", misto_pridej, "založení / doplnění místa"); x.add_argument("slug"); vstup(x)
    x.add_argument("--nazev"); x.add_argument("--druh", help="obec, osada, mlýn…"); x.add_argument("--nadrazene", metavar="SLUG"); x.add_argument("--lat", type=float); x.add_argument("--lon", type=float)
    x.add_argument("--dotaz", help="dotaz pro geokódování"); x.add_argument("--vzor", help="regulární výraz pro hledání v textech"); x.add_argument("--popis"); x.add_argument("--hypoteza", action="store_true")
    x = akce(o, "nazev", misto_nazev, "další (starý, německý, latinský) název"); x.add_argument("slug"); x.add_argument("nazev"); x.add_argument("--jazyk", help="de, la, cs-old…"); x.add_argument("--pozn")
    x = akce(o, "udalost", misto_udalost, "událost obce"); x.add_argument("slug"); x.add_argument("text"); x.add_argument("--rok", type=int); x.add_argument("--jistota", choices=JISTOTA, default="unk"); zdr(x)

    o = oblast("dum", "domy (čísla, držitelé, obyvatelé)")
    x = akce(o, "ukaz", dum_ukaz, "detail domu"); x.add_argument("klic")
    akce(o, "seznam", dum_seznam, "všechny domy")
    x = akce(o, "pridej", dum_pridej, "založení / úprava domu (JSON podle HouseIn; uvedené seznamy se nahradí)"); x.add_argument("soubor"); x.add_argument("--klic", help="jinak <místo>-<čp>")

    o = oblast("prijmeni", "varianty příjmení")
    x = akce(o, "hledej", prijmeni_hledej, "varianty"); x.add_argument("text", nargs="?")
    x = akce(o, "pridej", prijmeni_pridej, "nová varianta"); x.add_argument("prijmeni"); x.add_argument("varianta"); x.add_argument("--pozn")

    # fronta
    o = oblast("voditko", "vodítka: údaje od rodiny, zvěsti, opravy, nápady")
    x = akce(o, "seznam", voditko_seznam, "seznam vodítek (po rodech)"); x.add_argument("--otevrena", action="store_true"); x.add_argument("--osoba"); x.add_argument("--stav", choices=STAV_VODITKA)
    x.add_argument("--rod", metavar="SLUG", help="jen vodítka s osobou z rodu (rdb.py rod seznam); „bez“ = bez rodu")
    x.add_argument("--vetev", metavar="KOREN", help="seskupit po větvích prarodičů kořene"); x.add_argument("--prarodic", type=int, choices=[4, 5, 6, 7], help="jen větev prarodiče (s --vetev): 4 otcův otec, 5 otcova matka, 6 matčin otec, 7 matčina matka")
    x.add_argument("--text"); x.add_argument("--limit", type=int)
    x = akce(o, "ukaz", voditko_ukaz, "detail"); x.add_argument("id", type=int)
    x = akce(o, "pridej", voditko_pridej, "nové vodítko"); x.add_argument("text", nargs="?"); vstup(x)
    x.add_argument("--druh", choices=["od_rodiny", "zvest", "oprava", "napad"], default="od_rodiny"); x.add_argument("--osoba", action="append", metavar="ID", help="koho se týká")
    x.add_argument("--od-osoby", metavar="ID", help="kdo to řekl (osoba ve stromu)"); x.add_argument("--od-jmena", help="kdo to řekl (jméno)"); x.add_argument("--kanal", help="telefon, e-mail, z paměti…")
    x.add_argument("--citlive", action="store_true", help="citlivý údaj – nezveřejňovat")
    x = akce(o, "uprav", voditko_uprav, "úprava textu / osob (--osoba nahradí všechny)"); x.add_argument("id", type=int); vstup(x)
    x.add_argument("--text"); x.add_argument("--osoba", action="append", metavar="ID")
    x = akce(o, "stav", voditko_stav, "stav vodítka + řešení (rozdeleno = rozsekáno na menší vodítka)"); x.add_argument("id", type=int); x.add_argument("stav", choices=STAV_VODITKA)
    x.add_argument("--poznamka", help="jak bylo vyřešeno"); x.add_argument("--zaznam", action="append", metavar="KLIC", help="zápis, který vodítko potvrdil/vyvrátil")

    o = oblast("denik", "deník bádání (i neúspěšná hledání)")
    x = akce(o, "posledni", denik_posledni, "posledních N záznamů"); x.add_argument("n", nargs="?", type=int, default=10); x.add_argument("--cely", action="store_true")
    x.add_argument("--rod", metavar="SLUG", help="jen záznamy s osobou z rodu; „bez“ = bez rodu")
    x.add_argument("--vetev", metavar="KOREN", help="seskupit po větvích prarodičů kořene"); x.add_argument("--prarodic", type=int, choices=[4, 5, 6, 7], help="jen větev prarodiče (s --vetev): 4 otcův otec, 5 otcova matka, 6 matčin otec, 7 matčina matka")
    x = akce(o, "hledej", denik_hledej, "hledání v deníku (před každým hledáním v archivu)"); x.add_argument("text", nargs="?")
    x.add_argument("--osoba"); x.add_argument("--rod", metavar="SLUG"); x.add_argument("--vetev", metavar="KOREN", help="seskupit po větvích prarodičů kořene"); x.add_argument("--prarodic", type=int, choices=[4, 5, 6, 7], help="jen větev prarodiče (s --vetev): 4 otcův otec, 5 otcova matka, 6 matčin otec, 7 matčina matka")
    x.add_argument("--svazek"); x.add_argument("--vysledek", choices=VYSLEDEK); x.add_argument("--limit", type=int, default=50); x.add_argument("--cely", action="store_true")
    x = akce(o, "pridej", denik_pridej, "nový záznam"); x.add_argument("titulek", nargs="?"); vstup(x)
    x.add_argument("--text", help="text (markdown) nebo soubor"); x.add_argument("--svazek"); x.add_argument("--snimky", help="rozsah snímků/stran, např. „snímky 30–45“")
    x.add_argument("--vysledek", choices=VYSLEDEK, default="jine"); x.add_argument("--osoba", action="append"); x.add_argument("--zaznam", action="append")
    x.add_argument("--voditko", action="append"); x.add_argument("--autor")

    x = akce(o, "uprav", denik_uprav, "úprava záznamu (--osoba / --zaznam nahradí všechny)"); x.add_argument("id", type=int); vstup(x)
    x.add_argument("--titulek"); x.add_argument("--text"); x.add_argument("--vysledek", choices=VYSLEDEK); x.add_argument("--osoba", action="append"); x.add_argument("--zaznam", action="append")

    o = oblast("ukol", "úkoly (stav projektu, rozpracované)")
    x = akce(o, "seznam", ukol_seznam, "otevřené úkoly (po rodech)"); x.add_argument("--vse", action="store_true"); x.add_argument("--stav", choices=STAV_UKOLU)
    x.add_argument("--rod", metavar="SLUG", help="jen úkoly s osobou z rodu; „bez“ = bez rodu")
    x.add_argument("--vetev", metavar="KOREN", help="seskupit po větvích prarodičů kořene"); x.add_argument("--prarodic", type=int, choices=[4, 5, 6, 7], help="jen větev prarodiče (s --vetev): 4 otcův otec, 5 otcova matka, 6 matčin otec, 7 matčina matka")
    x = akce(o, "pridej", ukol_pridej, "nový úkol"); x.add_argument("titulek"); x.add_argument("--text"); x.add_argument("--druh"); x.add_argument("--priorita", type=int, choices=[1, 2, 3])
    x.add_argument("--osoba", action="append")
    x = akce(o, "stav", ukol_stav, "změna stavu"); x.add_argument("id", type=int); x.add_argument("stav", choices=STAV_UKOLU)
    x = akce(o, "uprav", ukol_uprav, "úprava úkolu"); x.add_argument("id", type=int); vstup(x); x.add_argument("--titulek"); x.add_argument("--text")
    x.add_argument("--priorita", type=int, choices=[1, 2, 3]); x.add_argument("--stav", choices=STAV_UKOLU); x.add_argument("--osoba", action="append")

    # výklad
    o = oblast("pribeh", "příběhy (markdown)")
    akce(o, "seznam", pribeh_seznam, "seznam příběhů")
    x = akce(o, "ukaz", pribeh_ukaz, "text příběhu"); x.add_argument("slug")
    x = akce(o, "uloz", pribeh_uloz, "uložení příběhu ze souboru .md"); x.add_argument("slug"); x.add_argument("soubor")
    x.add_argument("--titulek"); x.add_argument("--perex"); x.add_argument("--druh", choices=DRUH_PRIBEHU); x.add_argument("--rod", metavar="SLUG"); x.add_argument("--dum", metavar="KLIC")
    x.add_argument("--poradi", type=int)

    o = oblast("rod", "rody (linie po meči; dopočítávají se samy, ručně jen jméno/popis/barva)")
    x = akce(o, "seznam", rod_seznam, "rody s počty otevřených vodítek a úkolů"); x.add_argument("--pro", metavar="ID", help="jen rody osoby a jejích předků")
    x = akce(o, "ukaz", rod_ukaz, "členové rodu"); x.add_argument("slug")
    x = akce(o, "pridej", rod_pridej, "pojmenování / popis rodu (dopočítaný se tím uloží; --zakladatel = kdokoli z linie)"); x.add_argument("slug"); x.add_argument("--nazev", required=True); x.add_argument("--popis"); x.add_argument("--barva")
    x.add_argument("--zakladatel", metavar="ID")

    o = oblast("hypoteza", "hypotézy")
    akce(o, "seznam", hypoteza_seznam, "seznam")
    x = akce(o, "pridej", hypoteza_pridej, "nová hypotéza"); x.add_argument("titulek", nargs="?"); vstup(x); x.add_argument("--text"); x.add_argument("--osoba"); x.add_argument("--zaznam", action="append")
    x = akce(o, "uprav", hypoteza_uprav, "úprava"); x.add_argument("id", type=int); vstup(x); x.add_argument("--titulek"); x.add_argument("--text"); x.add_argument("--osoba"); x.add_argument("--zaznam", action="append")
    x = akce(o, "smaz", hypoteza_smaz, "smazání"); x.add_argument("id", type=int)

    o = oblast("otazka", "otevřené otázky")
    akce(o, "seznam", otazka_seznam, "seznam")
    x = akce(o, "pridej", otazka_pridej, "nová otázka"); x.add_argument("otazka"); x.add_argument("--osoba"); x.add_argument("--stav", choices=["otevrene", "hypoteza", "vyreseno"]); x.add_argument("--odpoved")
    x = akce(o, "uprav", otazka_uprav, "úprava (stav, odpověď)"); x.add_argument("id", type=int); x.add_argument("--otazka"); x.add_argument("--stav", choices=["otevrene", "hypoteza", "vyreseno"]); x.add_argument("--odpoved")

    # graf, kontrola, hledání, obecné
    x = sub.add_parser("kekule", help="Kekulého čísla předků (výchozí kořen = přihlášený)", parents=[spolecne]); x.add_argument("koren", nargs="?"); x.set_defaults(fn=kekule)
    x = sub.add_parser("pribuznost", help="jak je osoba K příbuzná osobě OD", parents=[spolecne]); x.add_argument("od"); x.add_argument("k"); x.set_defaults(fn=pribuznost)
    x = sub.add_parser("predci", help="předci osoby s generací", parents=[spolecne]); x.add_argument("id"); x.set_defaults(fn=predci)
    x = sub.add_parser("kontrola", help="kontrola konzistence dat (chyby grafu, zápisy ke kontrole)", parents=[spolecne]); x.set_defaults(fn=kontrola)
    x = sub.add_parser("hledat", help="hledání ve všem (osoby, místa, zápisy, deník, vodítka)", parents=[spolecne]); x.add_argument("text"); x.set_defaults(fn=hledat)
    x = sub.add_parser("ja", help="kdo jsem (token, role)", parents=[spolecne]); x.set_defaults(fn=ja)
    x = sub.add_parser("api", help="obecné volání: api METODA CESTA [JSON|soubor|-]", parents=[spolecne])
    x.add_argument("metoda", choices=["GET", "POST", "PUT", "PATCH", "DELETE", "get", "post", "put", "patch", "delete"]); x.add_argument("cesta", help="např. osoby/<id> (relativně k /api/v1/)")
    x.add_argument("data", nargs="?"); x.add_argument("--binarni", dest="soubor_bin", metavar="SOUBOR", help="PUT binárního souboru (obrázek)"); x.set_defaults(fn=obecne_api)

    A = p.parse_args()
    A.json = getattr(A, "json", False)
    api.hlavni(A.fn)


if __name__ == "__main__":
    main()
