#!/usr/bin/env python3
"""Smoke test nástrojů nad API: spustí rdb.py proti běžícímu API a zkontroluje, že příkazy projdou.

Použití: python3 -I tools/test_rdb.py [--zapis]
  bez voleb jen čte (bezpečné i proti produkci);
  --zapis navíc uloží testovací nález (fiktivní osoba, zápis, výřez, rámeček, vodítko, deník) – JEN proti
          lokálnímu API (localhost), jinak odmítne. Počítá s ukázkovou rodinou Novákových (npm run db:seed).
"""
import os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rdb_klient as api

TOOLS = os.path.dirname(os.path.abspath(__file__))
PY = [sys.executable, "-I"]
chyb = 0


def spust(*args, ocekavam=0, nastroj="rdb.py"):
    global chyb
    r = subprocess.run(PY + [os.path.join(TOOLS, nastroj), *args], capture_output=True, text=True, cwd=api.ROOT)
    ok = r.returncode == ocekavam
    chyb += not ok
    prvni = (r.stdout.strip() or r.stderr.strip()).splitlines()[:1]
    print(f"{'OK  ' if ok else 'CHYBA'} {nastroj} {' '.join(args)}  →  {prvni[0][:100] if prvni else ''}")
    if not ok:
        print("   ", (r.stderr or r.stdout).strip()[:800].replace("\n", "\n    "))
    return r.stdout


def main():
    spust("ja")
    spust("osoba", "hledej", "novak")
    spust("osoba", "ukaz", "petr-novak-1980")
    spust("kekule", "petr-novak-1980")
    spust("pribuznost", "petr-novak-1980", "vaclav-novak-1850")
    spust("predci", "petr-novak-1980")
    spust("denik", "posledni", "5")
    spust("voditko", "seznam", "--otevrena")
    spust("voditko", "seznam", "--otevrena", "--rod", "novakove")
    spust("voditko", "seznam", "--rod", "neni-takovy", ocekavam=1)
    spust("ukol", "seznam")
    spust("ukol", "seznam", "--rod", "bez")
    spust("denik", "posledni", "5", "--rod", "novakove")
    spust("rod", "seznam")
    spust("rod", "seznam", "--pro", "petr-novak-1980")
    spust("rod", "ukaz", "novakove")
    spust("hledat", "lhota")
    spust("misto", "hledej", "lhota")
    spust("svazek", "seznam")
    spust("zaznam", "hledej", "--limit", "5")
    spust("api", "GET", "rody")
    spust("osoba", "ukaz", "neexistuje-xyz", ocekavam=1)
    if "--zapis" not in sys.argv:
        print(f"\n{'Vše v pořádku' if not chyb else f'{chyb} chyb'} (jen čtení; zápis: --zapis proti lokálnímu API)")
        return chyb
    if not api.adresa("ja").startswith(("http://localhost", "http://127.0.0.1")):
        sys.exit("--zapis jen proti lokálnímu API (RODOKMEN_API_URL=http://localhost:…).")
    t = str(int(time.time()))
    klic, osoba = f"n-test-{t}", f"test-osoba-{t}"
    os.makedirs(os.path.join(api.ROOT, "pracovni"), exist_ok=True)
    nalez = os.path.join(api.ROOT, "pracovni", f"test_nalez_{t}.json")
    import json
    json.dump({"record": {"key": klic, "volumeKey": "ukazka_1", "imageNo": 1, "kind": "N", "dateText": "1. 1. 1890",
                          "title": "Test – narození", "review": "ke_kontrole",
                          "persons": [{"personId": osoba, "role": "dite"}, {"personId": "vaclav-novak-1850", "role": "kmotr"}]},
               "people": [{"id": osoba, "sex": "F", "given": "Test", "surname": "Testovací", "certainty": "doc",
                           "events": [{"type": "narozeni", "dateText": "1. 1. 1890", "placeSlug": "lhota", "certainty": "doc"}]}],
               "log": {"title": "Test smoke", "pages": "snímek 1"}}, open(nalez, "w", encoding="utf-8"), ensure_ascii=False)
    spust("nalez", nalez)
    spust("nalez", nalez, ocekavam=1)   # podruhé: osoba už existuje → 409
    spust("zaznam", "uprav", klic, "--titulek", "Test – narození (upraveno)")
    out = spust("zaznam", "ukaz", klic)
    if "ke_kontrole" not in out:
        print("CHYBA úprava zápisu změnila review"); globals()["chyb"] += 1
    img = os.path.join(api.ROOT, "pracovni", f"test_snimek_{t}.jpg")
    if subprocess.run(["magick", "-size", "800x600", "xc:#f3ead7", "-fill", "#333", "-draw", "rectangle 100,100 700,200", img]).returncode == 0:
        spust(img, klic, "0.1,0.1,0.9,0.5", nastroj="vyrez.py")
        spust(klic, "0.1,0.1,0.9,0.6", "--pozn", "test", nastroj="ramecek.py")
        spust("vyrez", "nahraj", klic, os.path.join(api.ROOT, "pracovni", "vyrezy", klic + ".jpg"))
    spust("zvyrazneni", klic, "[[0.1,0.1,0.5,0.5]]")
    spust("voditko", "pridej", "Testovací vodítko od rodiny", "--osoba", osoba, "--kanal", "test")
    spust("denik", "pridej", "Test – nenalezeno", "--vysledek", "nenalezeno", "--svazek", "ukazka_1", "--snimky", "snímky 1–5", "--osoba", osoba)
    spust("denik", "hledej", "Test")
    spust("misto", "pridej", f"test-{t}", "--nazev", f"Testov {t}", "--lat", "49.1", "--lon", "15.1")
    spust("misto", "pridej", f"test-{t}", "--popis", "jen popis")
    out = spust("misto", "ukaz", f"test-{t}")
    if "49.1" not in out:
        print("CHYBA doplnění místa smazalo souřadnice"); globals()["chyb"] += 1
    spust("kontrola", ocekavam=0)
    print(f"\n{'Vše v pořádku' if not chyb else f'{chyb} chyb'} (vč. zápisu; testovací data zůstala v lokální DB)")
    return chyb


if __name__ == "__main__":
    sys.exit(1 if api.hlavni(main) else 0)
