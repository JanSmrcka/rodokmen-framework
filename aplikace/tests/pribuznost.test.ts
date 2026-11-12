import { describe, expect, it } from "vitest";
import { Graf, type GNode } from "../src/server/graf";
import { bloodLabel, genitive, pribuznost } from "../src/server/pribuznost";
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
