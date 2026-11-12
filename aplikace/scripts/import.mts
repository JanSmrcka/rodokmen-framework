// Jednorázový import starých dat do DB:
//   python3 -I ../tools/archiv/export_pro_import.py            → ../pracovni/import/data.json
//   npm run import -- [../pracovni/import/data.json] [--reset] [--nanecisto]
// --reset      smaže data rodokmenu (i účty; API tokeny zůstanou) – jen pro opakovaný zkušební import
// --nanecisto  vše proběhne a na konci se transakce vrátí (nic se neuloží) – kontrola varování
import fs from "node:fs";
import path from "node:path";
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--")) ?? path.resolve(process.cwd(), "..", "pracovni", "import", "data.json");
const reset = args.includes("--reset");
const dry = args.includes("--nanecisto");
// --produkce: cíl je PROD_DATABASE_URL z .env (Neon); před importem se použijí migrace
const prod = args.includes("--produkce");
if (prod) {
  if (!process.env.PROD_DATABASE_URL) throw new Error("Chybí PROD_DATABASE_URL v .env (connection string z Neonu).");
  process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
}
const url = process.env.DATABASE_URL ?? "";
if (reset && !/localhost|127\.0\.0\.1/.test(url) && !prod) {
  throw new Error("--reset mimo localhost jen s --produkce (cíl PROD_DATABASE_URL).");
}
if (prod) {
  const { makeDb, migrateDb } = await import("../src/db/client");
  const m = makeDb(url);
  await migrateDb(m);
  await m.$client.end();
  console.log(`Produkce: ${url.replace(/:[^:@/]+@/, ":***@")} – migrace použity.`);
}

const { sql } = await import("drizzle-orm");
const { db } = await import("../src/db");
const { withTx } = await import("../src/server/tx");
const { importOld, DATA_TABLES } = await import("../src/server/importer");

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const actor = { name: "import", role: "admin" as const };
class Rollback extends Error {}
const t0 = Date.now();
let report: Awaited<ReturnType<typeof importOld>> | null = null;
try {
  await withTx(async (tx) => {
    // účty a přihlášení přežijí reset (osoby mají stejná id), obnoví se po importu
    const keep = reset
      ? {
          users: (await tx.execute(sql`select coalesce(jsonb_agg(u), '[]') as j from user_account u`)).rows[0].j,
          sessions: (await tx.execute(sql`select coalesce(jsonb_agg(s), '[]') as j from session s`)).rows[0].j,
        }
      : null;
    if (reset) await tx.execute(sql.raw(`truncate ${DATA_TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`));
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from person`)).rows;
    if (n > 0) throw new Error(`V DB už je ${n} osob – import jde jen do prázdné DB (lokálně --reset).`);
    report = await importOld(tx, actor, data);
    if (keep) {
      const users = keep.users as { id: number; username: string; person_id: string }[];
      const lost = (
        await tx.execute<{ username: string }>(
          sql`select x.username from jsonb_to_recordset(${JSON.stringify(users)}::jsonb) as x(username text, person_id text)
              where not exists (select 1 from person p where p.id = x.person_id)`,
        )
      ).rows.map((r) => r.username);
      await tx.execute(sql`insert into user_account overriding system value
        select * from jsonb_populate_recordset(null::user_account, ${JSON.stringify(users)}::jsonb) u
        where exists (select 1 from person p where p.id = u.person_id)`);
      await tx.execute(sql`select setval(pg_get_serial_sequence('user_account', 'id'), greatest((select max(id) from user_account), 1))`);
      await tx.execute(sql`insert into session select * from jsonb_populate_recordset(null::session, ${JSON.stringify(keep.sessions)}::jsonb) s
        where exists (select 1 from user_account u where u.id = s.user_id)`);
      report.counts["účty zachované"] = users.length - lost.length;
      for (const u of lost) report.warnings.push(`účet ${u}: osoba po importu neexistuje – účet nezachován`);
    }
    if (dry) throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) throw e;
}
const r = report!;
console.log(`${dry ? "NANEČISTO (nic neuloženo)" : "Import hotový"} za ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const [k, v] of Object.entries(r.counts)) console.log(`  ${k}: ${v}`);
if (r.warnings.length) {
  console.log(`Varování (${r.warnings.length}):`);
  for (const w of r.warnings) console.log(`  - ${w}`);
}
await db().$client.end();
