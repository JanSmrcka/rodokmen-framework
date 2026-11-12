// API end-to-end přes směrovač (bez HTTP serveru) proti testovací DB s ukázkovou rodinou.
import { beforeAll, describe, expect, it } from "vitest";
import { SYSTEM } from "../src/server/actor";
import { dispatch } from "../src/server/api";
import { createApiToken, login } from "../src/server/auth";
import { withTx } from "../src/server/tx";
import { seedUkazka } from "../src/server/ukazka";
import { createAccounts } from "../src/server/uzivatele";

let agent = "";
let admin = "";
let member = ""; // cookie Tomáše (žije)
let memberCreds = { username: "", password: "" };

async function call(method: string, path: string, opts: { token?: string; cookie?: string; body?: unknown; raw?: Buffer } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cookie) headers.cookie = `rodokmen_session=${opts.cookie}`;
  const body = opts.raw ? new Uint8Array(opts.raw) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  const req = new Request(`http://test/api/v1/${path}`, { method, headers, body });
  const parts = new URL(req.url).pathname.split("/").slice(3).filter(Boolean);
  const res = await dispatch(req, parts);
  return { status: res.status, data: await res.json() };
}

beforeAll(async () => {
  await withTx((tx) => seedUkazka(tx));
  agent = await createApiToken("test-agent", "agent");
  admin = await createApiToken("test-admin", "admin");
  const [c] = await withTx((tx) => createAccounts(tx, { ...SYSTEM, personId: "petr-novak-1980" }, ["tomas-novak-1945"]));
  memberCreds = c;
  member = (await login(c.username, c.password, "127.0.0.1")).token;
});

describe("přístup", () => {
  it("bez přihlášení 401", async () => expect((await call("GET", "osoby")).status).toBe(401));
  it("špatný token 401", async () => expect((await call("GET", "osoby", { token: "rdk_x" })).status).toBe(401));
  it("člen nesmí zapisovat data", async () => {
    const r = await call("PUT", "svazky/x", { cookie: member, body: { archive: "a", title: "t" } });
    expect(r.status).toBe(403);
  });
  it("agent nesmí mazat osoby", async () => {
    expect((await call("DELETE", "osoby/jiri-novak-1912", { token: agent })).status).toBe(403);
  });
  it("karta: jméno z osoby a čitelné heslo", () => {
    expect(memberCreds.username).toBe("tomas.novak");
    expect(memberCreds.password).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d+$/);
  });
  it("po 5 špatných pokusech zablokováno", async () => {
    for (let i = 0; i < 5; i++) await expect(login("eva.x", "spatne", null)).rejects.toThrow();
    await expect(login("eva.x", "spatne", null)).rejects.toThrow(/Příliš mnoho/);
  });
});

describe("pohled přihlášeného", () => {
  it("strom a příbuznost se počítají od přihlášeného", async () => {
    const r = await call("GET", "osoby/vaclav-novak-1850", { cookie: member });
    expect(r.status).toBe(200);
    expect(r.data.relationToViewer.label).toBe("praděd"); // Tomáš → Jan → Josef → Václav
    expect(r.data.kekule).toBe(8);
    const k = await call("GET", "graf/kekule", { cookie: member });
    expect(k.data[0]).toMatchObject({ k: 1, id: "tomas-novak-1945" });
  });
  it("žijící osoba: člen vidí jen jméno a rok narození", async () => {
    const r = await call("GET", "osoby/hana-cerna-1950", { cookie: member });
    expect(r.data.living).toBe(true);
    expect(r.data.relationToViewer.label).toBe("manželka");
    expect(r.data.events).toHaveLength(1);
    expect(r.data.events[0]).toMatchObject({ type: "narozeni", yearFrom: 1950, placeSlug: null, day: null });
    expect(r.data.residences).toEqual([]);
    expect(r.data.note).toBeNull();
  });
  it("agent vidí žijící celé", async () => {
    const r = await call("GET", "osoby/hana-cerna-1950", { token: agent });
    expect(r.data.yearsText).toBe("* 1950");
  });
});

