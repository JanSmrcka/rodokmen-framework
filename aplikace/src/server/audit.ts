import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { changeLog } from "@/db/schema";
import type { Actor } from "./actor";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;

// Každý zápis do dat jde sem: historie změn (data nejsou v gitu) a zároveň verze pro cache grafu.
export async function audit(
  tx: Tx,
  actor: Actor,
  entity: string,
  entityId: string | number,
  action: "create" | "update" | "delete",
  before: unknown,
  after: unknown,
) {
  await tx.insert(changeLog).values({
    actor: actor.name,
    entity,
    entityId: String(entityId),
    action,
    before: strip(before),
    after: strip(after),
  });
}

// obrázky a hesla do historie nepatří
function strip(v: unknown): unknown {
  if (!v || typeof v !== "object") return v ?? null;
  const o = { ...(v as Record<string, unknown>) };
  delete o.bytes;
  delete o.passwordHash;
  return o;
}

// číslo poslední změny; mění se po každém zápisu (cache grafu a webu)
export async function dataVersion(d: Tx): Promise<number> {
  const r = await d.execute<{ v: number | null }>(sql`select max(id) as v from change_log`);
  return Number(r.rows[0]?.v ?? 0);
}
