import type { Db } from "@/db/client";
import { db } from "@/db";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// všechny zápisy běží v transakci (nález = jedna transakce přes víc tabulek)
export function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db().transaction(fn);
}
