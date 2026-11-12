#!/usr/bin/env python3
"""Graf osob a vztahů z data/osoby.py (OSOBY, VZTAHY, RODY, KORENY, ISSUES, HYPOTEZY).

Knihovna:   import graf; g = graf.nacti()
            g.rodice(id) → (otec, matka); g.deti(id); g.manzele(id); g.sourozenci(id); g.kekule()
            g.legacy() → P, LINES, SIDE, ISSUES, HYPOTEZY, SAME v původním tvaru (Kekulé od kořene)
Příkazy:    python3 tools/graf.py cisla [koren]        # id ↔ Kekulého číslo
            python3 tools/graf.py osoba <id|č.>        # rodiče, manželé, děti, sourozenci, kmotři
            python3 tools/graf.py prolog > graf.pl     # fakta pro Prolog (pravidla viz tools/graf_pravidla.pl)
            python3 tools/graf.py kontrola             # konzistence grafu (exit 1 při chybě)
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # tools/archiv/ → kořen projektu
DATA = os.path.join(ROOT, "data")
TYPY = ("rodic", "manzele", "kmotr", "svedek", "pribuzny")
STAVY = ("doc", "prob", "fam", "mh", "unk")
INTERNI = ("_bez_sex", "_bez_r", "tataz", "druh", "sex")


class Graf:
    def __init__(self, ns):
        self.osoby = ns.get("OSOBY", {})
        self.vztahy = ns.get("VZTAHY", [])
        self.rody = ns.get("RODY", {})
        self.koreny = ns.get("KORENY", {})
        self.issues = ns.get("ISSUES", [])
        self.hypotezy = ns.get("HYPOTEZY", [])
        self._rod, self._deti, self._man = {}, {}, {}
        for e in self.vztahy:
            if e["t"] == "rodic":
                self._rod.setdefault(e["b"], []).append(e["a"])
                self._deti.setdefault(e["a"], []).append(e["b"])
            elif e["t"] == "manzele":
                self._man.setdefault(e["a"], []).append(e["b"])
                self._man.setdefault(e["b"], []).append(e["a"])

    # --- dotazy ---
    def hlavni_koren(self):
        """Klíč výchozího kořene: „hlavni“, jinak první klíč v KORENY."""
        if "hlavni" in self.koreny:
            return "hlavni"
        return next(iter(self.koreny), None)

    def koren(self, k=None):
        if k is None:
            k = self.hlavni_koren()
        return self.koreny.get(k, k)

    def rodice(self, i):
        o = m = None
        for r in self._rod.get(i, []):
            if self.osoby[r].get("sex") == "F":
                m = r
            else:
                o = r
        return o, m

    def deti(self, i):
        return list(self._deti.get(i, []))

    def manzele(self, i):
        return list(self._man.get(i, []))

    def sourozenci(self, i):
        rs = set(self._rod.get(i, []))
        return sorted({d for r in rs for d in self._deti.get(r, []) if d != i})

    def id_osoby(self, x, koren=None):
        """Odkaz na osobu → id. Bere id (str) i – po přechodné období – Kekulého číslo (int nebo „64“)
        od kořene `koren`. Druhý výskyt (tataz) vrací hlavní osobu. Neznámý odkaz → None."""
        if isinstance(x, bool):
            return None
        if isinstance(x, int) or (isinstance(x, str) and x.isdigit()):
            self._kek = getattr(self, "_kek", {})
            if koren not in self._kek:
                self._kek[koren] = self.kekule(koren)
            x = self._kek[koren].get(int(x))
        if x not in self.osoby:
            return None
        return self.osoby[x].get("tataz") or x

    def hrany(self, i, t=None):
        return [e for e in self.vztahy if (t is None or e["t"] == t) and i in (e["a"], e["b"])]

    def predci(self, i):
        seen, st = [], [i]
        while st:
            x = st.pop()
            for r in self._rod.get(x, []):
                if r not in seen:
                    seen.append(r)
                    st.append(r)
        return seen

    def kekule(self, koren=None):
        """{číslo: id} pro předky kořene; osoba ve více větvích má víc čísel (předci se číslují jen
        pod nejnižším z nich – jako dřív SAME)."""
        out, fr, seen = {}, [(1, self.koren(koren))], set()
        while fr:
            nxt = []
            for k, i in sorted(fr):
                out[k] = i
                if i in seen:
                    continue
                seen.add(i)
                o, m = self.rodice(i)
                if o:
                    nxt.append((2 * k, o))
                if m:
                    nxt.append((2 * k + 1, m))
            fr = nxt
        return dict(sorted(out.items()))

    # --- zpětná kompatibilita: původní struktury pro daný kořen ---
    def legacy(self, koren=None):
        num = self.kekule(koren)
        prvni, P, SAME = {}, {}, {}
        alias_data = {}
        for i, d in self.osoby.items():
            if d.get("tataz"):
                alias_data.setdefault(d["tataz"], []).append(d)
        for k, i in num.items():
            if i not in prvni:
                prvni[i] = k
                P[k] = self._legacy_osoba(self.osoby[i], k)
            else:
                SAME[k] = prvni[i]
                al = alias_data.get(i, [])
                n = sum(1 for a in SAME.values() if a == prvni[i]) - 1
                d = al[n] if n < len(al) else dict(n=self.osoby[i]["n"], f=[f"viz č. {prvni[i]} – tatáž osoba"])
                P[k] = self._legacy_osoba(d, k)
        LINES = {}
        for s, r in self.rody.items():
            k = prvni.get(r["zakladatel"])
            if k is not None:
                LINES[k] = (r["nazev"], r["popis"])
        LINES = dict(sorted(LINES.items()))
        SIDE = []
        for e in self.vztahy:
            if e["t"] == "pribuzny" and self.osoby[e["a"]].get("druh") == "bocni" and e["b"] in prvni:
                d = self.osoby[e["a"]]
                s = dict(k=prvni[e["b"]], n=d["n"], t=d["t"])
                if not d.get("_bez_r"):
                    s["r"] = list(d.get("r", []))
                SIDE.append(s)
        HYP = []
        for h in self.hypotezy:
            h = dict(h)
            h["rod"] = prvni.get(h["rod"], h["rod"])
            HYP.append(h)
        return dict(P=P, LINES=LINES, SIDE=SIDE, ISSUES=list(self.issues), HYPOTEZY=HYP, SAME=SAME, ids=prvni)

    @staticmethod
    def _legacy_osoba(d, k):
        p = {x: y for x, y in d.items() if x not in INTERNI}
        if k == 1 and not d.get("_bez_sex") and "sex" in d:
            p["sex"] = d["sex"]
        return p

    # --- kontrola ---
    def klice_zaznamu(self, path=None):
        import json
        try:
            return {z.get("klic") for z in json.load(open(path or os.path.join(DATA, "zaznamy.json"), encoding="utf-8"))}
        except FileNotFoundError:
            return None

    def chyby(self, zaznamy=None):
        """Chyby grafu. Kontroluje i st/r u hran a st/r u všech osob (nejen předků)."""
        err = []
        keys = self.klice_zaznamu() if zaznamy is None else set(zaznamy)
        def zdroje(kde, d):
            if d.get("st", "unk") not in STAVY:
                err.append(f"{kde}: neznámý stav st={d.get('st')!r} (povoleno {'/'.join(STAVY)})")
            if keys is not None:
                for r in d.get("r", []):
                    if r not in keys:
                        err.append(f"{kde}: zdroj r={r!r} není v zaznamy.json")
        for i, d in self.osoby.items():
            zdroje(f"osoba {i}", d)
        for e in self.vztahy:
            if e.get("t") not in TYPY:
                err.append(f"neznámý typ hrany {e}")
            zdroje(f"hrana {e.get('t')} {e.get('a')}→{e.get('b')}", e)
            for x in ("a", "b"):
                if e.get(x) not in self.osoby:
                    err.append(f"hrana {e['t']} odkazuje na neexistující osobu {e.get(x)!r}")
        for i, d in self.osoby.items():
            if d.get("druh") == "bocni":
                continue
            if d.get("sex") not in ("M", "F"):
                err.append(f"{i}: chybí sex=\"M\"/\"F\"")
            rs = self._rod.get(i, [])
            sx = [self.osoby[r].get("sex") for r in rs if r in self.osoby]
            if len(rs) > 2 or sx.count("M") > 1 or sx.count("F") > 1:
                err.append(f"{i}: víc než jeden otec/matka: {rs}")
            if d.get("tataz") and d["tataz"] not in self.osoby:
                err.append(f"{i}: tataz → neexistující {d['tataz']}")
        for i in self.osoby:                       # cyklus = osoba je vlastním předkem
            if i in self.predci(i):
                err.append(f"{i}: je sám/sama sobě předkem (cyklus)")
        for k, i in self.koreny.items():
            if i and i not in self.osoby:
                err.append(f"KORENY[{k}] → neexistující {i}")
        for s, r in self.rody.items():
            if r["zakladatel"] not in self.osoby:
                err.append(f"RODY[{s}] → neexistující {r['zakladatel']}")
        for h in self.hypotezy:
            if h["rod"] not in self.osoby:
                err.append(f"HYPOTEZY: rod → neexistující {h['rod']}")
        return err


def nacti(path=None):
    ns = {}
    exec(open(path or os.path.join(DATA, "osoby.py"), encoding="utf-8").read(), ns)
    if "OSOBY" not in ns:
        sys.exit("data/osoby.py je ve starém formátu (P podle Kekulé) – spusťte python3 tools/migrace_graf.py")
    return Graf(ns)


def nacti_legacy(koren=None):
    """Pro starší nástroje: namespace s P, LINES, SIDE, ISSUES, HYPOTEZY, SAME (Kekulé od kořene) + GRAF."""
    g = nacti()
    ns = g.legacy(koren)
    ns["GRAF"] = g
    return ns


def _pl(s):
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"


def main():
    g = nacti()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "cisla"
    if cmd == "cisla":
        for k, i in g.kekule(sys.argv[2] if len(sys.argv) > 2 else None).items():
            print(f"{k:>6}  {i}  {g.osoby[i]['n']}")
    elif cmd == "osoba":
        x = sys.argv[2]
        i = g.kekule().get(int(x)) if x.isdigit() else x
        if i not in g.osoby:
            sys.exit(f"neznámá osoba {x}")
        jm = lambda j: f"{j} ({g.osoby[j]['n']})" if j else "—"
        o, m = g.rodice(i)
        print(g.osoby[i]["n"], g.osoby[i].get("y", ""))
        print("  otec:", jm(o)); print("  matka:", jm(m))
        print("  manželé:", ", ".join(map(jm, g.manzele(i))) or "—")
        print("  děti:", ", ".join(map(jm, g.deti(i))) or "—")
        print("  sourozenci:", ", ".join(map(jm, g.sourozenci(i))) or "—")
        for e in g.hrany(i):
            if e["t"] not in ("rodic", "manzele"):
                print(f"  {e['t']}:", jm(e["a"] if e["b"] == i else e["b"]))
    elif cmd == "prolog":
        print("% Vygenerováno: python3 tools/graf.py prolog. Pravidla: tools/graf_pravidla.pl")
        for i, d in g.osoby.items():
            if d.get("druh") == "bocni":
                continue
            print(f"osoba({_pl(i)}, {_pl(d['n'])}, {_pl(d.get('sex', '?'))}, {_pl(d.get('st', 'unk'))}).")
        for e in g.vztahy:
            print(f"{e['t']}({_pl(e['a'])}, {_pl(e['b'])}).")
    elif cmd == "kontrola":
        err = g.chyby()
        print("\n".join(err) or f"Graf v pořádku: {len(g.osoby)} uzlů, {len(g.vztahy)} hran.")
        sys.exit(1 if err else 0)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
