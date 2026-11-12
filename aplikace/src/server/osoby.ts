// Osoby, jména, vztahy, události, bydliště a citace zdrojů.
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  citation,
  event,
  eventPerson,
  person,
  personName,
  record,
  recordPerson,
  relation,
  residence,
  sideNote,
  surnameVariant,
} from "@/db/schema";
import { requireAdmin, requireEdit, type Actor } from "./actor";
import { audit, dataVersion } from "./audit";
import { badRequest, conflict, must, notFound } from "./errors";
import { norm, parseDate, slugify } from "./text";
import type { Tx } from "./tx";
import type * as V from "./vstupy";

type Src = z.infer<typeof V.Source>;

// ---------- osoba ----------
export async function newPersonId(tx: Tx, given: string, surname: string, year: number | null) {
  const base = slugify([given, surname, year ?? ""].join(" ")) || "osoba";
  let id = base;
  for (let i = 2; ; i++) {
    const [hit] = await tx.select({ id: person.id }).from(person).where(eq(person.id, id)).limit(1);
    if (!hit) return id;
    id = `${base}-${i}`;
  }
}

export async function createPerson(tx: Tx, actor: Actor, inp: z.infer<typeof V.PersonIn>) {
  requireEdit(actor);
  const birth = inp.events.find((e) => e.type === "narozeni" || e.type === "krest");
  const year = birth?.yearFrom ?? parseDate(birth?.dateText).yearFrom ?? null;
  const id = inp.id ?? (await newPersonId(tx, inp.given, inp.surname, year));
  const [exists] = await tx.select({ id: person.id }).from(person).where(eq(person.id, id)).limit(1);
  if (exists) throw conflict(`Osoba ${id} už existuje.`);
  const row = {
    id,
    sex: inp.sex,
    certainty: inp.certainty,
    living: inp.living ?? null,
    yearsText: inp.yearsText ?? null,
    note: inp.note ?? null,
    notePrivate: inp.notePrivate ?? null,
    sameAsId: inp.sameAsId ?? null,
    placeholder: inp.placeholder,
    createdBy: actor.name,
  };
  await tx.insert(person).values(row);
  await audit(tx, actor, "person", id, "create", null, row);
  await addName(tx, actor, id, {
    given: inp.given,
    surname: inp.surname,
    kind: "rodne",
    isPrimary: true,
    certainty: inp.certainty,
  });
  for (const n of inp.names) await addName(tx, actor, id, { ...n, isPrimary: false });
  for (const { role, ...e } of inp.events) await addEvent(tx, actor, { ...e, persons: [{ personId: id, role }] });
  for (const s of inp.sources) await addCitation(tx, actor, { personId: id, ...s });
  return { id };
}

export async function updatePerson(tx: Tx, actor: Actor, id: string, patch: z.infer<typeof V.PersonPatch>) {
  requireEdit(actor);
  const [before] = await tx.select().from(person).where(eq(person.id, id));
  must(before, `osoba ${id}`);
  if (patch.sameAsId === id) throw badRequest("Osoba nemůže být sama sebou.");
  const [after] = await tx.update(person).set(patch).where(eq(person.id, id)).returning();
  await audit(tx, actor, "person", id, "update", before, after);
  return after;
}

export async function deletePerson(tx: Tx, actor: Actor, id: string) {
  requireAdmin(actor);
  const [before] = await tx.select().from(person).where(eq(person.id, id));
  must(before, `osoba ${id}`);
  await tx.delete(person).where(eq(person.id, id));
  await audit(tx, actor, "person", id, "delete", before, null);
}

// ---------- jména ----------
export async function addName(tx: Tx, actor: Actor, personId: string, n: z.input<typeof V.NameIn>) {
  requireEdit(actor);
  if (n.isPrimary) await tx.update(personName).set({ isPrimary: false }).where(eq(personName.personId, personId));
  const row = {
    personId,
    given: n.given ?? "",
    surname: n.surname ?? "",
    kind: n.kind ?? "rodne",
    isPrimary: n.isPrimary ?? false,
    certainty: n.certainty ?? "unk",
    note: n.note ?? null,
    search: norm(n.given, n.surname),
    createdBy: actor.name,
  };
  const [r] = await tx.insert(personName).values(row).returning();
  await audit(tx, actor, "person_name", r.id, "create", null, r);
  return r;
}

