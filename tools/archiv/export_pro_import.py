# export_pro_import.py [vystup.json] – jednorázově: starý souborový formát (data/*.py, *.json, *.md) → jeden JSON
# pro importér aplikace (cd aplikace && npm run import -- <json>). Data jen čte, nic nemění.
import json, os, sys

KOREN = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(KOREN, "data")


def nacti_py(soubor):
    ns = {}
    exec(open(os.path.join(DATA, soubor), encoding="utf-8").read(), ns)
    return {k: v for k, v in ns.items() if k.isupper()}


def nacti_json(soubor, vychozi):
    p = os.path.join(DATA, soubor)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else vychozi


def nacti_md(soubor):
    p = os.path.join(DATA, soubor)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else None


def obrazky(slozka):
    p = os.path.join(KOREN, slozka)
    return sorted(f for f in os.listdir(p) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))) if os.path.isdir(p) else []


web = nacti_json("web.json", {})
web.pop("prihlaseni", None)   # přihlašovací otázka do DB nepatří
vystup = {
    "koren": KOREN,
    "osoby": nacti_py("osoby.py"),
    "domy": nacti_py("domy.py") if os.path.exists(os.path.join(DATA, "domy.py")) else {},
    "svazky": nacti_json("svazky.json", {}),
    "zaznamy": nacti_json("zaznamy.json", []),
    "prepisy": nacti_json("prepisy.json", {}),
    "zvyrazneni": nacti_json("zvyrazneni.json", {}),
    "mista": nacti_json("mista.json", {}),
    "mista_nazvy": nacti_json("mista_nazvy.json", {}),
    "prijmeni_varianty": nacti_json("prijmeni_varianty.json", {}),
    "dokumenty": nacti_json("dokumenty.json", []),
    "mapy": nacti_json("mapy.json", []),
    "web": web,
    "web_domy": nacti_json("web_domy.json", {}),
    "md": {f: nacti_md(f) for f in sorted(os.listdir(DATA)) if f.endswith(".md")},
    "vyrezy": obrazky("vyrezy"),
    "zdroje": obrazky("zdroje"),
}
cil = sys.argv[1] if len(sys.argv) > 1 else os.path.join(KOREN, "pracovni", "import", "data.json")
os.makedirs(os.path.dirname(cil), exist_ok=True)
json.dump(vystup, open(cil, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=list)
o = vystup["osoby"]
print(f"{cil}: {len(o.get('OSOBY', {}))} osob, {len(o.get('VZTAHY', []))} hran, {len(vystup['zaznamy'])} zápisů, "
      f"{len(vystup['svazky'])} svazků, {len(vystup['vyrezy'])} výřezů, {len(vystup['md'])} md")
