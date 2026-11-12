// Fronta vodítek (údaje od rodiny, zvěsti), deník bádání a úkoly.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  person,
  personName,
  researchLog,
  researchLogPerson,
  researchLogRecord,
  researchLogTip,
  task,
  taskPerson,
  tip,
  tipPerson,
  tipRecord,
  userAccount,
} from "@/db/schema";
import { canEdit, requireEdit, seesPrivate, type Actor } from "./actor";
import { audit } from "./audit";
import { badRequest, forbidden, must, notFound } from "./errors";
import { norm } from "./text";
import type { Tx } from "./tx";
import type * as V from "./vstupy";

async function assertPersons(tx: Tx, ids: string[]) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return;
  const rows = await tx.select({ id: person.id }).from(person).where(inArray(person.id, uniq));
  const missing = uniq.filter((i) => !rows.some((r) => r.id === i));
  if (missing.length) throw badRequest(`Neznámé osoby: ${missing.join(", ")}`);
}

// ---------- vodítka ----------
// kdokoli přihlášený může poslat údaj od rodiny nebo zvěst; uloží se jako nezpracované
export async function addTip(tx: Tx, actor: Actor, inp: z.infer<typeof V.TipIn>) {
  await assertPersons(tx, [...inp.personIds, ...(inp.toldByPersonId ? [inp.toldByPersonId] : [])]);
  // člen rodiny posílá sám za sebe
  const toldBy = canEdit(actor) ? inp.toldByPersonId ?? null : inp.toldByPersonId ?? actor.personId ?? null;
  const [t] = await tx
    .insert(tip)
    .values({
      kind: inp.kind,
      text: inp.text,
      toldByPersonId: toldBy,
      toldByName: inp.toldByName ?? null,
      channel: inp.channel ?? null,
      receivedAt: inp.receivedAt ?? new Date(),
      sensitive: inp.sensitive,
      submittedByUserId: actor.userId ?? null,
      search: norm(inp.text, inp.toldByName),
      createdBy: actor.name,
    })
    .returning();
  if (inp.personIds.length) await tx.insert(tipPerson).values(inp.personIds.map((personId) => ({ tipId: t.id, personId })));
  await audit(tx, actor, "tip", t.id, "create", null, { ...t, personIds: inp.personIds });
  return t;
}