export async function updateName(tx: Tx, actor: Actor, id: number, patch: Partial<z.infer<typeof V.NameIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(personName).where(eq(personName.id, id));
  must(before, `jméno ${id}`);
  if (patch.isPrimary) await tx.update(personName).set({ isPrimary: false }).where(eq(personName.personId, before.personId));
  const given = patch.given ?? before.given;
  const surname = patch.surname ?? before.surname;
  const [after] = await tx
    .update(personName)
    .set({ ...patch, search: norm(given, surname) })
    .where(eq(personName.id, id))
    .returning();
  await audit(tx, actor, "person_name", id, "update", before, after);
  return after;
}

export async function deleteName(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(personName).where(eq(personName.id, id));
  must(before, `jméno ${id}`);
  if (before.isPrimary) throw badRequest("Hlavní jméno nejde smazat – nejdřív nastavte jiné jako hlavní.");
  await tx.delete(personName).where(eq(personName.id, id));
  await audit(tx, actor, "person_name", id, "delete", before, null);
}

// ---------- vztahy ----------
async function assertPersons(tx: Tx, ids: string[]) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return;
  const rows = await tx.select({ id: person.id }).from(person).where(inArray(person.id, uniq));
  const missing = uniq.filter((i) => !rows.some((r) => r.id === i));
  if (missing.length) throw badRequest(`Neznámé osoby: ${missing.join(", ")}`);
}

export async function addRelation(tx: Tx, actor: Actor, inp: z.infer<typeof V.RelationIn>) {
  requireEdit(actor);
  await assertPersons(tx, [inp.aId, inp.bId]);
  if (inp.aId === inp.bId) throw badRequest("Vztah osoby se sebou samou.");
  // manželé bez ohledu na pořadí
  if (inp.type === "manzele") {
    const [dup] = await tx
      .select({ id: relation.id })
      .from(relation)
      .where(and(eq(relation.type, "manzele"), eq(relation.aId, inp.bId), eq(relation.bId, inp.aId)));
    if (dup) throw conflict(`Manželé ${inp.aId} a ${inp.bId} už jsou zapsaní (vztah ${dup.id}).`);
  }
  const [r] = await tx
    .insert(relation)
    .values({ type: inp.type, aId: inp.aId, bId: inp.bId, certainty: inp.certainty, note: inp.note ?? null, createdBy: actor.name })
    .onConflictDoNothing()
    .returning();
  if (!r) throw conflict(`Vztah ${inp.type} ${inp.aId} → ${inp.bId} už existuje.`);
  await audit(tx, actor, "relation", r.id, "create", null, r);
  for (const s of inp.sources) await addCitation(tx, actor, { relationId: r.id, ...s });
  return r;
}

export async function updateRelation(tx: Tx, actor: Actor, id: number, patch: { certainty?: z.infer<typeof V.Certainty>; note?: string | null }) {
  requireEdit(actor);
  const [before] = await tx.select().from(relation).where(eq(relation.id, id));
  must(before, `vztah ${id}`);
  const [after] = await tx.update(relation).set(patch).where(eq(relation.id, id)).returning();
  await audit(tx, actor, "relation", id, "update", before, after);
  return after;
}

export async function deleteRelation(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(relation).where(eq(relation.id, id));
  must(before, `vztah ${id}`);
  await tx.delete(relation).where(eq(relation.id, id));
  await audit(tx, actor, "relation", id, "delete", before, null);
}

// ---------- události ----------
const RECORD_ROLE: Record<string, string> = { narozeni: "dite", krest: "dite", umrti: "zemrely", pohreb: "zemrely" };

