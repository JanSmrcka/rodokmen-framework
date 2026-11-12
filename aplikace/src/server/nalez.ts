// Nález z matriky jednou transakcí: svazek → zápis (+ přepis, osoby v rolích) → nové osoby → vztahy,
// události a bydliště s citací zápisu → vyřízení vodítek → záznam do deníku. Buď vše, nebo nic.
import type { z } from "zod";
import { requireEdit, type Actor } from "./actor";
import { addLog, updateTip } from "./fronta";
import { addEvent, addRelation, addResidence, createPerson, linkRecordPerson } from "./osoby";
import { upsertRecord, upsertVolume } from "./prameny";
import type { Tx } from "./tx";
import type * as V from "./vstupy";

const SIDE_ROLES = new Set(["kmotr", "kmotra", "svedek", "svedkyne", "porodni_baba", "oddavajici", "zminen"]);

export async function saveFinding(tx: Tx, actor: Actor, inp: z.infer<typeof V.FindingIn>) {
  requireEdit(actor);
  const { key, persons, ...rec } = inp.record;
  const src = { recordKey: key };
  if (inp.volume) {
    const { key: vk, ...v } = inp.volume;
    await upsertVolume(tx, actor, vk, v);
  }
  // osoby zápisu se doplní až po založení nových osob
  await upsertRecord(tx, actor, key, rec);
  const created: string[] = [];
  for (const p of inp.people) {
    const { id } = await createPerson(tx, actor, {
      ...p,
      sources: p.sources.length ? p.sources : [src],
      events: p.events.map((e) => ({ ...e, sources: e.sources.length ? e.sources : [src] })),
    });
    created.push(id);
  }
  for (const p of persons ?? []) await linkRecordPerson(tx, key, p.personId, p.role, p.nameAsWritten);
  // bez výslovného zdroje se jako zdroj bere tento zápis
  const relations = [];
  for (const r of inp.relations) relations.push((await addRelation(tx, actor, { ...r, sources: r.sources.length ? r.sources : [src] })).id);
  const events = [];
  for (const e of inp.events) events.push((await addEvent(tx, actor, { ...e, sources: e.sources.length ? e.sources : [src] })).id);
  const residences = [];
  for (const r of inp.residences) residences.push((await addResidence(tx, actor, { ...r, sources: r.sources.length ? r.sources : [src] })).id);
  for (const t of inp.tips) await updateTip(tx, actor, t.id, { status: t.status, recordKeys: [key] });
  let logId: number | null = null;
  if (inp.log) {
    // deník: nové osoby a osoby zápisu v hlavních rolích (kmotři, svědci… jsou často z cizích rodů)
    const main = (persons ?? []).filter((p) => !SIDE_ROLES.has(p.role)).map((p) => p.personId);
    const personIds = [...new Set([...(inp.log.personIds ?? []), ...created, ...main])];
    const l = await addLog(tx, actor, {
      title: inp.log.title ?? inp.record.title,
      textMd: inp.log.textMd ?? "",
      at: inp.log.at,
      author: inp.log.author,
      volumeKey: inp.log.volumeKey ?? inp.record.volumeKey ?? inp.volume?.key,
      pages: inp.log.pages ?? (inp.record.imageNo ? `snímek ${inp.record.imageNo}` : null),
      result: inp.log.result ?? "nalezeno",
      personIds,
      recordKeys: [...new Set([...(inp.log.recordKeys ?? []), key])],
      tipIds: [...new Set([...(inp.log.tipIds ?? []), ...inp.tips.map((t) => t.id)])],
    });
    logId = l.id;
  }
  return { recordKey: key, people: created, relations, events, residences, logId };
}
