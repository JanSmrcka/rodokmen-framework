// Import starého formátu na malém vzorku (bez obrázků). Běží v transakci, která se na konci vrátí.
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { importOld } from "../src/server/importer";

const data = {
  koren: "/neexistuje",
  osoby: {
    OSOBY: {
      "imp-josef-1880": { n: "Josef Imp", sex: "M", y: "1880–1950", st: "doc", f: ["* 4. 5. 1880 Impov čp. 3", "× 1. 2. 1905 Impov Anna Testová", "sedlák v Impově (1910)"], r: ["n-impov-1880-josef-imp"] },
      "imp-anna-1885": { n: "Anna Testová (?)", sex: "F", y: "* 1885", st: "fam", f: ["× 1. 2. 1905 Impov Josef Imp"], note: "Žijící – údaje jen základní." },
      "imp-otec-neuveden": { n: "otec neuveden", sex: "M", y: "", st: "unk", f: [] },
      "imp-kmotr": { n: "Karel Kmotr", sex: "M", y: "", st: "doc", f: [], r: ["n-impov-1880-josef-imp"] },
    },
    VZTAHY: [
      { t: "manzele", a: "imp-josef-1880", b: "imp-anna-1885", datum: "1. 2. 1905" },
      { t: "rodic", a: "imp-otec-neuveden", b: "imp-anna-1885" },
      { t: "kmotr", a: "imp-kmotr", b: "imp-josef-1880", r: ["n-impov-1880-josef-imp"] },
    ],
    RODY: { imp: { nazev: "Impové", popis: "", zakladatel: "imp-josef-1880" } },
    KORENY: { hlavni: "imp-josef-1880" },
    ISSUES: [["Kde se vzal Josef?", "Otevřené: nevíme"]],
    HYPOTEZY: [],
  },
  domy: { D: { "Impov 3": { obec: "Impov", cp: "3", nazev: "U Impů", st: "doc", drzitele: [{ n: "Josef Imp", o: "imp-josef-1880", od: "1905", st: "doc", r: ["n-impov-1880-josef-imp", "neni-zapis"] }] } } },
  svazky: { imp_1: { archiv: "SOA", svazek: "N Impov 1870–1890", url: "https://example.com" } },
  zaznamy: [{ klic: "n-impov-1880-josef-imp", svazek: "imp_1", snimek: 5, druh: "N", datum: "4. 5. 1880", nazev: "Narození Josefa", shrnuti: "…" }],
  prepisy: { "n-impov-1880-josef-imp": { orig: "Joseph", cs: "Josef" } },
  zvyrazneni: {},
  mista: { Impov: { re: "Impov", dotaz: "Impov", lat: 49, lon: 15 } },
  mista_nazvy: { mista: [] },
  prijmeni_varianty: {},
  mapy: [],
  dokumenty: [],
  web: { nazev: "Imp test" },
  md: {
    "research_log.md": "| # | datum | zdroj | rozsah | hledáno | výsledek | citace |\n|---|---|---|---|---|---|---|\n| 1 | 2026-11-06 | SOA, N Impov (imp) | sn. 5 | křest Josefa | nalezeno: 4. 5. 1880 | n-impov-1880-josef-imp |\n| 2 | 2026-11-06 | SOA | sn. 1–9 | křest Anny | nenalezeno | – |",
    "udaje_od_rodiny.md": "# Údaje od rodiny\n\n## 2026-11-06 – Josef Imp (z paměti)\n- Anna Testová byla švadlena.\n",
    "STAV.md": "# Stav\n\n## Rozpracováno\n**DALŠÍ KROKY:** kolo\n- Křest Anny Testové v Impově.\n",
  },
  vyrezy: [],
  zdroje: [],
};

class Rollback extends Error {}

describe("import starých dat", () => {
  it("převede osoby, fakta, zdroje, domy, deník a vodítka", async () => {
    const out: Record<string, unknown> = {};
    await db()
      .transaction(async (tx) => {
        await tx.execute(sql`delete from person where id like 'imp-%'`);
        const rep = await importOld(tx, { name: "import", role: "admin" }, data);
        const q = async (s: ReturnType<typeof sql>) => (await tx.execute(s)).rows;
        out.rep = rep;
        out.events = await q(sql`select e.type, e.year_from, e.day, e.place_slug, e.house_key, e.text, e.certainty from event e
          join event_person ep on ep.event_id = e.id where ep.person_id = 'imp-josef-1880' order by e.id`);
        out.roles = await q(sql`select person_id, role from record_person where record_key = 'n-impov-1880-josef-imp' order by person_id`);
        out.anna = await q(sql`select p.living, n.certainty, n.surname from person p join person_name n on n.person_id = p.id and n.is_primary where p.id = 'imp-anna-1885'`);
        out.placeholder = await q(sql`select placeholder from person where id = 'imp-otec-neuveden'`);
        out.holder = await q(sql`select record_key, more_record_keys from house_holder where house_key = 'impov-3'`);
        out.log = await q(sql`select result from research_log where author = 'deník (import)' order by id`);
        out.tips = await q(sql`select status, told_by_person_id from tip where text like '%švadlena%'`);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
    const ev = out.events as Record<string, unknown>[];
    expect(ev[0]).toMatchObject({ type: "narozeni", year_from: 1880, day: 4, place_slug: "impov", house_key: "impov-3", text: "4. 5. 1880 Impov čp. 3", certainty: "doc" });
    expect(ev[1]).toMatchObject({ type: "snatek", year_from: 1905 });
    expect(ev[2]).toMatchObject({ type: "jine", year_from: 1910, text: "sedlák v Impově (1910)" });
    expect(ev.filter((e) => e.type === "snatek")).toHaveLength(1); // sňatek z hrany se nezdvojil
    expect(out.roles).toEqual([
      { person_id: "imp-josef-1880", role: "dite" },
      { person_id: "imp-kmotr", role: "kmotr" },
    ]);
    expect(out.anna).toEqual([{ living: true, certainty: "prob", surname: "Testová" }]);
    expect(out.placeholder).toEqual([{ placeholder: true }]);
    expect(out.holder).toEqual([{ record_key: "n-impov-1880-josef-imp", more_record_keys: [] }]);
    expect((out.log as { result: string }[]).map((l) => l.result)).toEqual(["nalezeno", "nenalezeno"]);
    expect(out.tips).toEqual([{ status: "nezpracovano", told_by_person_id: "imp-josef-1880" }]);
  });
});
