// Kontrola dat: graf + pravidla projektu (každý zápis má výřez a rámeček, doložené údaje mají zdroj).
// Importovaná stará data měla zdroje jen u osoby jako celku – u nich stačí, že osoba má zápis.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { loadGraf } from "./graf";
import { loadRody, rodyOfPersons } from "./rody";

type Row = Record<string, unknown>;
const rows = async <T extends Row>(q: ReturnType<typeof sql>) => (await db().execute<T>(q)).rows;

export async function kontrola() {
  const g = await loadGraf();
  const [bezVyrezu, bezRamecku, udalosti, vztahy, bydliste, osoby, keKontrole] = await Promise.all([
    // zápisy z matrik a pramenů bez obrázku (literatura a jiné nepotřebují)
    rows<{ key: string; title: string }>(sql`
      select r.key, r.title from record r
      where r.kind not in ('L', 'J') and not exists (select 1 from media m where m.record_key = r.key)
      order by r.key`),
    rows<{ key: string; title: string }>(sql`
      select r.key, r.title from record r
      where exists (select 1 from media m where m.record_key = r.key)
        and not exists (select 1 from highlight h where h.record_key = r.key and jsonb_array_length(h.boxes) > 0)
      order by r.key`),
    // doložené / pravděpodobné údaje bez citace
    rows<{ id: number; type: string; persons: string }>(sql`
      select e.id, e.type, string_agg(ep.person_id, ', ') as persons from event e
      join event_person ep on ep.event_id = e.id
      where e.certainty in ('doc', 'prob') and not exists (select 1 from citation c where c.event_id = e.id)
        and not (e.created_by = 'import' and exists (select 1 from event_person x join record_person rp on rp.person_id = x.person_id where x.event_id = e.id))
      group by e.id order by e.id`),
    rows<{ id: number; type: string; a_id: string; b_id: string }>(sql`
      select r.id, r.type, r.a_id, r.b_id from relation r
      where r.certainty in ('doc', 'prob') and not exists (select 1 from citation c where c.relation_id = r.id)
        and not (r.created_by = 'import' and exists (select 1 from record_person rp where rp.person_id in (r.a_id, r.b_id)))
      order by r.id`),
    rows<{ id: number; person_id: string; place: string | null }>(sql`
      select b.id, b.person_id, coalesce(b.place_slug, b.place_text) as place from residence b
      where b.certainty in ('doc', 'prob') and not exists (select 1 from citation c where c.residence_id = b.id)
      order by b.id`),
    // osoba „doloženo matrikou“ bez jediného zápisu
    rows<{ id: string }>(sql`
      select p.id from person p
      where p.certainty = 'doc' and not p.placeholder
        and not exists (select 1 from record_person rp where rp.person_id = p.id)
        and not exists (select 1 from citation c where c.person_id = p.id and c.record_key is not null)
      order by p.id`),
    rows<{ key: string }>(sql`select key from record where review = 'ke_kontrole' order by key`),
  ]);
  // vodítka bez osoby v rodu (nejdou najít filtrem --rod)
  const { rody } = await loadRody();
  const tips = await rows<{ id: number; persons: string[] | null }>(sql`
    select t.id, array_remove(array_agg(tp.person_id), null) as persons from tip t
    left join tip_person tp on tp.tip_id = t.id
    where t.status in ('nezpracovano', 'overuje_se') group by t.id order by t.id`);
  const tipsBezRodu = tips.filter((t) => !rodyOfPersons(rody, t.persons ?? []).length);
  const chyby = [...g.errors(), ...rody.conflicts];
  const upozorneni = [
    ...bezVyrezu.map((r) => `zápis ${r.key}: chybí výřez (${r.title})`),
    ...bezRamecku.map((r) => `zápis ${r.key}: chybí rámeček zápisu ve výřezu`),
    ...udalosti.map((e) => `událost ${e.id} (${e.type}; ${e.persons}): doložená bez zdroje`),
    ...vztahy.map((r) => `vztah ${r.id} (${r.type} ${r.a_id} → ${r.b_id}): doložený bez zdroje`),
    ...bydliste.map((b) => `bydliště ${b.id} (${b.person_id}, ${b.place ?? "?"}): doložené bez zdroje`),
    ...osoby.map((o) => `osoba ${o.id}: „doloženo matrikou“, ale bez zápisu`),
    ...tipsBezRodu.map((t) => `vodítko ${t.id}: ${t.persons?.length ? "osoby nepatří do žádného rodu" : "bez osob"} (přiřaď osoby: voditko uprav)`),
  ];
  return {
    ok: chyby.length === 0 && upozorneni.length === 0,
    chyby,
    upozorneni,
    keKontrole: keKontrole.map((r) => r.key),
    pocty: {
      bezVyrezu: bezVyrezu.length,
      bezRamecku: bezRamecku.length,
      bezZdroje: udalosti.length + vztahy.length + bydliste.length,
      dolozeniBezZapisu: osoby.length,
      voditkaBezRodu: tipsBezRodu.length,
    },
  };
}
