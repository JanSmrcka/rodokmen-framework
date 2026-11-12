#!/usr/bin/env python3
"""Výřez zápisu ze staženého snímku stránky (z jakéhokoli portálu) – vytvoří ho lokálně a nahraje přes API.

Použití:
  vyrez.py <snimek.jpg> <klic> [x0,y0,x1,y1] [--bez-nahrani]
      x0..y1 = oblast zápisu jako zlomky šířky a výšky stránky (0..1); bez nich se bere celá stránka.
      Uloží pracovni/vyrezy/<klic>.jpg (max. 1800 px – pro web) a pracovni/vyrezy/<klic>_plny.jpg (plné rozlišení,
      max. 4 MB) a obě nahraje k zápisu <klic> (PUT /zaznamy/<klic>/vyrez). Zápis musí v DB už být
      (rdb.py nalez … nebo rdb.py zaznam pridej …). --bez-nahrani = jen lokální soubory.

Výřez dělejte velkoryse: celý zápis včetně hlavičky sloupců, okrajových poznámek a podpisů.
Novinový článek: nahoře s titulkem, dole nechte okraj až po oddělovací čáru nebo začátek dalšího článku –
výřez těsně pod posledním řádkem vypadá na webu jako useknutý konec. Výsledek si vždy prohlédněte.
Potřebuje ImageMagick (příkaz `magick`).
"""
import glob, os, shutil, subprocess, sys
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import rdb_klient as api

ROOT = api.ROOT
OUT = os.path.join(ROOT, "pracovni", "vyrezy")
MAX_BYTES = 4 * 1024 * 1024 - 64 * 1024   # limit API 4 MB (s rezervou)


def magick():
    """Cesta k ImageMagicku; když chybí, skončí hned (před stahováním) srozumitelnou hláškou."""
    m = (shutil.which("magick") or next(iter(sorted(glob.glob(r"C:\Program Files\ImageMagick*\magick.exe"))), None)
         or (os.name != "nt" and shutil.which("convert")))   # ImageMagick 6 bez magick; na Windows je convert.exe jiný program
    if not m:
        sys.exit("Chybí ImageMagick (příkaz magick). Nainstaluj ho (macOS: brew install imagemagick, "
                 "Windows: winget install ImageMagick.ImageMagick a restart Claude Code) a spusť nástroj znovu.")
    return m


def vytvor(src, key, crop=None):
    """Vytvoří výřez: (plné rozlišení, web max. 1800 px) v pracovni/vyrezy/. crop = (x0, y0, x1, y1) ve zlomcích."""
    MAGICK = magick()
    os.makedirs(OUT, exist_ok=True)
    full = os.path.join(OUT, key + "_plny.jpg")
    small = os.path.join(OUT, key + ".jpg")
    cmd = [MAGICK, src, "-auto-orient"]   # fotky z mobilu: otočit podle EXIF (EXIF i s GPS pak smaže +profile, barevný profil ICC zůstane)
    if crop:
        x0, y0, x1, y1 = crop
        if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):   # pixely by ImageMagick jen varoval a uložil celou stránku
            sys.exit(f"Oblast {','.join(map(str, crop))} musí být zlomky 0..1 (x0 < x1, y0 < y1), ne pixely – "
                     "např. 0.1,0.25,0.9,0.6 = od 10 % do 90 % šířky a od 25 % do 60 % výšky.")
        w, h = (int(v) for v in subprocess.run([MAGICK, src + "[0]", "-auto-orient", "-format", "%w %h", "info:"],
                                                capture_output=True, text=True, check=True).stdout.split())
        cmd += ["-crop", f"{round((x1 - x0) * w)}x{round((y1 - y0) * h)}+{round(x0 * w)}+{round(y0 * h)}", "+repage"]
    subprocess.run(cmd + ["+profile", "!icc,*", "+set", "comment", "-quality", "90", full], check=True)
    # plná varianta musí projít limitem API: nejdřív nižší kvalita, pak zmenšování
    for krok in (["-quality", "82"], ["-resize", "6000x6000>", "-quality", "82"], ["-resize", "4500x4500>", "-quality", "80"],
                 ["-resize", "3500x3500>", "-quality", "78"]):
        if os.path.getsize(full) <= MAX_BYTES:
            break
        subprocess.run([MAGICK, full] + krok + [full], check=True)
    subprocess.run([MAGICK, full, "-resize", "1800x1800>", "-quality", "85", small], check=True)
    return full, small


def nahraj(key, full, small):
    """Nahraje obě varianty k zápisu přes API."""
    for soubor, var in ((small, "web"), (full, "plny")):
        try:
            d = api.put_soubor(f"zaznamy/{key}/vyrez", soubor, varianta=var)
        except api.ChybaAPI as e:
            if e.status in (400, 404) and "neexist" in str(e.chyba):
                raise api.ChybaAPI(f"Zápis {key} v databázi není – nejdřív ho ulož (rdb.py nalez … / rdb.py zaznam pridej …), "
                                   f"pak: python3 -I tools/rdb.py vyrez nahraj {key} {os.path.relpath(small, ROOT)}") from None
            raise
        print(f"nahráno ({var}, {d.get('width')}×{d.get('height')} px): {d.get('url')}")


def main():
    a = [x for x in sys.argv[1:] if x != "--bez-nahrani"]
    if len(a) < 2:
        sys.exit(__doc__)
    src, key = a[0], a[1]
    crop = tuple(float(v) for v in a[2].split(",")) if len(a) > 2 else None
    if crop is not None and len(crop) != 4:
        sys.exit("Oblast zadej jako čtyři čísla x0,y0,x1,y1 (zlomky 0..1).")
    full, small = vytvor(src, key, crop)
    print("uloženo:", os.path.relpath(full, ROOT), "a", os.path.relpath(small, ROOT))
    if "--bez-nahrani" not in sys.argv:
        api.hlavni(lambda: nahraj(key, full, small))


if __name__ == "__main__":
    main()
