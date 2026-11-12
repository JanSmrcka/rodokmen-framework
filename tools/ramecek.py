#!/usr/bin/env python3
"""Rámeček zvýraznění – které místo výřezu čteme (uloží se přes API: PUT /zaznamy/<klic>/zvyrazneni).

Použití:
  ramecek.py <klic> x0,y0,x1,y1 [x0,y0,x1,y1 ...] [--pozn "poznámka"] [--vyrez a0,b0,a1,b1]
      souřadnice jsou zlomky šířky a výšky obrázku VÝŘEZU (0..1) – NE celé stránky!
      --vyrez a0,b0,a1,b1 = oblast, kterou jsi předal vyrez.py; pak zadávej rámeček v souřadnicích CELÉ STRÁNKY
      (jako u vyrez.py) a nástroj je přepočte na výřez. Nejčastější chyba je zadat stránkové souřadnice bez --vyrez.
      Zapíše rámeček a vytvoří kontrolní obrázek pracovni/ramecek_<klic>.jpg – VŽDY si ho prohlédněte,
      jestli rámeček opravdu obepíná celý čtený zápis (jméno, data, rodiče, poznámky na okraji).
  ramecek.py <klic> --nahled      jen znovu vytvoří kontrolní obrázek z uloženého rámečku
Obrázek výřezu se bere z pracovni/vyrezy/<klic>.jpg (vytváří vyrez.py), jinak se stáhne z API (/media/<sha256>).
"""
import glob, json, os, shutil, subprocess, sys
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import rdb_klient as api

ROOT = api.ROOT


def magick():
    """Cesta k ImageMagicku; když chybí, skončí hned (před stahováním) srozumitelnou hláškou."""
    m = (shutil.which("magick") or next(iter(sorted(glob.glob(r"C:\Program Files\ImageMagick*\magick.exe"))), None)
         or (os.name != "nt" and shutil.which("convert")))   # ImageMagick 6 bez magick; na Windows je convert.exe jiný program
    if not m:
        sys.exit("Chybí ImageMagick (příkaz magick). Nainstaluj ho (macOS: brew install imagemagick, "
                 "Windows: winget install ImageMagick.ImageMagick a restart Claude Code) a spusť nástroj znovu.")
    return m


def obrazek(key, zaznam):
    """Webová varianta výřezu: lokální pracovni/vyrezy/<klic>.jpg, jinak stažená z API."""
    src = os.path.join(ROOT, "pracovni", "vyrezy", key + ".jpg")
    if os.path.exists(src):
        return src
    img = next((i for i in zaznam.get("images", []) if i["variant"] == "web"), None) or next(iter(zaznam.get("images", [])), None)
    if not img:
        raise api.ChybaAPI(f"Zápis {key} nemá výřez – nejdřív python3 -I tools/vyrez.py <snímek> {key} x0,y0,x1,y1")
    return api.stahni(f"/media/{img['sha256']}", src)


def preview(key, boxes, src):
    MAGICK = magick()
    out = os.path.join(ROOT, "pracovni", f"ramecek_{key}.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    w, h = (int(v) for v in subprocess.run([MAGICK, src + "[0]", "-format", "%w %h", "info:"],
                                            capture_output=True, text=True, check=True).stdout.split())
    cmd = [MAGICK, src, "-fill", "none", "-stroke", "#d7302a", "-strokewidth", str(max(3, w // 400))]
    for x0, y0, x1, y1 in boxes:
        cmd += ["-draw", f"rectangle {x0 * w:.0f},{y0 * h:.0f},{x1 * w:.0f},{y1 * h:.0f}"]
    subprocess.run(cmd + [out], check=True)
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    key = sys.argv[1]
    magick()   # bez ImageMagicku skončit dřív, než se rámeček zapíše
    zaznam = api.get(f"zaznamy/{key}")
    src = obrazek(key, zaznam)
    if sys.argv[2] == "--nahled":
        print(preview(key, (zaznam.get("highlight") or {}).get("boxes", []), src))
        return
    args, note = sys.argv[2:], ""
    if "--pozn" in args:
        i = args.index("--pozn")
        note = args[i + 1]
        args = args[:i] + args[i + 2:]
    crop = None
    if "--vyrez" in args:
        i = args.index("--vyrez")
        crop = [float(v) for v in args[i + 1].split(",")]
        args = args[:i] + args[i + 2:]
        if len(crop) != 4 or not (0 <= crop[0] < crop[2] <= 1 and 0 <= crop[1] < crop[3] <= 1):
            sys.exit(f"Špatná oblast výřezu {crop}: musí být a0,b0,a1,b1 v rozsahu 0..1")
    boxes = [[float(v) for v in a.split(",")] for a in args]
    if crop:   # souřadnice stránky → souřadnice výřezu
        a0, b0, a1, b1 = crop
        conv = lambda v, lo, hi: min(1.0, max(0.0, (v - lo) / (hi - lo)))
        boxes = [[conv(b[0], a0, a1), conv(b[1], b0, b1), conv(b[2], a0, a1), conv(b[3], b0, b1)] if len(b) == 4 else b
                 for b in boxes]
    boxes = [[round(v, 3) for v in b] for b in boxes]
    for b in boxes:
        if len(b) != 4 or not (0 <= b[0] < b[2] <= 1 and 0 <= b[1] < b[3] <= 1):
            sys.exit(f"Špatný rámeček {b}: musí být x0,y0,x1,y1 v rozsahu 0..1 a x0<x1, y0<y1")
    api.put(f"zaznamy/{key}/zvyrazneni", {"boxes": boxes, "status": "ok", "note": note or None})
    print("zapsáno; zkontrolujte:", preview(key, boxes, src))


if __name__ == "__main__":
    api.hlavni(main)