export async function updateTip(tx: Tx, actor: Actor, id: number, inp: z.infer<typeof V.TipPatch>) {
  requireEdit(actor);
  const [before] = await tx.select().from(tip).where(eq(tip.id, id));
  must(before, `vodítko ${id}`);
  const { personIds, recordKeys, ...rest } = inp;
  const done = rest.status && !["nezpracovano", "overuje_se"].includes(rest.status);
  // updatedAt vždy: při úpravě jen osob nebo zápisů by SET byl prázdný
  const [after] = await tx
    .update(tip)
    .set({
      ...rest,
      ...(rest.text ? { search: norm(rest.text, before.toldByName) } : {}),
      ...(rest.status ? { resolvedAt: done ? new Date() : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tip.id, id))
    .returning();
  if (personIds) {
    await assertPersons(tx, personIds);
    await tx.delete(tipPerson).where(eq(tipPerson.tipId, id));
    if (personIds.length) await tx.insert(tipPerson).values(personIds.map((personId) => ({ tipId: id, personId })));
  }
  if (recordKeys?.length) {
    await tx.insert(tipRecord).values(recordKeys.map((recordKey) => ({ tipId: id, recordKey }))).onConflictDoNothing();
  }
  await audit(tx, actor, "tip", id, "update", before, { ...after, personIds, recordKeys });
  return after;
}

// člen vidí jen svá vodítka; citlivá vidí jen admin a agent
export async function listTips(actor: Actor, opts: { status?: string; personId?: string; personIds?: string[]; open?: boolean; q?: string; limit?: number }) {
  const conds = [];
  if (!seesPrivate(actor)) {
    if (!actor.userId) throw forbidden();
    conds.push(eq(tip.submittedByUserId, actor.userId));
  }
  if (opts.open) conds.push(inArray(tip.status, ["nezpracovano", "overuje_se"]));
  else if (opts.status) conds.push(sql`${tip.status} = ${opts.status}`);
  if (opts.personId) conds.push(sql`${tip.id} in (select tip_id from tip_person where person_id = ${opts.personId})`);
  if (opts.personIds) conds.push(inArray(tip.id, db().select({ id: tipPerson.tipId }).from(tipPerson).where(inArray(tipPerson.personId, ["", ...opts.personIds]))));
  const s = opts.q ? norm(opts.q) : "";
  if (s) conds.push(sql`(${tip.search} like ${"%" + s + "%"} or ${tip.search} % ${s})`);
  const d = db();
  const rows = await d
    .select({ t: tip, submittedBy: userAccount.username })
    .from(tip)
    .leftJoin(userAccount, eq(userAccount.id, tip.submittedByUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(tip.receivedAt))
    .limit(Math.min(opts.limit ?? 200, 1000));
  const ids = rows.map((r) => r.t.id);
  const [ps, rs] = ids.length
    ? await Promise.all([
        d
          .select({ tipId: tipPerson.tipId, personId: tipPerson.personId, given: personName.given, surname: personName.surname })
          .from(tipPerson)
          .leftJoin(personName, and(eq(personName.personId, tipPerson.personId), eq(personName.isPrimary, true)))
          .where(inArray(tipPerson.tipId, ids)),
        d.select().from(tipRecord).where(inArray(tipRecord.tipId, ids)),
      ])
    : [[], []];
  return rows.map(({ t, submittedBy }) => ({
    ...t,
    submittedBy,
    persons: ps.filter((p) => p.tipId === t.id).map(({ personId, given, surname }) => ({ personId, name: `${given ?? ""} ${surname ?? ""}`.trim() })),
    recordKeys: rs.filter((r) => r.tipId === t.id).map((r) => r.recordKey),
  }));
}

export async function getTip(actor: Actor, id: number) {
  const all = await listTips(seesPrivate(actor) ? actor : actor, { limit: 1000 });
  const t = all.find((x) => x.id === id);
  if (!t) throw notFound(`vodítko ${id}`);
  return t;
}

// ---------- deník ----------
export async function addLog(tx: Tx, actor: Actor, inp: z.infer<typeof V.LogIn>) {
  requireEdit(actor);
  await assertPersons(tx, inp.personIds);
  const [l] = await tx
    .insert(researchLog)
    .values({
      at: inp.at ?? new Date(),
      author: inp.author ?? actor.name,
      title: inp.title,
      textMd: inp.textMd,
      volumeKey: inp.volumeKey ?? null,
      pages: inp.pages ?? null,
      result: inp.result,
      search: norm(inp.title, inp.textMd),
      createdBy: actor.name,
    })
    .returning();
  if (inp.personIds.length) await tx.insert(researchLogPerson).values(inp.personIds.map((personId) => ({ logId: l.id, personId })));
  if (inp.recordKeys.length) await tx.insert(researchLogRecord).values(inp.recordKeys.map((recordKey) => ({ logId: l.id, recordKey })));
  if (inp.tipIds.length) await tx.insert(researchLogTip).values(inp.tipIds.map((tipId) => ({ logId: l.id, tipId })));
  await audit(tx, actor, "research_log", l.id, "create", null, { ...l, personIds: inp.personIds, recordKeys: inp.recordKeys, tipIds: inp.tipIds });
  return l;
}

// úprava záznamu deníku; uvedené seznamy (osoby, zápisy, vodítka) se nahradí
export async function updateLog(tx: Tx, actor: Actor, id: number, inp: Partial<z.infer<typeof V.LogIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(researchLog).where(eq(researchLog.id, id));
  must(before, `záznam deníku ${id}`);
  const { personIds, recordKeys, tipIds, at, ...rest } = inp;
  const title = rest.title ?? before.title;
  const textMd = rest.textMd ?? before.textMd;
  const [after] = await tx
    .update(researchLog)
    .set({ ...rest, ...(at ? { at } : {}), search: norm(title, textMd) })
    .where(eq(researchLog.id, id))
    .returning();
  if (personIds) {
    await assertPersons(tx, personIds);
    await tx.delete(researchLogPerson).where(eq(researchLogPerson.logId, id));
    if (personIds.length) await tx.insert(researchLogPerson).values(personIds.map((personId) => ({ logId: id, personId })));
  }
  if (recordKeys) {
    await tx.delete(researchLogRecord).where(eq(researchLogRecord.logId, id));
    if (recordKeys.length) await tx.insert(researchLogRecord).values(recordKeys.map((recordKey) => ({ logId: id, recordKey })));
  }
  if (tipIds) {
    await tx.delete(researchLogTip).where(eq(researchLogTip.logId, id));
    if (tipIds.length) await tx.insert(researchLogTip).values(tipIds.map((tipId) => ({ logId: id, tipId })));
  }
  await audit(tx, actor, "research_log", id, "update", before, { ...after, personIds, recordKeys, tipIds });
  return { ...after, search: undefined };
}

export async function listLog(opts: { q?: string; personId?: string; personIds?: string[]; volumeKey?: string; result?: string; limit?: number }) {
  const conds = [];
  if (opts.volumeKey) conds.push(eq(researchLog.volumeKey, opts.volumeKey));
  if (opts.result) conds.push(sql`${researchLog.result} = ${opts.result}`);
  if (opts.personId) conds.push(sql`${researchLog.id} in (select log_id from research_log_person where person_id = ${opts.personId})`);
  if (opts.personIds) conds.push(inArray(researchLog.id, db().select({ id: researchLogPerson.logId }).from(researchLogPerson).where(inArray(researchLogPerson.personId, ["", ...opts.personIds]))));
  const s = opts.q ? norm(opts.q) : "";
  if (s) conds.push(sql`(${researchLog.search} like ${"%" + s + "%"} or ${researchLog.search} % ${s})`);
  const d = db();
  const rows = await d
    .select()
    .from(researchLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(researchLog.at))
    .limit(Math.min(opts.limit ?? 50, 1000));
  const ids = rows.map((r) => r.id);
  const [ps, rs, ts] = ids.length
    ? await Promise.all([
        d.select().from(researchLogPerson).where(inArray(researchLogPerson.logId, ids)),
        d.select().from(researchLogRecord).where(inArray(researchLogRecord.logId, ids)),
        d.select().from(researchLogTip).where(inArray(researchLogTip.logId, ids)),
      ])
    : [[], [], []];
  return rows.map((l) => ({
    ...l,
    search: undefined, // jen pro index hledání
    personIds: ps.filter((p) => p.logId === l.id).map((p) => p.personId),
    recordKeys: rs.filter((r) => r.logId === l.id).map((r) => r.recordKey),
    tipIds: ts.filter((t) => t.logId === l.id).map((t) => t.tipId),
  }));
}

// ---------- úkoly ----------
export async function addTask(tx: Tx, actor: Actor, inp: z.infer<typeof V.TaskIn>) {
  requireEdit(actor);
  await assertPersons(tx, inp.personIds);
  const { personIds, ...rest } = inp;
  const [t] = await tx.insert(task).values({ ...rest, createdBy: actor.name }).returning();
  if (personIds.length) await tx.insert(taskPerson).values(personIds.map((personId) => ({ taskId: t.id, personId })));
  await audit(tx, actor, "task", t.id, "create", null, { ...t, personIds });
  return t;
}

export async function updateTask(tx: Tx, actor: Actor, id: number, inp: Partial<z.infer<typeof V.TaskIn>>) {
  requireEdit(actor);
  const [before] = await tx.select().from(task).where(eq(task.id, id));
  must(before, `úkol ${id}`);
  const { personIds, ...rest } = inp;
  const [after] = await tx.update(task).set(rest).where(eq(task.id, id)).returning();
  if (personIds) {
    await assertPersons(tx, personIds);
    await tx.delete(taskPerson).where(eq(taskPerson.taskId, id));
    if (personIds.length) await tx.insert(taskPerson).values(personIds.map((personId) => ({ taskId: id, personId })));
  }
  await audit(tx, actor, "task", id, "update", before, { ...after, personIds });
  return after;
}

export async function listTasks(opts: { status?: string; all?: boolean; personIds?: string[] }) {
  const d = db();
  const conds = [
    opts.status ? sql`${task.status} = ${opts.status}` : opts.all ? undefined : inArray(task.status, ["otevreny", "rozpracovany", "ceka"]),
    opts.personIds ? inArray(task.id, d.select({ id: taskPerson.taskId }).from(taskPerson).where(inArray(taskPerson.personId, ["", ...opts.personIds]))) : undefined,
  ].filter(Boolean);
  const rows = await d.select().from(task).where(conds.length ? and(...conds) : undefined).orderBy(asc(task.priority), desc(task.updatedAt));
  const ids = rows.map((r) => r.id);
  const ps = ids.length ? await d.select().from(taskPerson).where(inArray(taskPerson.taskId, ids)) : [];
  return rows.map((t) => ({ ...t, personIds: ps.filter((p) => p.taskId === t.id).map((p) => p.personId) }));
}
