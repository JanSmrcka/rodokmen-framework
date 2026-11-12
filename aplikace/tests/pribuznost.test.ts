import { describe, expect, it } from "vitest";
import { Graf, type GNode } from "../src/server/graf";
import { bloodLabel, genitive, pribuznost, vsechnyCesty } from "../src/server/pribuznost";
import { parseDate } from "../src/server/text";

const node = (id: string, sex: "M" | "F", sameAsId: string | null = null): GNode => ({
  id, name: id, given: id, surname: "", sex, certainty: "doc", yearsText: null, sameAsId, placeholder: false,
  livingFlag: null, birthYear: null, deathYear: null, living: false,
});

// děda (d) × babička (b) → otec (o), strýc (s); otec × matka (m) → já (j), sestra (se); strýc → bratranec (br)
// já × žena (z); tchán (t) → žena, švagr (sv); já → syn (sy) × snacha (sn); bratranec → jeho syn (bs)
const g = new Graf(
  ["d:M", "b:F", "o:M", "s:M", "m:F", "j:M", "se:F", "br:M", "z:F", "t:M", "sv:M", "sy:M", "sn:F", "bs:M", "pd:M", "ppd:M", "j2:M"].map((x) => {
    const [id, s] = x.split(":");
    return node(id, s as "M" | "F", id === "j2" ? "j" : null);
  }),
  [
    ["rodic", "d", "o"], ["rodic", "b", "o"], ["rodic", "d", "s"], ["rodic", "b", "s"],
    ["rodic", "o", "j"], ["rodic", "m", "j"], ["rodic", "o", "se"], ["rodic", "m", "se"],
    ["rodic", "s", "br"], ["manzele", "j", "z"], ["rodic", "t", "z"], ["rodic", "t", "sv"],
    ["rodic", "j", "sy"], ["manzele", "sy", "sn"], ["rodic", "br", "bs"], ["rodic", "pd", "d"], ["rodic", "ppd", "pd"],
  ].map(([type, a, b], i) => ({ id: i, type: type as "rodic" | "manzele", a, b, certainty: "doc" })),
);

describe("příbuznost z pohledu přihlášeného", () => {
  const cases: [string, string][] = [
    ["j", "já"], ["o", "otec"], ["m", "matka"], ["d", "děd"], ["b", "babička"], ["pd", "praděd"], ["ppd", "prapraděd"],
    ["s", "strýc"], ["se", "sestra"], ["br", "bratranec"], ["bs", "syn bratrance"],
    ["z", "manželka"], ["t", "tchán"], ["sv", "švagr"], ["sy", "syn"], ["sn", "snacha"], ["j2", "já"],
  ];
  for (const [id, label] of cases) it(`${id} → ${label}`, () => expect(pribuznost(g, "j", id).label).toBe(label));

  it("od otce je já syn a strýc bratr", () => {
    expect(pribuznost(g, "o", "j").label).toBe("syn");
    expect(pribuznost(g, "o", "s").label).toBe("bratr");
  });
  it("od ženy je můj otec tchán", () => expect(pribuznost(g, "z", "o").label).toBe("tchán"));
  it("od syna bratrance je bratranec otec a já bratranec otce", () => {
    expect(pribuznost(g, "bs", "br").label).toBe("otec");
    expect(pribuznost(g, "bs", "j").label).toBe("bratranec otce");
  });
  it("od ženy je můj děd děd manžela", () => expect(pribuznost(g, "z", "d").label).toBe("děd manžela"));
});

