// Připojení k DB bez `server-only` – pro skripty (tsx) a testy. Aplikace používá src/db/index.ts.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import path from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

export function makeDb(url: string) {
  // malý pool: na Vercelu běží víc instancí funkce, Neon pooler zbytek obslouží
  const pool = new Pool({ connectionString: url, max: process.env.VERCEL ? 3 : 10 });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof makeDb>;

// skripty i testy běží ze složky aplikace/
export async function migrateDb(d: Db, opts: { reset?: boolean } = {}) {
  const MIGRATIONS = path.resolve(process.cwd(), "drizzle");
  if (opts.reset) {
    await d.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await d.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await d.execute(sql`CREATE SCHEMA public`);
  }
  await migrate(d, { migrationsFolder: MIGRATIONS });
}