describe("zápis přes API", () => {
  it("nález v jedné transakci", async () => {
    const r = await call("POST", "nalez", {
      token: agent,
      body: {
        volume: { key: "ukazka_2", archive: "SOA (ukázka)", title: "O Lhota 1870–1880" },
        record: {
          key: "o-lhota-1875-vaclav-novak",
          volumeKey: "ukazka_2",
          imageNo: 7,
          kind: "O",
          dateText: "20. 1. 1875",
          title: "Sňatek Václava Nováka a Anny Dvořákové",
          summary: "Svědek František Dvořák, bratr nevěsty.",
          review: "ke_kontrole",
          persons: [{ personId: "vaclav-novak-1850", role: "zenich" }, { personId: "anna-dvorakova-1855", role: "nevesta" }],
        },
        people: [
          {
            id: "frantisek-dvorak-1850",
            sex: "M",
            given: "František",
            surname: "Dvořák",
            certainty: "doc",
            events: [{ type: "povolani", text: "mlynář", certainty: "doc" }],
          },
        ],
        events: [
          {
            type: "snatek",
            dateText: "20. 1. 1875",
            placeSlug: "lhota",
            certainty: "doc",
            persons: [
              { personId: "vaclav-novak-1850", role: "zenich" },
              { personId: "anna-dvorakova-1855", role: "nevesta" },
              { personId: "frantisek-dvorak-1850", role: "svedek" },
            ],
          },
        ],
        log: { textMd: "Sňatek nalezen, svědek bratr nevěsty." },
      },
    });
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data.people).toEqual(["frantisek-dvorak-1850"]);
    const rec = await call("GET", "zaznamy/o-lhota-1875-vaclav-novak", { token: agent });
    expect(rec.data.persons.map((p: { role: string }) => p.role).sort()).toEqual(["nevesta", "svedek", "zenich"]);
    const log = await call("GET", "denik?osoba=frantisek-dvorak-1850", { token: agent });
    expect(log.data[0].recordKeys).toContain("o-lhota-1875-vaclav-novak");
    expect(log.data[0].personIds.sort()).toEqual(["anna-dvorakova-1855", "frantisek-dvorak-1850", "vaclav-novak-1850"]); // ženich a nevěsta ze zápisu
    const u = await call("PATCH", `denik/${log.data[0].id}`, { token: agent, body: { personIds: ["vaclav-novak-1850"] } });
    expect(u.status).toBe(200);
    const after = await call("GET", "denik?osoba=vaclav-novak-1850", { token: agent });
    expect(after.data[0]).toMatchObject({ personIds: ["vaclav-novak-1850"], recordKeys: ["o-lhota-1875-vaclav-novak"] });
  });

  it("chybný nález se celý vrátí", async () => {
    const r = await call("POST", "nalez", {
      token: agent,
      body: {
        record: { key: "n-chyba", kind: "N", title: "chyba" },
        relations: [{ type: "rodic", aId: "neexistuje", bId: "petr-novak-1980" }],
      },
    });
    expect(r.status).toBe(400);
    expect((await call("GET", "zaznamy/n-chyba", { token: agent })).status).toBe(404);
  });

  it("vodítko od člena jde do fronty, vidí jen svá", async () => {
    const r = await call("POST", "voditka", {
      cookie: member,
      body: { kind: "od_rodiny", text: "Děda Jan hrál na housle v kapele.", personIds: ["jan-novak-1915"] },
    });
    expect(r.status).toBe(201);
    expect(r.data.status).toBe("nezpracovano");
    expect(r.data.toldByPersonId).toBe("tomas-novak-1945");
    const mine = await call("GET", "voditka", { cookie: member });
    expect(mine.data).toHaveLength(1);
    const all = await call("GET", "voditka?otevrena=1", { token: agent });
    expect(all.data.length).toBeGreaterThanOrEqual(2);
    const done = await call("PATCH", `voditka/${r.data.id}`, { token: agent, body: { status: "nelze_overit", resolutionNote: "Bez pramene." } });
    expect(done.data.resolvedAt).toBeTruthy();
  });

  it("rody: seznam s dopočítanými, rody osoby, vodítka a úkoly podle rodu", async () => {
    const all = await call("GET", "rody", { token: agent });
    const slugs = all.data.rody.map((l: { slug: string }) => l.slug);
    expect(slugs).toEqual(expect.arrayContaining(["novakove", "svobodovi", "rod-martin-bily-1955"]));
    const lucie = await call("GET", "rody?pro=lucie-bila-1982", { token: agent });
    expect(lucie.data.rody.map((l: { slug: string }) => l.slug)).toEqual(["rod-martin-bily-1955"]);
    const d = await call("GET", "rody/rod-martin-bily-1955", { token: agent });
    expect(d.data).toMatchObject({ name: "Bílí", auto: true });
    expect(d.data.members.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(["lucie-bila-1982", "martin-bily-1955"]));

    const t = await call("POST", "voditka", { token: agent, body: { kind: "zvest", text: "Bílí byli mlynáři.", personIds: ["martin-bily-1955"] } });
    const bili = await call("GET", "voditka?otevrena=1&rod=rod-martin-bily-1955", { token: agent });
    expect(bili.data.map((x: { id: number }) => x.id)).toEqual([t.data.id]);
    expect(bili.data[0].lines).toEqual(["rod-martin-bily-1955"]);
    const novaci = await call("GET", "voditka?otevrena=1&rod=novakove", { token: agent });
    expect(novaci.data.some((x: { id: number }) => x.id === t.data.id)).toBe(false);
    expect((await call("GET", "voditka?rod=neni", { token: agent })).status).toBe(400);

    await call("POST", "ukoly", { token: agent, body: { title: "Mlýn Bílých", priority: 2, personIds: ["lucie-bila-1982"] } });
    const u = await call("GET", "ukoly?rod=rod-martin-bily-1955", { token: agent });
    expect(u.data.map((x: { title: string }) => x.title)).toEqual(["Mlýn Bílých"]);
    const bez = await call("GET", "ukoly?rod=bez", { token: agent });
    expect(bez.data.every((x: { lines: string[] }) => x.lines.length === 0)).toBe(true);

    const v = await call("GET", "voditka?otevrena=1&vetev=lucie-bila-1982", { token: agent });
    expect(v.data.find((x: { id: number }) => x.id === t.data.id).branches).toEqual([]); // Martin je její otec = blízcí
    expect((await call("GET", "denik?prarodic=4", { token: agent })).status).toBe(400);
    const p = await call("GET", "osoby/lucie-bila-1982", { token: agent });
    expect(p.data.lineSlug).toBe("rod-martin-bily-1955");
    const o = await call("PATCH", `voditka/${t.data.id}`, { token: agent, body: { personIds: ["lucie-bila-1982"] } });
    expect(o.status).toBe(200);
    const r = await call("PATCH", `voditka/${t.data.id}`, { token: agent, body: { status: "rozdeleno", resolutionNote: "Rozděleno do #x." } });
    expect(r.data.status).toBe("rozdeleno");
  });

  it("hledání bez diakritiky", async () => {
    const r = await call("GET", "osoby?q=dvorakova", { token: agent });
    expect(r.data[0].id).toBe("anna-dvorakova-1855");
    const m = await call("GET", "mista?q=oberdorf", { token: agent });
    expect(m.data[0].slug).toBe("horni-ves");
  });

  it("hledání snese tvary z matrik a ukáže roky", async () => {
    const r = await call("GET", "osoby?q=Anna%20Dworzakowa", { token: agent });
    expect(r.data[0]).toMatchObject({ id: "anna-dvorakova-1855", yearsText: "asi 1855–1920" });
    const w = await call("GET", "osoby?q=Wenzel%20Nowak", { token: agent }); // německý zápis křestního jména nehledáme, příjmení ano
    expect(w.data.length).toBe(0);
    const n = await call("GET", "osoby?q=Nowak%20Waclaw", { token: agent });
    expect(n.data[0].id).toBe("vaclav-novak-1850");
  });

  it("osoby podle místa a let", async () => {
    const r = await call("GET", "osoby?misto=lhota&od=1870&do=1890&udalost=narozeni", { token: agent });
    expect(r.data.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(["josef-novak-1880", "karel-novak-1883"]));
    expect(r.data.map((x: { id: string }) => x.id)).not.toContain("vaclav-novak-1850");
  });

  it("výřez jako obrázek v DB", async () => {
    // nejmenší platné JPEG záhlaví s rozměry 2×3
    const jpg = Buffer.from("ffd8ffc0000b080003000201011100ffd9", "hex");
    const r = await call("PUT", "zaznamy/n-lhota-1880-josef-novak/vyrez", { token: agent, raw: jpg });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data).toMatchObject({ mime: "image/jpeg", width: 2, height: 3 });
    expect(r.data.url).toMatch(/^\/media\/[a-f0-9]{64}$/);
  });

  it("kontrola grafu a audit", async () => {
    const r = await call("GET", "kontrola", { token: agent });
    expect(r.data.chyby).toEqual([]);
    expect(r.data.keKontrole).toContain("o-lhota-1875-vaclav-novak");
  });

  it("PATCH nepřepisuje nezadaná pole výchozími hodnotami", async () => {
    await call("PATCH", "zaznamy/n-lhota-1880-josef-novak", { token: agent, body: { title: "Narození Josefa Nováka (opraveno)" } });
    const r = await call("GET", "zaznamy/n-lhota-1880-josef-novak", { token: agent });
    expect(r.data).toMatchObject({ title: "Narození Josefa Nováka (opraveno)", review: "overeno" });
    expect(r.data.summary).toMatch(/domkáře/);
    const t = await call("POST", "ukoly", { token: agent, body: { title: "x", priority: 1, personIds: ["jan-novak-1915"] } });
    const p = await call("PATCH", `ukoly/${t.data.id}`, { token: agent, body: { status: "hotovy" } });
    expect(p.data).toMatchObject({ status: "hotovy", priority: 1 });
    const m = await call("PATCH", "mista/lhota", { token: agent, body: { description: "ves" } });
    expect(m.data).toMatchObject({ name: "Lhota", lat: 49.5, description: "ves" });
  });

  it("osoba v zápisu nemá vedle skutečné role i „zminen“", async () => {
    const r = await call("GET", "zaznamy/o-lhota-1875-vaclav-novak", { token: agent });
    const roles = r.data.persons.filter((p: { personId: string }) => p.personId === "frantisek-dvorak-1850").map((p: { role: string }) => p.role);
    expect(roles).toEqual(["svedek"]);
  });

  it("výřez k neexistujícímu zápisu → 404", async () => {
    const r = await call("PUT", "zaznamy/neni/vyrez", { token: agent, raw: Buffer.from("ffd8ffd9", "hex") });
    expect(r.status).toBe(404);
  });

  it("hromadné čtení osob s detaily, ořez žijících platí", async () => {
    const r = await call("GET", "osoby?detail=1&id=vaclav-novak-1850,hana-cerna-1950", { cookie: member });
    expect(r.data.map((p: { id: string }) => p.id)).toEqual(["vaclav-novak-1850", "hana-cerna-1950"]);
    expect(r.data[0].relationToViewer.label).toBe("praděd");
    expect(r.data[1].residences).toEqual([]);
  });

  it("kontrola hlásí zápis bez výřezu a doložený údaj bez zdroje", async () => {
    await call("PUT", "zaznamy/z-lhota-1910-vaclav-novak", { token: agent, body: { kind: "Z", title: "Úmrtí Václava" } });
    await call("POST", "vztahy", { token: agent, body: { type: "rodic", aId: "karel-novak-1883", bId: "eva-novakova-1948", certainty: "doc" } });
    const r = await call("GET", "kontrola", { token: agent });
    expect(r.data.upozorneni.join("\n")).toMatch(/z-lhota-1910-vaclav-novak: chybí výřez/);
    expect(r.data.upozorneni.join("\n")).toMatch(/rodic karel-novak-1883 → eva-novakova-1948\): doložený bez zdroje/);
  });

  it("sčítací operát jako svazek obce a roku", async () => {
    await call("PUT", "svazky/mza_scitani_lhota_1880", {
      token: agent,
      body: { archive: "MZA", title: "Sčítání 1880 Lhota", kind: "S", yearFrom: 1880, placeSlug: "lhota", meta: { cesta: "A/B/C", prefix: "X-Y", signatura: "Z-01" } },
    });
    const r = await call("GET", "svazky?misto=lhota&druh=S&rok=1880", { token: agent });
    expect(r.data).toHaveLength(1);
    expect(r.data[0].meta.signatura).toBe("Z-01");
  });

  it("admin vytvoří účty jen žijícím", async () => {
    const bad = await call("POST", "uzivatele", { token: admin, body: { personIds: ["vaclav-novak-1850"] } });
    expect(bad.status).toBe(400);
    const ok = await call("POST", "uzivatele", { token: admin, body: { personIds: ["eva-novakova-1948"] } });
    expect(ok.status).toBe(201);
    expect(ok.data[0].username).toBe("eva.novakova");
  });
});

