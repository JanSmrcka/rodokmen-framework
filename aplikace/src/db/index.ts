import "server-only";
import { loadRootEnv } from "./env";
import { makeDb, type Db } from "./client";

loadRootEnv();

const g = globalThis as unknown as { __rodokmenDb?: Db };

// jeden pool na proces (i přes hot reload v dev)
export function db(): Db {
  if (!g.__rodokmenDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Chybí DATABASE_URL (zkopírujte .env.example do .env v kořeni repa).");
    g.__rodokmenDb = makeDb(url);
  }
  return g.__rodokmenDb;
}

export type { Db };
