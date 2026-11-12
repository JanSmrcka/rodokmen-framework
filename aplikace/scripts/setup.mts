// První spuštění nového rodokmenu jedním příkazem: vy jako první osoba (kořen stromu), účet správce a token pro AI.
//   npm run setup -- --jmeno Petr --prijmeni Novák --pohlavi M [--narozeni 1980] [--nazev "Rodokmen Novákových"]
// Proti produkci: DATABASE_URL=<neon url> npm run setup -- …  (DB musí být zmigrovaná: npm run db:migrate)
import { parseArgs } from "node:util";
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const { values: a } = parseArgs({
  options: {
    jmeno: { type: "string" },
    prijmeni: { type: "string" },
    pohlavi: { type: "string" },
    narozeni: { type: "string" },
    nazev: { type: "string" },
    token: { type: "string", default: "claude" },
  },
});
if (!a.jmeno || !a.prijmeni || !["M", "F"].includes(a.pohlavi ?? "")) {
  console.error('Použití: npm run setup -- --jmeno Petr --prijmeni Novák --pohlavi M|F [--narozeni 1980] [--nazev "Rodokmen Novákových"]');
  process.exit(1);
}

const { withTx } = await import("../src/server/tx");
const { SYSTEM } = await import("../src/server/actor");
const { createPerson } = await import("../src/server/osoby");
const { setSetting } = await import("../src/server/vyklad");
const { createAccounts } = await import("../src/server/uzivatele");
const { createApiToken } = await import("../src/server/auth");
const { db } = await import("../src/db");
const { person } = await import("../src/db/schema");

if ((await db().select({ id: person.id }).from(person).limit(1)).length) {
  console.error("Databáze už obsahuje osoby – setup je jen pro prázdný rodokmen. Správce: npm run admin -- <id>, token: npm run token -- <nazev> agent.");
  process.exit(1);
}

const result = await withTx(async (tx) => {
  const { id } = await createPerson(tx, SYSTEM, {
    sex: a.pohlavi as "M" | "F",
    given: a.jmeno!,
    surname: a.prijmeni!,
    certainty: "fam",
    living: true,
    placeholder: false,
    names: [],
    sources: [],
    events: a.narozeni ? [{ type: "narozeni", dateText: a.narozeni, certainty: "fam", role: "hlavni", sources: [] }] : [],
  } as Parameters<typeof createPerson>[2]);
  await setSetting(tx, SYSTEM, "vychozi_koren", id);
  if (a.nazev) await setSetting(tx, SYSTEM, "nazev", a.nazev);
  return { id };
});
// účet až po uložení osoby (kontroluje ji ve stromu, který se čte mimo transakci)
const [creds] = await withTx((tx) => createAccounts(tx, { ...SYSTEM, personId: result.id }, [result.id], "admin"));
const token = await createApiToken(a.token!, "agent");

console.log(`Hotovo.
  osoba (kořen stromu): ${result.id}
  správce webu:         jméno ${creds.username}, heslo ${creds.password}   (ukáže se jen teď)

Do .env v kořeni repa:
  RODOKMEN_API_TOKEN=${token}

Dál: npm run dev → http://localhost:3000, ověření: python3 -I tools/rdb.py ja
V Claude Code pak stačí napsat „pokračuj v rodokmenu“ – zeptá se na rodiče a prarodiče.`);
await db().$client.end();