function eventRow(e: Partial<z.infer<typeof V.EventIn>>) {
  const p = parseDate(e.dateText);
  return {
    type: e.type,
    dateText: e.dateText ?? null,
    dateQual: e.dateQual ?? p.dateQual,
    yearFrom: e.yearFrom ?? p.yearFrom,
    yearTo: e.yearTo ?? p.yearTo,
    month: e.month ?? p.month,
    day: e.day ?? p.day,
    placeSlug: e.placeSlug ?? null,
    houseKey: e.houseKey ?? null,
    placeText: e.placeText ?? null,
    text: e.text ?? null,
    certainty: e.certainty,
    note: e.note ?? null,
  };
}

export async function addEvent(tx: Tx, actor: Actor, inp: z.input<typeof V.EventIn>) {
  requireEdit(actor);
  const persons = inp.persons.map((p) => ({ personId: p.personId, role: p.role ?? "hlavni" }));
  await assertPersons(tx, persons.map((p) => p.personId));
  const row = { ...eventRow({ ...inp, certainty: inp.certainty ?? "unk" } as z.infer<typeof V.EventIn>), createdBy: actor.name };
  const [e] = await tx.insert(event).values(row as typeof event.$inferInsert).returning();
  await tx.insert(eventPerson).values(persons.map((p) => ({ eventId: e.id, ...p })));
  await audit(tx, actor, "event", e.id, "create", null, { ...e, persons });
  for (const s of inp.sources ?? []) {
    await addCitation(tx, actor, { eventId: e.id, ...s });
    // osoby události patří i k zápisu, ze kterého je doložená
    if (s.recordKey) {
      for (const p of persons) {
        const role = p.role !== "hlavni" ? p.role : (RECORD_ROLE[e.type] ?? "zminen");
        await linkRecordPerson(tx, s.recordKey, p.personId, role);
      }
    }
  }
  return e;
}

export async function updateEvent(tx: Tx, actor: Actor, id: number, patch: z.infer<typeof V.EventPatch>) {
  requireEdit(actor);
  const [before] = await tx.select().from(event).where(eq(event.id, id));
  must(before, `událost ${id}`);
  // změna textu data → znovu odvodit rok, měsíc, den (pokud nejsou zadané ručně)
  const p = patch.dateText !== undefined ? parseDate(patch.dateText) : null;
  const set = {
    ...patch,
    dateQual: patch.dateQual ?? undefined,
    ...(p && {
      dateQual: patch.dateQual ?? p.dateQual,
      yearFrom: patch.yearFrom ?? p.yearFrom,
      yearTo: patch.yearTo ?? p.yearTo,
      month: patch.month ?? p.month,
      day: patch.day ?? p.day,
    }),
  };
  const [after] = await tx.update(event).set(set).where(eq(event.id, id)).returning();
  await audit(tx, actor, "event", id, "update", before, after);
  return after;
}

export async function deleteEvent(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(event).where(eq(event.id, id));
  must(before, `událost ${id}`);
  await tx.delete(event).where(eq(event.id, id));
  await audit(tx, actor, "event", id, "delete", before, null);
}

// ---------- bydliště ----------
export async function addResidence(tx: Tx, actor: Actor, inp: z.input<typeof V.ResidenceIn>) {
  requireEdit(actor);
  await assertPersons(tx, [inp.personId]);
  const from = parseDate(inp.fromText);
  const to = parseDate(inp.toText);
  const { sources, ...rest } = inp;
  const [r] = await tx
    .insert(residence)
    .values({
      ...rest,
      certainty: inp.certainty ?? "unk",
      yearFrom: from.yearFrom,
      yearTo: to.yearFrom ?? to.yearTo,
      createdBy: actor.name,
    })
    .returning();
  await audit(tx, actor, "residence", r.id, "create", null, r);
  for (const s of sources ?? []) await addCitation(tx, actor, { residenceId: r.id, ...s });
  return r;
}

export async function updateResidence(tx: Tx, actor: Actor, id: number, patch: Partial<z.infer<typeof V.ResidenceIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(residence).where(eq(residence.id, id));
  must(before, `bydliště ${id}`);
  const p = { ...patch, sources: undefined }; // zdroje se přidávají přes /citace
  const extra: Record<string, number | null> = {};
  if (p.fromText !== undefined) extra.yearFrom = parseDate(p.fromText).yearFrom;
  if (p.toText !== undefined) extra.yearTo = parseDate(p.toText).yearFrom;
  const [after] = await tx.update(residence).set({ ...p, ...extra }).where(eq(residence.id, id)).returning();
  await audit(tx, actor, "residence", id, "update", before, after);
  return after;
}

