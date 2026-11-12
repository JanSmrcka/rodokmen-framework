#!/usr/bin/env python3
"""Varianty špatně čitelného snímku či výřezu vedle sebe – pro čtení vybledlých a skvrnitých zápisů.

Použití:
  vylepsi_snimek.py <obrazek.jpg> [x0,y0,x1,y1] [--zvetsit 2] [--vystup pracovni/x_varianty.jpg]
      x0..y1 = volitelný výřez ve zlomcích šířky a výšky (0..1), jako u vyrez.py.
      Vytvoří pracovni/<jméno>_<varianta>.jpg a souhrnný obrázek <jméno>_varianty.jpg (mřížka s popisky).

Varianty (každá vytáhne jiné tahy – čti ze všech a v přepisu poznamenej, ze které):
  original  – jen šedotón,
  kontrast  – roztažení kontrastu (mikrofilm, celkově vybledlé),
  clahe     – místní kontrast (nerovnoměrně vybledlá strana, tmavé okraje),
  pozadi    – odečtené pozadí: dělení rozmazanou kopií (žloutnutí, skvrny, prosvítající rub),
  kanal     – nejtmavší barevný kanál inkoustu se zvýšenou gammou (hnědé skvrny vs. inkoust).
Detekci hran a černobílé prahování nástroj záměrně nedělá: vlasové tahy kurentu zdvojí nebo smaže.
"""
import glob, os, shutil, subprocess, sys
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8")


def magick():
    m = (shutil.which("magick") or next(iter(sorted(glob.glob(r"C:\Program Files\ImageMagick*\magick.exe"))), None))
    if not m:
        sys.exit("Chybí ImageMagick 7 (příkaz magick). macOS: brew install imagemagick, "
                 "Windows: winget install ImageMagick.ImageMagick.")
    return m


VARIANTY = {
    "original": ["-colorspace", "Gray"],
    "kontrast": ["-colorspace", "Gray", "-contrast-stretch", "2%x30%"],
    "clahe": ["-colorspace", "Gray", "-clahe", "12x12%+128+3"],
    "pozadi": ["-colorspace", "Gray", "(", "+clone", "-blur", "0x25", ")", "-compose", "Divide_Src", "-composite",
               "-contrast-stretch", "1%x5%"],
    # modrý kanál: žluté a hnědé zabarvení papíru v něm vychází podobně jako v šedi, ale červené/zelené
    # skvrny a razítka zesvětlají; gamma < 1 ztmaví slabé tahy
    "kanal": ["-colorspace", "sRGB", "-type", "TrueColor", "-channel", "B", "-separate", "+channel", "-gamma", "0.7", "-contrast-stretch", "1%x10%"],
}


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        sys.exit(__doc__)
    src = a.pop(0)
    if not os.path.isfile(src):
        sys.exit(f"Soubor {src} neexistuje.")
    box, zvetsit, out = None, 1.0, None
    while a:
        x = a.pop(0)
        if x == "--zvetsit":
            zvetsit = float(a.pop(0))
        elif x == "--vystup":
            out = a.pop(0)
        else:
            box = [float(v) for v in x.split(",")]
            if len(box) != 4 or not all(0 <= v <= 1 for v in box) or box[0] >= box[2] or box[1] >= box[3]:
                sys.exit("Výřez zadej jako x0,y0,x1,y1 ve zlomcích 0..1 (x0<x1, y0<y1).")
    m = magick()
    base = os.path.join("pracovni", os.path.splitext(os.path.basename(src))[0])
    os.makedirs("pracovni", exist_ok=True)
    pre = [src]
    if box:
        x0, y0, x1, y1 = box
        w, h = (int(v) for v in subprocess.run([m, "identify", "-format", "%w %h", src],
                                                capture_output=True, text=True, check=True).stdout.split())
        pre = [src, "-crop", f"{int((x1-x0)*w)}x{int((y1-y0)*h)}+{int(x0*w)}+{int(y0*h)}", "+repage"]
    if zvetsit != 1:
        pre += ["-filter", "Lanczos", "-resize", f"{zvetsit*100:g}%"]
    soubory = []
    for nazev, ops in VARIANTY.items():
        f = f"{base}_{nazev}.jpg"
        subprocess.run([m, *pre, *ops, "-quality", "92", f], check=True)
        soubory.append((nazev, f))
    out = out or f"{base}_varianty.jpg"
    smer = "+append" if _vysoky(m, soubory[0][1]) else "-append"
    for popisky in (True, False):   # bez dostupného písma (chybí Ghostscript/fontconfig) aspoň bez popisků
        cmd = [m]
        for nazev, f in soubory:
            cmd += ["(", f, "-gravity", "North", "-background", "white", "-splice", "0x40"]
            cmd += ["-pointsize", "28", "-annotate", "+0+6", nazev] if popisky else []
            cmd += [")"]
        cmd += ["-gravity", "Center", "-background", "white", smer, "-quality", "90", out]
        if subprocess.run(cmd, capture_output=True).returncode == 0:
            break
    else:
        sys.exit("Souhrnný obrázek se nepodařilo složit; jednotlivé varianty jsou níže.")
    if not popisky:
        print("(popisky chybí – ImageMagick nenašel písmo; pořadí shora/zleva: " + ", ".join(VARIANTY) + ")")
    print(out)
    for nazev, f in soubory:
        print(f"  {nazev}: {f}")


def _vysoky(m, f):
    """Široký řádek → varianty pod sebe (False), úzký sloupec → vedle sebe (True)."""
    w, h = (int(v) for v in subprocess.run([m, "identify", "-format", "%w %h", f],
                                            capture_output=True, text=True, check=True).stdout.split())
    return h > w


if __name__ == "__main__":
    main()
