#!/usr/bin/env python3
"""Jednorázový (opakovatelný) převod odkazů na osoby z Kekulého čísel na id grafu.

Mapa z graf.kekule() (hlavní kořen z KORENY); druhý výskyt předka vede na hlavní osobu. Převádí:
  data/domy.py          o=64            → o="jan-novak-1890"
  data/zaznamy.json     "osoby": [64]   → ["jan-novak-1890"]
  data/dokumenty.json   "osoby": [64]   → ["jan-novak-1890"]
(data/domy_rodiny.json generuje tools/domy_rodiny.py rovnou s polem "osoba".)
Už převedené odkazy nechá být, takže jde spustit znovu po zápisech rešeršních agentů.
Neznámé číslo nechá beze změny a vypíše ho (kontrola.py ho hlásí jako chybu).

Použití: python3 -I tools/prevod_odkazu_id.py [--zkouska]
"""
import json, os, re, sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(os.path.dirname(TOOLS)), "data")   # tools/archiv/ → kořen projektu
sys.path.insert(0, TOOLS)
import graf  # noqa: E402


def main():
    zkouska = "--zkouska" in sys.argv
    g = graf.nacti()
    zmen, nezname = 0, []

    def nahrad(m):
        nonlocal zmen
        i = g.id_osoby(int(m.group(2)))
        if i is None:
            nezname.append(f"domy.py o={m.group(2)}")
            return m.group(0)
        zmen += 1
        return f'{m.group(1)}o="{i}"'

    path = os.path.join(DATA, "domy.py")
    text = open(path, encoding="utf-8").read()
    # jen argument o= ve volání dict(…) (před ním čárka/závorka a mezera), ne text v komentářích a řetězcích
    novy = re.sub(r'([(,]\s*)o=(\d+)\b', nahrad, text)
    if not zkouska and novy != text:
        open(path, "w", encoding="utf-8", newline="\n").write(novy)

    for name in ("zaznamy.json", "dokumenty.json"):
        path = os.path.join(DATA, name)
        if not os.path.exists(path):
            continue
        data = json.load(open(path, encoding="utf-8"))
        zmena = False
        for z in data:
            nove = []
            for x in z.get("osoby", []):
                i = g.id_osoby(x) if isinstance(x, int) else x
                if i is None:
                    nezname.append(f"{name} {z.get('klic') or z.get('img')}: {x}")
                    i = x
                zmena |= i != x
                zmen += i != x
                nove.append(i)
            if "osoby" in z:
                z["osoby"] = nove
        if zmena and not zkouska:
            open(path, "w", encoding="utf-8", newline="\n").write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")

    print(f"{'(zkouška) ' if zkouska else ''}převedeno {zmen} odkazů")
    for n in nezname:
        print("neznámé Kekulého číslo:", n)
    return 1 if nezname else 0


if __name__ == "__main__":
    sys.exit(main())