describe("opravy z poznámek k skillu", () => {
  it("nález s už zapsaným vztahem neselže, vztah jen dostane citaci", async () => {
    const r = await call("POST", "nalez", {
      token: agent,
      body: {
        record: { key: "o-lhota-1875-opis", volumeKey: "ukazka_1", imageNo: 9, kind: "O", dateText: "1875", title: "Opis sňatku" },
        relations: [{ type: "manzele", aId: "anna-dvorakova-1855", bId: "vaclav-novak-1850", certainty: "doc" }],
      },
    });
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    expect(r.data.relations).toEqual([]);
    expect(r.data.existingRelations).toHaveLength(1);
  });

  it("týž obrázek u dvou zápisů zůstane u obou", async () => {
    const jpg = Buffer.from("ffd8ffc0000b080005000401011100ffd9", "hex");
    for (const key of ["n-lhota-1880-josef-novak", "o-lhota-1875-opis"]) {
      expect((await call("PUT", `zaznamy/${key}/vyrez`, { token: agent, raw: jpg })).status).toBe(200);
    }
    const a = await call("GET", "zaznamy/n-lhota-1880-josef-novak", { token: agent });
    const b = await call("GET", "zaznamy/o-lhota-1875-opis", { token: agent });
    expect(a.data.images).toHaveLength(1);
    expect(b.data.images).toHaveLength(1);
    expect(a.data.images[0].sha256).not.toBe(b.data.images[0].sha256);
  });

  it("úprava domu bez jistoty jistotu nepřepíše", async () => {
    const r = await call("PUT", "domy/lhota-12", { token: agent, body: { placeSlug: "lhota", cp: "12", description: "Domek u návsi." } });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.certainty).toBe("doc");
  });

  it("omylem přidaný název místa jde smazat", async () => {
    const n = await call("POST", "mista/lhota/nazvy", { token: agent, body: { name: "Omyl", lang: "de" } });
    expect((await call("DELETE", `mista/lhota/nazvy/${n.data.id}`, { token: agent })).status).toBe(200);
    const p = await call("GET", "mista/lhota", { token: agent });
    expect(p.data.names.map((x: { name: string }) => x.name)).not.toContain("Omyl");
  });

  it("osoba z úmrtního zápisu má jen roli zemřelý", async () => {
    await call("PUT", "zaznamy/z-lhota-1950-test", { token: agent, body: { volumeKey: "ukazka_1", kind: "Z", dateText: "1950", title: "Úmrtí" } });
    const r = await call("POST", "osoby", {
      token: agent,
      body: {
        sex: "M", given: "Test", surname: "Zemřelý", certainty: "doc",
        events: [
          { type: "narozeni", dateText: "1880", certainty: "doc", sources: [{ recordKey: "z-lhota-1950-test" }] },
          { type: "umrti", dateText: "1950", certainty: "doc", sources: [{ recordKey: "z-lhota-1950-test" }] },
        ],
      },
    });
    expect(r.status, JSON.stringify(r.data)).toBe(201);
    const rec = await call("GET", "zaznamy/z-lhota-1950-test", { token: agent });
    expect(rec.data.persons.map((p: { role: string }) => p.role)).toEqual(["zemrely"]);
  });

  it("konec manželství (rozvod) a výsledek deníku „nedostupné“", async () => {
    const rel = await call("POST", "vztahy", {
      token: agent,
      body: { type: "manzele", aId: "karel-novak-1883", bId: "anna-dvorakova-1855", endReason: "rozvod", endText: "1925" },
    });
    expect(rel.status, JSON.stringify(rel.data)).toBe(201);
    expect(rel.data).toMatchObject({ endReason: "rozvod", endText: "1925" });
    const u = await call("PATCH", `vztahy/${rel.data.id}`, { token: agent, body: { endText: "1926" } });
    expect(u.data.endText).toBe("1926");
    await call("DELETE", `vztahy/${rel.data.id}`, { token: agent });
    const l = await call("POST", "denik", { token: agent, body: { title: "Portál nejde", result: "nedostupne" } });
    expect(l.status, JSON.stringify(l.data)).toBe(201);
    expect(l.data.result).toBe("nedostupne");
  });

  it("příbuznost vrací i všechny cesty", async () => {
    const r = await call("GET", "graf/pribuznost?od=petr-novak-1980&k=vaclav-novak-1850", { token: agent });
    expect(r.data.label).toBeTruthy();
    expect(r.data.cesty).toHaveLength(1); // předek: jediná cesta
  });
});
