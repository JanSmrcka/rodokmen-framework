// Rody, hypotézy, otevřené otázky, příběhy, dokumenty, mapy a nastavení webu.
import { asc, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  document,
  documentHouse,
  documentPerson,
  hypothesis,
  hypothesisRecord,
  line,
  mapSheet,
  question,
  setting,
  story,
} from "@/db/schema";
import { requireAdmin, requireEdit, type Actor } from "./actor";
import { audit } from "./audit";
import { badRequest, must, notFound } from "./errors";
import { slugify } from "./text";
import type { Tx } from "./tx";
import type * as V from "./vstupy";

const checkSlug = (s: string) => {
  if (s !== slugify(s)) throw badRequest(`Slug má být „${slugify(s)}“.`);
};

// ---------- rody ----------
export async function upsertLine(tx: Tx, actor: Actor, slug: string, inp: z.infer<typeof V.LineIn>) {
  requireEdit(actor);
  checkSlug(slug);
  const row = { slug, name: inp.name, description: inp.description ?? null, color: inp.color ?? null, founderId: inp.founderId ?? null };
  const [before] = await tx.select().from(line).where(eq(line.slug, slug));
  const [after] = before
    ? await tx.update(line).set(row).where(eq(line.slug, slug)).returning()
    : await tx.insert(line).values({ ...row, createdBy: actor.name }).returning();
  await audit(tx, actor, "line", slug, before ? "update" : "create", before ?? null, after);
  return after;
}

// ---------- hypotézy ----------
export async function addHypothesis(tx: Tx, actor: Actor, inp: z.infer<typeof V.HypothesisIn>) {
  requireEdit(actor);
  const { recordKeys, ...rest } = inp;
  const [h] = await tx.insert(hypothesis).values({ ...rest, personId: rest.personId ?? null, createdBy: actor.name }).returning();
  if (recordKeys.length) await tx.insert(hypothesisRecord).values(recordKeys.map((recordKey) => ({ hypothesisId: h.id, recordKey })));
  await audit(tx, actor, "hypothesis", h.id, "create", null, { ...h, recordKeys });
  return h;
}

export async function updateHypothesis(tx: Tx, actor: Actor, id: number, inp: Partial<z.infer<typeof V.HypothesisIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(hypothesis).where(eq(hypothesis.id, id));
  must(before, `hypotéza ${id}`);
  const { recordKeys, ...rest } = inp;
  const [after] = await tx.update(hypothesis).set(rest).where(eq(hypothesis.id, id)).returning();
  if (recordKeys) {
    await tx.delete(hypothesisRecord).where(eq(hypothesisRecord.hypothesisId, id));
    if (recordKeys.length) await tx.insert(hypothesisRecord).values(recordKeys.map((recordKey) => ({ hypothesisId: id, recordKey })));
  }
  await audit(tx, actor, "hypothesis", id, "update", before, { ...after, recordKeys });
  return after;
}

export async function deleteHypothesis(tx: Tx, actor: Actor, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(hypothesis).where(eq(hypothesis.id, id));
  must(before, `hypotéza ${id}`);
  await tx.delete(hypothesis).where(eq(hypothesis.id, id));
  await audit(tx, actor, "hypothesis", id, "delete", before, null);
}

export async function listHypotheses() {
  const d = db();
  const [hs, recs] = await Promise.all([d.select().from(hypothesis).orderBy(asc(hypothesis.id)), d.select().from(hypothesisRecord)]);
  return hs.map((h) => ({ ...h, recordKeys: recs.filter((r) => r.hypothesisId === h.id).map((r) => r.recordKey) }));
}

// ---------- otevřené otázky ----------
export async function addQuestion(tx: Tx, actor: Actor, inp: z.infer<typeof V.QuestionIn>) {
  requireEdit(actor);
  const [q] = await tx
    .insert(question)
    .values({ ...inp, personId: inp.personId ?? null, answer: inp.answer ?? null, createdBy: actor.name })
    .returning();
  await audit(tx, actor, "question", q.id, "create", null, q);
  return q;
}

