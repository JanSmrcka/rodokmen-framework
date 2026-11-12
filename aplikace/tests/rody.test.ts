import { describe, expect, it } from "vitest";
import { Graf, type GNode } from "../src/server/graf";
import { computeRody, rodName, rodyFor, rodyOfPersons, topOf, vetve, type StoredLine } from "../src/server/rody";

const node = (id: string, sex: "M" | "F", surname: string, living = false): GNode => ({
  id, name: `${id} ${surname}`, given: id, surname, sex, certainty: "doc", yearsText: null, sameAsId: null, placeholder: false,
  livingFlag: living, birthYear: null, deathYear: null, living,
});

// Svobodové: x → praprabába (ppb, F) → pradědův otec (pdo) → praděd (pd) → děd (d) → otec (o), strýc (s)
// otec × matka (m, Horáková; otec mf, matka mm Malá – nemanželská dcera Malé pm) → já (j), sestra (se)
// sestra × švagr (sv, Procházka; otec jf, matka bk Černá) → synovec (sy)
const nodes = [
  node("x", "M", "Novák"), node("ppb", "F", "Nováková"), node("pdo", "M", "Svoboda"), node("pd", "M", "Svoboda"),
  node("d", "M", "Svoboda"), node("o", "M", "Svoboda"), node("s", "M", "Svoboda"),
  node("mf", "M", "Horák"), node("pm", "F", "Malá"), node("mm", "F", "Malá"), node("m", "F", "Horáková"),
  node("j", "M", "Svoboda", true), node("se", "F", "Svobodová", true),
  node("jf", "M", "Procházka"), node("bk", "F", "Černá"), node("sv", "M", "Procházka", true), node("sy", "M", "Procházka", true),
];
const parents: [string, string][] = [
  ["x", "ppb"], ["ppb", "pdo"], ["pdo", "pd"], ["pd", "d"], ["d", "o"], ["d", "s"],
  ["pm", "mm"], ["mf", "m"], ["mm", "m"], ["o", "j"], ["m", "j"], ["o", "se"], ["m", "se"],
  ["jf", "sv"], ["bk", "sv"], ["sv", "sy"], ["se", "sy"],
];
const graf = (extra: GNode[] = [], extraParents: [string, string][] = []) =>
  new Graf(
    [...nodes, ...extra],
    [
      ...[...parents, ...extraParents].map(([a, b], i) => ({ id: i, type: "rodic" as const, a, b, certainty: "doc" })),
      { id: 900, type: "manzele" as const, a: "o", b: "m", certainty: "doc" },
      { id: 901, type: "manzele" as const, a: "sv", b: "se", certainty: "doc" },
    ],
  );
const stored = (slug: string, founderId: string, name = slug): StoredLine => ({ slug, name, description: null, color: null, founderId });

describe("rody", () => {
  const g = graf();
  const r = computeRody(g, [stored("svobodove", "o", "Svobodové")]);
  const rod = (id: string) => r.lineOf.get(id);

  it("vrchol: po meči, po matce jen nemanželské dítě s jejím příjmením", () => {
    expect(topOf(g, "j")).toBe("pdo");
    expect(topOf(g, "pdo")).toBe("pdo"); // otec neznámý, matka Nováková → rod nekončí u Nováků
    expect(topOf(g, "mm")).toBe("pm"); // nemanželská dcera → rod matky
  });

  it("uložený rod platí pro celou linii, i když zakladatel stojí uprostřed", () => {
    expect(["o", "s", "d", "pd", "j", "se"].map(rod)).toEqual(Array(6).fill("svobodove"));
  });

  it("dopočítané rody pro předky žijících do pradědů", () => {
    expect(rod("m")).toBe("rod-mf");
    expect(rod("mm")).toBe("rod-pm");
    expect(rod("sv")).toBe("rod-jf");
    expect(rod("sy")).toBe("rod-jf"); // synovec v rodu otce
    const names = Object.fromEntries(r.lines.map((l) => [l.slug, l.name]));
    expect(names).toMatchObject({ "rod-mf": "Horákové", "rod-pm": "Malí", "rod-jf": "Procházkové" });
    expect(r.lines.find((l) => l.slug === "rod-jf")!.auto).toBe(true);
  });

  it("přivdaná žena bez rodičů nemá vlastní rod, patří k rodu dětí", () => {
    expect(r.lines.some((l) => l.topId === "bk")).toBe(false);
    expect(rod("bk")).toBe("rod-jf");
  });

  it("dcera v rodu otce, manželka ve svém rodu", () => {
    expect(rod("se")).toBe("svobodove");
    expect(rod("m")).not.toBe("svobodove");
  });

  it("staří předci přes ženskou linii patří k rodu pod nimi", () => {
    expect(rod("x")).toBe("svobodove");
    expect(rod("ppb")).toBe("svobodove");
    expect(r.lines.some((l) => l.topId === "x")).toBe(false);
  });

  it("starší předek nalezený později rod nerozbije", () => {
    const g2 = graf([node("pdoo", "M", "Svoboda")], [["pdoo", "pdo"]]);
    const r2 = computeRody(g2, [stored("svobodove", "o")]);
    expect(r2.lineOf.get("j")).toBe("svobodove");
    expect(r2.lineOf.get("pdoo")).toBe("svobodove");
  });

  it("dva uložené rody na jedné linii jsou konflikt", () => {
    const r2 = computeRody(g, [stored("svobodove", "o"), stored("svobodove-lhota", "pd")]);
    expect(r2.conflicts).toHaveLength(1);
    expect(r2.lineOf.get("j")).toBe("svobodove");
  });

  it("moje rody: vlastní a předků, od nejbližších", () => {
    expect(rodyFor(g, r, "j")).toEqual(["svobodove", "rod-mf", "rod-pm"]);
    expect(rodyFor(g, r, "sy")).toEqual(["rod-jf", "svobodove", "rod-mf", "rod-pm"]);
    expect(rodyFor(g, r, "sv")).toEqual(["rod-jf"]); // švagr: Procházkové, ne Svobodové
  });

  it("rody položky podle jejích osob", () => {
    expect(rodyOfPersons(r, ["j", "sv", "se", "neznamy"])).toEqual(["svobodove", "rod-jf"]);
  });

  it("počty členů", () => {
    expect(r.lines.find((l) => l.slug === "rod-jf")!.size).toBe(4); // jf, sv, sy + přivdaná bk
  });

  it("větve podle prarodičů: prarodič, jeho předci a boční linie; blízcí a přiženění mimo", () => {
    const v = vetve(g, "j");
    expect([...v.keys()]).toEqual([4, 6, 7]);
    expect([...v.get(4)!].sort()).toEqual(["d", "pd", "pdo", "ppb", "s", "x"]); // strýc ano, otec a sestra ne
    expect([...v.get(7)!].sort()).toEqual(["mm", "pm"]);
    for (const clan of v.values()) for (const id of ["j", "o", "m", "se", "sy", "sv"]) expect(clan.has(id)).toBe(false);
  });

  it("jméno rodu z příjmení", () => {
    expect([rodName("Horáková"), rodName("Procházka"), rodName("Bílý"), rodName("")]).toEqual(["Horákové", "Procházkové", "Bílí", "Rod bez příjmení"]);
    expect(["Staněk", "Matěk", "Hájek", "Zajíc", "Šek", "Janů", "Rossi", "Staňková", "Maťková", "Marek"].map(rodName)).toEqual([
      "Staňkové", "Maťkové", "Hájkové", "Zajícové", "Šekové", "Rod Janů", "Rod Rossi", "Staňkové", "Maťkové", "Markové",
    ]);
  });
});
