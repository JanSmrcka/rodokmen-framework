// Fiktivní ukázková rodina do prázdné lokální DB (vývoj). Skutečná data se importují zvlášť.
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("Seed jen do lokální DB.");

const { withTx } = await import("../src/server/tx");
const { seedUkazka } = await import("../src/server/ukazka");
const { db } = await import("../src/db");
await withTx((tx) => seedUkazka(tx));
console.log("Ukázková data nahrána.");
await db().$client.end();
