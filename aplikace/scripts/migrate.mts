// Použití: npm run db:migrate            – použije migrace na DATABASE_URL
//          npm run db:migrate -- --reset – smaže celou DB a vytvoří ji znovu (jen vývoj!)
import { loadRootEnv } from "../src/db/env";
import { makeDb, migrateDb } from "../src/db/client";

loadRootEnv();
// na Vercelu s Neonem: migrace přímým spojením (pooler je pro aplikaci)
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL");
const reset = process.argv.includes("--reset");
if (reset && !/localhost|127\.0\.0\.1/.test(url)) throw new Error("--reset jen pro lokální DB");

const d = makeDb(url);
await migrateDb(d, { reset });
console.log(reset ? "DB smazána a znovu vytvořena." : "Migrace použity.");
await d.$client.end();
