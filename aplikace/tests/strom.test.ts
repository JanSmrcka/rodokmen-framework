import { describe, expect, it } from "vitest";
import { COL, H, layout, layoutWide, type Edge, type Node, type TreePerson } from "../src/lib/treeLayout";

type Rodina = Record<string, TreePerson>;

const osoba = (id: string, sex: "M" | "F" = "M"): TreePerson => ({
  id, name: id, years: "", born: null, died: null, sex, st: "doc", rel: "", color: null, line: null, facts: [],
  father: null, mother: null, children: [], spouses: [],
});

function rodina(ids: string[], deti: [string | null, string | null, string[]][]): Rodina {
  const p: Rodina = Object.fromEntries(ids.map((id) => [id, osoba(id)]));
  for (const [f, m, kids] of deti)
    for (const k of kids) {
      p[k].father = f;
      p[k].mother = m;
      if (f) p[f].children.push(k);
      if (m) p[m].children.push(k);
    }
  return p;
}

// děd (d) × babička (b) → strýc (s), otec (o), teta (t); strýc → bratranec (br) → jeho syn (bs)
// děd z matčiny strany (md) × (mb) → matčin bratr (mbr), matka (m)
// otec × matka → já (j), sestra (se); otec × druhá žena (o2, mimo strom) → nevlastní bratr (nb); já → syn (sy)
const r = rodina(
  ["d", "b", "s", "o", "t", "br", "bs", "md", "mb", "mbr", "m", "j", "se", "nb", "sy", "o2"],
  [
    ["d", "b", ["s", "o", "t"]],
    ["s", null, ["br"]],
    ["br", null, ["bs"]],
    ["md", "mb", ["mbr", "m"]],
    ["o", "m", ["j", "se"]],
    ["o", "o2", ["nb"]],
    ["j", null, ["sy"]],
  ],
);
delete r.o2; // druhá žena není v datech webu
r.nb.mother = null;

const ids = (nodes: Node[]) => new Set(nodes.map((n) => n.id));
const najdi = (nodes: Node[], id: string) => {
  const n = nodes.filter((x) => x.id === id);
  expect(n).toHaveLength(1);
  return n[0];
};
const spojeno = (edges: Edge[], a: string, b: string) =>
  edges.some((e) => (e.from.id === a && e.to.id === b) || (e.from.id === b && e.to.id === a));
// dvojice karet ve stejném sloupci, které jsou svisle blíž než výška karty
const prekryvy = (nodes: Node[]) => {
  const out: string[] = [];
  const sloupce = Map.groupBy(nodes, (n) => n.x);
  for (const col of sloupce.values()) {
    col.sort((a, b) => a.y - b.y);
    for (let i = 1; i < col.length; i++) if (col[i].y - col[i - 1].y < H) out.push(`${col[i - 1].key} × ${col[i].key}`);
  }
  return out;
};

describe("strom – přímá linie", () => {
  it("ukáže jen předky a potomky, bez sourozenců", () => {
    const { nodes } = layout(r, "j", 2, 1);
    expect(ids(nodes)).toEqual(new Set(["j", "o", "m", "d", "b", "md", "mb", "sy"]));
  });
});

describe("strom – sourozenci a boční větve", () => {
  it("přidá sourozence předků i jejich potomky", () => {
    const { nodes } = layoutWide(r, "j", 2, 1);
    expect(ids(nodes)).toEqual(new Set(["j", "se", "nb", "o", "m", "s", "t", "br", "bs", "mbr", "d", "b", "md", "mb", "sy"]));
  });

  it("hloubku bočních větví řídí počet generací potomků", () => {
    const { nodes } = layoutWide(r, "j", 2, 0);
    expect(ids(nodes).has("br")).toBe(true); // bratranec je v generaci středu
    expect(ids(nodes).has("bs")).toBe(false);
    expect(ids(nodes).has("sy")).toBe(false);
  });

  it("sourozence předka ukáže, jen když jsou vidět i jeho rodiče", () => {
    const { nodes } = layoutWide(r, "j", 1, 1);
    expect(ids(nodes).has("se")).toBe(true);
    expect(ids(nodes).has("s")).toBe(false);
    expect(ids(nodes).has("mbr")).toBe(false);
  });

  it("generace jsou ve sloupcích, starší sourozenci nad, mladší pod", () => {
    const { nodes } = layoutWide(r, "j", 2, 1);
    const n = (id: string) => najdi(nodes, id);
    expect([n("j").x, n("se").x, n("br").x]).toEqual([0, 0, 0]);
    expect([n("o").x, n("s").x, n("t").x, n("mbr").x]).toEqual([COL, COL, COL, COL]);
    expect([n("sy").x, n("bs").x]).toEqual([-COL, -COL]);
    expect(n("s").y).toBeLessThan(n("o").y);
    expect(n("o").y).toBeLessThan(n("t").y);
    expect(n("mbr").y).toBeLessThan(n("m").y);
    expect(n("j").y).toBeLessThan(n("se").y);
  });

  it("sourozence spojí jen se společnými rodiči", () => {
    const { edges } = layoutWide(r, "j", 2, 1);
    expect(spojeno(edges, "se", "o") && spojeno(edges, "se", "m")).toBe(true);
    expect(spojeno(edges, "nb", "o")).toBe(true);
    expect(spojeno(edges, "nb", "m")).toBe(false);
    expect(spojeno(edges, "j", "sy") && spojeno(edges, "s", "br") && spojeno(edges, "br", "bs")).toBe(true);
  });

  it("karty se nepřekrývají ani ve velké rodině", () => {
    // deterministická náhodná rodina: 6 generací, páry mají 1–4 děti
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const big: Rodina = {};
    let n = 0;
    const nova = (f: string | null, m: string | null) => {
      const id = `p${n++}`;
      big[id] = { ...osoba(id), father: f, mother: m };
      if (f) big[f].children.push(id);
      if (m) big[m].children.push(id);
      return id;
    };
    let gen = Array.from({ length: 64 }, () => nova(null, null));
    for (let g = 0; g < 6; g++) {
      const dalsi: string[] = [];
      for (let i = 0; i + 1 < gen.length; i += 2) for (let k = 1 + Math.floor(rnd() * 4); k > 0; k--) dalsi.push(nova(gen[i], gen[i + 1]));
      gen = dalsi.sort(() => rnd() - 0.5);
    }
    for (const [up, down] of [[2, 0], [3, 1], [5, 2]]) {
      const { nodes, edges } = layoutWide(big, gen[0], up, down);
      expect(nodes.length).toBeGreaterThan(10);
      expect(prekryvy(nodes)).toEqual([]);
      expect(new Set(nodes.map((x) => x.key)).size).toBe(nodes.length);
      expect(new Set(edges.map((e) => e.key)).size).toBe(edges.length);
    }
  });
});
