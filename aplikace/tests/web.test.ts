// Data webu z pohledu přihlášeného (testovací DB s ukázkovou rodinou z api.test.ts nebo čerstvě nasetovaná).
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { person } from "../src/db/schema";
import { SYSTEM, type Actor } from "../src/server/actor";
import { withTx } from "../src/server/tx";
import { seedUkazka } from "../src/server/ukazka";
import { getSiteFor } from "../src/server/web";

const tomas: Actor = { name: "user:tomas", role: "member", personId: "tomas-novak-1945", userId: 1 };
const lucie: Actor = { name: "user:lucie", role: "member", personId: "lucie-bila-1982", userId: 2 };

beforeAll(async () => {
  const [has] = await db().select({ id: person.id }).from(person).where(eq(person.id, "petr-novak-1980"));
  if (!has) await withTx((tx) => seedUkazka(tx, SYSTEM));
});

describe("web z pohledu přihlášeného", () => {
  it("kořen, Kekulé a příbuznost od přihlášeného", async () => {
    const s = await getSiteFor(tomas);
    expect(s.root).toBe("tomas-novak-1945");
    expect(s.people["vaclav-novak-1850"]).toMatchObject({ k: 8, gen: 3, rel: "praděd" });
    expect(s.people["petr-novak-1980"].rel).toBe("syn");
    expect(s.people["eva-novakova-1948"].rel).toBe("sestra");
  });

  it("přivdaná osoba vidí svůj strom a rodinu manžela přes sňatek", async () => {
    const s = await getSiteFor(lucie);
    expect(s.root).toBe("lucie-bila-1982");
    expect(s.people["martin-bily-1955"]).toMatchObject({ k: 2, rel: "otec" });
    expect(s.people["tomas-novak-1945"].rel).toBe("tchán");
    expect(s.people["vaclav-novak-1850"].k).toBeNull();
    expect(s.people["vaclav-novak-1850"].rel).toBe("prapraděd manžela");
  });

  it("žijící: člen vidí jen jméno a rok narození, správce vše", async () => {
    const m = (await getSiteFor(tomas)).people["hana-cerna-1950"];
    expect(m.facts).toEqual(["* 1950"]);
    expect(m.homes).toEqual([]);
    expect(m.records).toEqual([]);
    const a = (await getSiteFor({ ...SYSTEM, personId: "petr-novak-1980" })).people["hana-cerna-1950"];
    expect(a.facts.length).toBeGreaterThanOrEqual(1);
  });

  it("vidí celý strom obou větví", async () => {
    const s = await getSiteFor(tomas);
    expect(Object.keys(s.people)).toEqual(expect.arrayContaining(["martin-bily-1955", "jiri-novak-1912", "lucie-bila-1982"]));
  });

  it("rody: po meči, nezávisle na přihlášeném", async () => {
    const s = await getSiteFor(lucie);
    expect(s.people["petr-novak-1980"].lineSlug).toBe("novakove");
    expect(s.people["marie-svobodova-1885"].lineSlug).toBe("svobodovi");
    expect(s.people["lucie-bila-1982"].lineSlug).toBe("rod-martin-bily-1955"); // dopočítaný rod jejího otce
  });

  it("moje: pokrevní příbuzní a manžel, dopočítané rody pro větev bez rodů", async () => {
    const s = await getSiteFor(lucie);
    expect(s.mine.people).toEqual(expect.arrayContaining(["lucie-bila-1982", "martin-bily-1955", "petr-novak-1980"]));
    expect(s.mine.people).not.toContain("vaclav-novak-1850");
    expect(s.mine.lines.map((l) => s.lines[l].name)).toEqual(["Bílí"]);
    expect(s.lines[s.mine.lines[0]].auto).toBe(true);
    expect(s.mine.stories).toEqual([]); // příběh Nováků je rod manžela
    const t = await getSiteFor(tomas);
    expect(t.mine.lines).toEqual(expect.arrayContaining(["novakove", "svobodovi"]));
    expect(t.mine.stories).toContain("/pribeh-rodu/");
  });

  it("mapa: moje místa = předci přihlášeného", async () => {
    const t = (await getSiteFor(tomas)).places.find((p) => p.slug === "lhota")!;
    expect(t.mine).toEqual(expect.arrayContaining(["vaclav-novak-1850", "jan-novak-1915"]));
    const l = (await getSiteFor(lucie)).places.find((p) => p.slug === "lhota")!;
    expect(l.mine).toEqual([]);
  });
});