export async function deleteResidence(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(residence).where(eq(residence.id, id));
  must(before, `bydliště ${id}`);
  await tx.delete(residence).where(eq(residence.id, id));
  await audit(tx, actor, "residence", id, "delete", before, null);
}

// ---------- citace a vazba osoba–zápis ----------
export async function addCitation(
  tx: Tx,
  actor: Actor,
  inp: { eventId?: number | null; relationId?: number | null; residenceId?: number | null; personId?: string | null } & Src,
) {
  requireEdit(actor);
  if (inp.recordKey) {
    const [r] = await tx.select({ k: record.key }).from(record).where(eq(record.key, inp.recordKey));
    if (!r) throw badRequest(`Neznámý zápis ${inp.recordKey} – nejdřív ho založte (PUT /zaznamy/<klic>).`);
  }
  const [c] = await tx
    .insert(citation)
    .values({
      eventId: inp.eventId ?? null,
      relationId: inp.relationId ?? null,
      residenceId: inp.residenceId ?? null,
      personId: inp.personId ?? null,
      recordKey: inp.recordKey ?? null,
      tipId: inp.tipId ?? null,
      documentId: inp.documentId ?? null,
      note: inp.note ?? null,
      createdBy: actor.name,
    })
    .returning();
  await audit(tx, actor, "citation", c.id, "create", null, c);
  if (inp.personId && inp.recordKey) await linkRecordPerson(tx, inp.recordKey, inp.personId, "zminen");
  return c;
}

export async function deleteCitation(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(citation).where(eq(citation.id, id));
  must(before, `citace ${id}`);
  await tx.delete(citation).where(eq(citation.id, id));
  await audit(tx, actor, "citation", id, "delete", before, null);
}

// „zminen“ je jen záloha: nepřidá se, když osoba v zápisu už roli má, a skutečná role ho nahradí
export async function linkRecordPerson(tx: Tx, recordKey: string, personId: string, role: string, nameAsWritten?: string | null) {
  const here = and(eq(recordPerson.recordKey, recordKey), eq(recordPerson.personId, personId));
  if (role === "zminen") {
    const [has] = await tx.select({ id: recordPerson.id }).from(recordPerson).where(here).limit(1);
    if (has) return;
  } else {
    await tx.delete(recordPerson).where(and(here, eq(recordPerson.role, "zminen")));
  }
  await tx
    .insert(recordPerson)
    .values({ recordKey, personId, role, nameAsWritten: nameAsWritten ?? null })
    .onConflictDoNothing();
}

export async function addSideNote(tx: Tx, actor: Actor, personId: string, title: string, text: string) {
  requireEdit(actor);
  const [r] = await tx.insert(sideNote).values({ personId, title, text, createdBy: actor.name }).returning();
  await audit(tx, actor, "side_note", r.id, "create", null, r);
  return r;
}

// ---------- čtení ----------
export async function personExists(id: string) {
  const [r] = await db().select({ id: person.id }).from(person).where(eq(person.id, id));
  return !!r;
}

// Hledání osob podle jména: tolerantní k tvarům z matrik (Wanek = Vaněk, Swoboda = Svoboda, Nowakin = Nováková).
// Jmen jsou stovky, takže se porovnávají v paměti (načtená jednou na verzi dat) – rychlejší než dotaz.
export function fon(s: string): string {
  return norm(s)
    .replace(/sch/g, "s")
    .replace(/cz/g, "c")
    .replace(/rz/g, "r")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kv")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/[yj]/g, "i")
    .replace(/(.)\1+/g, "$1");
}
// ženské a cizí koncovky příjmení pryč: Nováková / Nowakin / Novakowa → novak
const stem = (t: string) => (t.length > 4 ? t.replace(/(ova|ove|owa|ina|in|ka)$/, "") : t);

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