describe("polorodí a dvojí příbuzenství", () => {
  const rel = (pairs: string[][]) => pairs.map(([type, a, b], i) => ({ id: i, type: type as "rodic" | "manzele", a, b, certainty: "doc" }));
  const nodes = (xs: string[]) => xs.map((x) => node(x.split(":")[0], x.split(":")[1] as "M" | "F"));

  // děd (d) má s první ženou (w1) otce (o), s druhou (w2) syna (ns); otec × matka (m) → já (j); ns → jeho syn (nb)
  const h = new Graf(
    nodes(["d:M", "w1:F", "w2:F", "o:M", "ns:M", "m:F", "j:M", "nb:M"]),
    rel([["rodic", "d", "o"], ["rodic", "w1", "o"], ["rodic", "d", "ns"], ["rodic", "w2", "ns"], ["rodic", "o", "j"], ["rodic", "m", "j"], ["rodic", "ns", "nb"]]),
  );
  it("nevlastní strýc a bratranec (jen společný děd)", () => {
    expect(pribuznost(h, "j", "ns").label).toBe("nevlastní strýc");
    expect(pribuznost(h, "j", "nb").label).toBe("nevlastní bratranec");
    expect(pribuznost(h, "o", "ns").label).toBe("nevlastní bratr");
  });

  // bratři A, B (rodiče P × Q) si vzali sestry M1, M2 (rodiče R × S) → x a y jsou bratranec a sestřenice dvakrát
  const d2 = new Graf(
    nodes(["P:M", "Q:F", "R:M", "S:F", "A:M", "B:M", "M1:F", "M2:F", "x:M", "y:F"]),
    rel([
      ["rodic", "P", "A"], ["rodic", "Q", "A"], ["rodic", "P", "B"], ["rodic", "Q", "B"],
      ["rodic", "R", "M1"], ["rodic", "S", "M1"], ["rodic", "R", "M2"], ["rodic", "S", "M2"],
      ["manzele", "P", "Q"], ["manzele", "R", "S"],
      ["rodic", "A", "x"], ["rodic", "M1", "x"], ["rodic", "B", "y"], ["rodic", "M2", "y"],
    ]),
  );
  it("všechny cesty: dvojí sestřenice, pár předků = jedna cesta", () => {
    const c = vsechnyCesty(d2, "x", "y");
    expect(c.map((x) => x.label)).toEqual(["sestřenice", "sestřenice"]);
    expect(c.filter((x) => ["P", "Q"].includes(x.via))).toHaveLength(1);
    expect(c.filter((x) => ["R", "S"].includes(x.via))).toHaveLength(1);
    expect(c.every((x) => !x.half)).toBe(true);
  });
});

describe("pomocné", () => {
  it("dlouhé řady předků", () => {
    expect(bloodLabel(4, 0, "F")).toBe("praprababička");
    expect(bloodLabel(9, 0, "M")).toBe("předek v 9. pokolení");
    expect(bloodLabel(3, 3, "F")).toBe("sestřenice z 2. kolena");
    expect(bloodLabel(3, 1, "M")).toBe("prastrýc");
    expect(bloodLabel(1, 3, "F")).toBe("praneteř");
  });
  it("2. pád", () => {
    expect(genitive("prababička")).toBe("prababičky");
    expect(genitive("bratranec z 2. kolena")).toBe("bratrance z 2. kolena");
  });
  it("Kekulé od kořene", () => {
    const k = g.kekule("j");
    expect(k.get(1)).toBe("j");
    expect(k.get(2)).toBe("o");
    expect(k.get(3)).toBe("m");
    expect(k.get(4)).toBe("d");
    expect(k.get(5)).toBe("b");
    expect(k.get(8)).toBe("pd");
  });
  it("datum z textu", () => {
    expect(parseDate("12. 3. 1873")).toMatchObject({ yearFrom: 1873, month: 3, day: 12, dateQual: "presne" });
    expect(parseDate("asi 1720")).toMatchObject({ yearFrom: 1720, dateQual: "asi" });
    expect(parseDate("před 1740")).toMatchObject({ yearFrom: 1740, dateQual: "pred" });
    expect(parseDate("1720–1785")).toMatchObject({ yearFrom: 1720, yearTo: 1785, dateQual: "mezi" });
  });
});