export async function updateQuestion(tx: Tx, actor: Actor, id: number, inp: Partial<z.infer<typeof V.QuestionIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(question).where(eq(question.id, id));
  must(before, `otázka ${id}`);
  const [after] = await tx.update(question).set(inp).where(eq(question.id, id)).returning();
  await audit(tx, actor, "question", id, "update", before, after);
  return after;
}
export const listQuestions = () => db().select().from(question).orderBy(asc(question.id));

// ---------- příběhy ----------
export async function upsertStory(tx: Tx, actor: Actor, slug: string, inp: z.infer<typeof V.StoryIn>) {
  requireEdit(actor);
  checkSlug(slug);
  const row = { ...inp, slug, lead: inp.lead ?? null, lineSlug: inp.lineSlug ?? null, houseKey: inp.houseKey ?? null };
  const [before] = await tx.select().from(story).where(eq(story.slug, slug));
  const [after] = before
    ? await tx.update(story).set(row).where(eq(story.slug, slug)).returning()
    : await tx.insert(story).values({ ...row, createdBy: actor.name }).returning();
  await audit(tx, actor, "story", slug, before ? "update" : "create", before ?? null, after);
  return after;
}

export async function getStory(slug: string) {
  const [s] = await db().select().from(story).where(eq(story.slug, slug));
  if (!s) throw notFound(`příběh ${slug}`);
  return s;
}
export const listStories = () =>
  db()
    .select({ slug: story.slug, kind: story.kind, title: story.title, lead: story.lead, lineSlug: story.lineSlug, houseKey: story.houseKey, sort: story.sort, updatedAt: story.updatedAt })
    .from(story)
    .orderBy(asc(story.kind), asc(story.sort), asc(story.title));

export async function deleteStory(tx: Tx, actor: Actor, slug: string) {
  requireAdmin(actor);
  const [before] = await tx.select().from(story).where(eq(story.slug, slug));
  must(before, `příběh ${slug}`);
  await tx.delete(story).where(eq(story.slug, slug));
  await audit(tx, actor, "story", slug, "delete", before, null);
}

// ---------- dokumenty a mapy ----------
export async function addDocument(tx: Tx, actor: Actor, inp: z.infer<typeof V.DocumentIn>) {
  requireEdit(actor);
  const { personIds, houseKeys, ...rest } = inp;
  const [doc] = await tx
    .insert(document)
    .values({ ...rest, description: rest.description ?? null, groupName: rest.groupName ?? null, createdBy: actor.name })
    .returning();
  if (personIds.length) await tx.insert(documentPerson).values(personIds.map((personId) => ({ documentId: doc.id, personId })));
  if (houseKeys.length) await tx.insert(documentHouse).values(houseKeys.map((houseKey) => ({ documentId: doc.id, houseKey })));
  await audit(tx, actor, "document", doc.id, "create", null, { ...doc, personIds, houseKeys });
  return doc;
}

export async function addMapSheet(tx: Tx, actor: Actor, inp: z.infer<typeof V.MapSheetIn>) {
  requireEdit(actor);
  const [m] = await tx.insert(mapSheet).values({ ...inp, createdBy: actor.name }).returning();
  await audit(tx, actor, "map_sheet", m.id, "create", null, m);
  return m;
}

export async function listDocuments() {
  const d = db();
  const [docs, ps, hs] = await Promise.all([
    d.select().from(document).orderBy(asc(document.groupName), asc(document.sort)),
    d.select().from(documentPerson),
    d.select().from(documentHouse),
  ]);
  return docs.map((x) => ({
    ...x,
    personIds: ps.filter((p) => p.documentId === x.id).map((p) => p.personId),
    houseKeys: hs.filter((h) => h.documentId === x.id).map((h) => h.houseKey),
  }));
}
export const listMapSheets = () => db().select().from(mapSheet).orderBy(asc(mapSheet.year));

// ---------- nastavení ----------
export async function setSetting(tx: Tx, actor: Actor, key: string, value: unknown) {
  requireAdmin(actor);
  const [before] = await tx.select().from(setting).where(eq(setting.key, key));
  const [after] = await tx
    .insert(setting)
    .values({ key, value: value as object, createdBy: actor.name })
    .onConflictDoUpdate({ target: setting.key, set: { value: value as object } })
    .returning();
  await audit(tx, actor, "setting", key, before ? "update" : "create", before ?? null, after);
  return after;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await db().select().from(setting);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