// shoda jednoho slova dotazu se slovem jména: 3 přesně / prefix, 2 stejný kmen, 1 o písmeno jinak
function tokenScore(q: string, n: string): number {
  if (n === q || n.startsWith(q)) return 3;
  const qs = stem(q);
  const ns = stem(n);
  if (qs === ns || (qs.length >= 3 && ns.startsWith(qs))) return 2;
  if (qs.length >= 4 && lev(qs, ns) <= 1) return 1;
  return 0;
}

let nameCache: { version: number; rows: { id: string; tokens: string[]; given: string; surname: string; kind: string }[] } | null = null;

async function nameIndex() {
  const version = await dataVersion(db());
  if (nameCache?.version === version) return nameCache.rows;
  const [names, variants] = await Promise.all([
    db().select({ id: personName.personId, given: personName.given, surname: personName.surname, kind: personName.kind }).from(personName),
    db().select({ surname: surnameVariant.surname, variant: surnameVariant.variant }).from(surnameVariant),
  ]);
  // varianty příjmení ze slovníku: k jménu přidat i známé zápisy
  const alt = new Map<string, string[]>();
  for (const v of variants) alt.set(fon(v.surname), [...(alt.get(fon(v.surname)) ?? []), fon(v.variant)]);
  const rows = names.map((n) => {
    const tokens = fon(`${n.given} ${n.surname}`).split(" ").filter(Boolean);
    return { ...n, tokens: [...tokens, ...(alt.get(fon(n.surname)) ?? [])] };
  });
  nameCache = { version, rows };
  return rows;
}

