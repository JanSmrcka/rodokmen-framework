// Hlavní dotazy musí jít přes index. Testovací data jsou malá, takže sekvenční čtení vypínáme,
// aby plán ukázal, jestli vhodný index vůbec existuje.
import { describe, expect, it } from "vitest";
import { sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";

async function plan(q: SQL): Promise<string> {
  return db().transaction(async (tx) => {
    await tx.execute(sql`set local enable_seqscan = off`);
    const r = await tx.execute<{ "QUERY PLAN": string }>(sql`explain ${q}`);
    return r.rows.map((x) => x["QUERY PLAN"]).join("\n");
  });
}

const cases: [string, SQL, RegExp][] = [
  ["hledání jména (trigramy)", sql`select person_id from person_name where search % 'novak'`, /person_name_search_trgm/],
  ["hledání v zápisech", sql`select key from record where search like '%lhota%'`, /record_search_trgm/],
  ["hledání místa", sql`select place_slug from place_name where search % 'oberdorf'`, /place_name_search_trgm/],
  ["děti osoby", sql`select b_id from relation where type = 'rodic' and a_id = 'x'`, /relation_uq/],
  ["rodiče osoby", sql`select a_id from relation where type = 'rodic' and b_id = 'x'`, /relation_type_b_idx/],
  ["události osoby", sql`select event_id from event_person where person_id = 'x'`, /event_person_person_idx/],
  ["zápisy osoby", sql`select record_key from record_person where person_id = 'x'`, /record_person_person_idx/],
  ["otevřená vodítka", sql`select id from tip where status in ('nezpracovano','overuje_se') order by received_at desc`, /tip_open_idx/],
  ["deník nejnovější", sql`select id from research_log order by at desc limit 10`, /research_log_at_idx/],
  ["události v místě", sql`select id from event where place_slug = 'x' and year_from <= 1850`, /event_place_idx/],
  ["události druhu a let", sql`select id from event where type = 'narozeni' and year_from between 1800 and 1850`, /event_type_year_idx/],
  ["bydliště v místě", sql`select id from residence where place_slug = 'x'`, /residence_place_idx/],
  ["deník k osobě", sql`select log_id from research_log_person where person_id = 'x'`, /research_log_person_person_idx/],
  ["deník ke svazku", sql`select id from research_log where volume_key = 'x'`, /research_log_volume_idx/],
  ["svazky obce a druhu", sql`select key from volume where place_slug = 'x' and kind = 'S'`, /volume_place_kind_idx/],
  ["session", sql`select user_id from session where id_hash = 'x'`, /session_pkey/],
  ["verze dat", sql`select max(id) from change_log`, /change_log_pkey/],
  ["obrázek", sql`select bytes from media where sha256 = 'x'`, /media_pkey/],
];

describe("indexy", () => {
  for (const [name, q, idx] of cases) it(name, async () => expect(await plan(q)).toMatch(idx));
});