export async function searchPersons(q: string, limit = 30) {
  const qt = fon(q).split(" ").filter(Boolean);
  if (!qt.length) return [];
  const best = new Map<string, { id: string; given: string; surname: string; kind: string; score: number }>();
  for (const r of await nameIndex()) {
    let score = 0;
    for (const t of qt) {
      const m = Math.max(0, ...r.tokens.map((n) => tokenScore(t, n)));
      if (!m) {
        score = 0;
        break;
      }
      score += m;
    }
    if (score && score > (best.get(r.id)?.score ?? 0)) best.set(r.id, { id: r.id, given: r.given, surname: r.surname, kind: r.kind, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.surname.localeCompare(b.surname, "cs")).slice(0, limit);
}

// kdo měl událost nebo bydliště v místě a/nebo v rozmezí let (pro „kdo z rodokmenu se narodil v X 1800–1850“)
export async function personsByPlaceAndYears(o: { placeSlug?: string; from?: number; to?: number; type?: string }) {
  const evConds = [sql`true`];
  if (o.placeSlug) evConds.push(sql`e.place_slug = ${o.placeSlug}`);
  if (o.from) evConds.push(sql`coalesce(e.year_to, e.year_from) >= ${o.from}`);
  if (o.to) evConds.push(sql`e.year_from <= ${o.to}`);
  if (o.type && o.type !== "bydliste") evConds.push(sql`e.type = ${o.type}`);
  const resConds = [sql`true`];
  if (o.placeSlug) resConds.push(sql`b.place_slug = ${o.placeSlug}`);
  if (o.from) resConds.push(sql`coalesce(b.year_to, b.year_from, ${o.from}) >= ${o.from}`);
  if (o.to) resConds.push(sql`coalesce(b.year_from, ${o.to}) <= ${o.to}`);
  const evs =
    o.type === "bydliste"
      ? []
      : (
          await db().execute<{ personId: string; kind: string; year: number | null; text: string | null }>(sql`
        select ep.person_id as "personId", e.type as kind, e.year_from as year, coalesce(e.text, e.date_text) as text
        from event e join event_person ep on ep.event_id = e.id
        where ${sql.join(evConds, sql` and `)} order by e.year_from nulls last limit 2000`)
        ).rows;
  const res =
    !o.type || o.type === "bydliste"
      ? (
          await db().execute<{ personId: string; kind: string; year: number | null; text: string | null }>(sql`
        select b.person_id as "personId", 'bydliste' as kind, b.year_from as year,
          concat_ws(' ', coalesce(b.place_text, b.place_slug), case when b.cp is not null then 'čp. ' || b.cp end, b.role) as text
        from residence b where ${sql.join(resConds, sql` and `)} order by b.year_from nulls last limit 2000`)
        ).rows
      : [];
  return [...evs, ...res];
}

export async function personRaw(id: string) {
  const [p] = await personsRaw([id]);
  if (!p) throw notFound(`osoba ${id}`);
  return p;
}

// detail víc osob najednou: pevný počet dotazů bez ohledu na počet osob
export async function personsRaw(ids: string[]) {
  const d = db();
  const uniq = [...new Set(ids)];
  if (!uniq.length) return [];
  const [people, names, evs, rels, res, recs, cites, sides] = await Promise.all([
    d.select().from(person).where(inArray(person.id, uniq)),
    d.select().from(personName).where(inArray(personName.personId, uniq)),
    d
      .select({ e: event, personId: eventPerson.personId, role: eventPerson.role })
      .from(eventPerson)
      .innerJoin(event, eq(event.id, eventPerson.eventId))
      .where(inArray(eventPerson.personId, uniq)),
    d
      .select()
      .from(relation)
      .where(or(inArray(relation.aId, uniq), inArray(relation.bId, uniq))),
    d.select().from(residence).where(inArray(residence.personId, uniq)),
    d
      .select({
        personId: recordPerson.personId,
        key: record.key,
        kind: record.kind,
        title: record.title,
        dateText: record.dateText,
        role: recordPerson.role,
        review: record.review,
      })
      .from(recordPerson)
      .innerJoin(record, eq(record.key, recordPerson.recordKey))
      .where(inArray(recordPerson.personId, uniq)),
    d.select().from(citation).where(inArray(citation.personId, uniq)),
    d.select().from(sideNote).where(inArray(sideNote.personId, uniq)),
  ]);
  const eventIds = [...new Set(evs.map((x) => x.e.id))];
  const relIds = rels.map((r) => r.id);
  const resIds = res.map((r) => r.id);
  const [evCites, relCites, resCites, evPeople] = await Promise.all([
    eventIds.length ? d.select().from(citation).where(inArray(citation.eventId, eventIds)) : [],
    relIds.length ? d.select().from(citation).where(inArray(citation.relationId, relIds)) : [],
    resIds.length ? d.select().from(citation).where(inArray(citation.residenceId, resIds)) : [],
    eventIds.length ? d.select().from(eventPerson).where(inArray(eventPerson.eventId, eventIds)) : [],
  ]);
  const src = ({ id, recordKey, tipId, documentId, note }: typeof citation.$inferSelect) => ({ id, recordKey, tipId, documentId, note });
  const cit = (rows: (typeof citation.$inferSelect)[], key: "eventId" | "relationId" | "residenceId", id: number) =>
    rows.filter((c) => c[key] === id).map(src);
  const byId = new Map(people.map((p) => [p.id, p]));
  return uniq
    .filter((id) => byId.has(id))
    .map((id) => ({
      ...byId.get(id)!,
      names: names.filter((n) => n.personId === id),
      events: evs
        .filter((x) => x.personId === id)
        .map(({ e, role }) => ({
          ...e,
          role,
          persons: evPeople.filter((x) => x.eventId === e.id).map(({ personId, role }) => ({ personId, role })),
          sources: cit(evCites, "eventId", e.id),
        })),
      relations: rels.filter((r) => r.aId === id || r.bId === id).map((r) => ({ ...r, sources: cit(relCites, "relationId", r.id) })),
      residences: res.filter((r) => r.personId === id).map((r) => ({ ...r, sources: cit(resCites, "residenceId", r.id) })),
      records: recs.filter((r) => r.personId === id).map(({ personId: _p, ...r }) => (void _p, r)),
      sources: cites.filter((c) => c.personId === id).map(src),
      sideNotes: sides.filter((x) => x.personId === id),
    }));
}

export type PersonRaw = Awaited<ReturnType<typeof personRaw>>;
