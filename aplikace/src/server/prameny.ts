// Svazky, zápisy (s přepisem a osobami v rolích), zvýraznění a obrázky výřezů.
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import { citation, highlight, media, person, personName, record, recordPerson, volume } from "@/db/schema";
import { requireAdmin, requireEdit, type Actor } from "./actor";
import { audit } from "./audit";
import { badRequest, must, notFound } from "./errors";
import { firstYear, norm } from "./text";
import type { Tx } from "./tx";
import type * as V from "./vstupy";

// ---------- svazky ----------
export async function upsertVolume(tx: Tx, actor: Actor, key: string, inp: z.input<typeof V.VolumeIn>) {
  requireEdit(actor);
  const [before] = await tx.select().from(volume).where(eq(volume.key, key));
  const row = { key, ...inp, portal: inp.portal ?? null, description: inp.description ?? null, url: inp.url ?? null, meta: inp.meta ?? {} };
  const [after] = before
    ? await tx.update(volume).set(row).where(eq(volume.key, key)).returning()
    : await tx.insert(volume).values({ ...row, createdBy: actor.name }).returning();
  await audit(tx, actor, "volume", key, before ? "update" : "create", before ?? null, after);
  return after;
}

// ?misto=&druh=&rok= (rok uvnitř rozsahu svazku) – např. sčítací operát obce pro daný rok
export async function listVolumes(opts: { placeSlug?: string; kind?: string; year?: number } = {}) {
  const conds = [];
  if (opts.placeSlug) conds.push(eq(volume.placeSlug, opts.placeSlug));
  if (opts.kind) conds.push(eq(volume.kind, opts.kind));
  if (opts.year) conds.push(sql`${volume.yearFrom} <= ${opts.year} and coalesce(${volume.yearTo}, ${volume.yearFrom}) >= ${opts.year}`);
  return db()
    .select()
    .from(volume)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(volume.key));
}

export async function getVolume(key: string) {
  const [v] = await db().select().from(volume).where(eq(volume.key, key));
  if (!v) throw notFound(`svazek ${key}`);
  const recs = await db()
    .select({ key: record.key, imageNo: record.imageNo, kind: record.kind, title: record.title, dateText: record.dateText })
    .from(record)
    .where(eq(record.volumeKey, key))
    .orderBy(asc(record.imageNo));
  return { ...v, records: recs };
}

// ---------- zápisy ----------
const recordSearch = (r: { title: string; summary?: string | null; transcriptOrig?: string | null; transcriptCs?: string | null; dateText?: string | null }) =>
  norm(r.title, r.dateText, r.summary, r.transcriptCs, r.transcriptOrig);

export async function upsertRecord(tx: Tx, actor: Actor, key: string, inp: z.infer<typeof V.RecordIn>) {
  requireEdit(actor);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) throw badRequest("Klíč zápisu: malá písmena bez diakritiky, číslice a pomlčky.");
  if (inp.volumeKey) {
    const [v] = await tx.select({ k: volume.key }).from(volume).where(eq(volume.key, inp.volumeKey));
    if (!v) throw badRequest(`Neznámý svazek ${inp.volumeKey} – nejdřív PUT /svazky/<klic>.`);
  }
  const { persons, ...rest } = inp;
  const row = {
    ...rest,
    key,
    year: inp.year ?? firstYear(inp.dateText),
    search: recordSearch(inp),
  };
  const [before] = await tx.select().from(record).where(eq(record.key, key));
  const [after] = before
    ? await tx.update(record).set(row).where(eq(record.key, key)).returning()
    : await tx.insert(record).values({ ...row, createdBy: actor.name }).returning();
  if (persons) {
    const ids = [...new Set(persons.map((p) => p.personId))];
    const known = ids.length ? await tx.select({ id: person.id }).from(person).where(inArray(person.id, ids)) : [];
    const missing = ids.filter((i) => !known.some((k) => k.id === i));
    if (missing.length) throw badRequest(`Neznámé osoby: ${missing.join(", ")}`);
    await tx.delete(recordPerson).where(eq(recordPerson.recordKey, key));
    if (persons.length) {
      await tx
        .insert(recordPerson)
        .values(persons.map((p) => ({ recordKey: key, personId: p.personId, role: p.role, nameAsWritten: p.nameAsWritten ?? null })))
        .onConflictDoNothing();
    }
  }
  await audit(tx, actor, "record", key, before ? "update" : "create", before ?? null, { ...after, persons });
  return after;
}

export async function patchRecord(tx: Tx, actor: Actor, key: string, patch: Partial<z.infer<typeof V.RecordIn>>) {
  const [before] = await tx.select().from(record).where(eq(record.key, key));
  must(before, `zápis ${key}`);
  const { persons, ...rest } = patch;
  const merged = { ...before, ...rest };
  return upsertRecord(tx, actor, key, { ...merged, ...(persons ? { persons } : {}) } as z.infer<typeof V.RecordIn>);
}

export async function deleteRecord(tx: Tx, actor: Actor, key: string) {
  requireAdmin(actor);
  const [before] = await tx.select().from(record).where(eq(record.key, key));
  must(before, `zápis ${key}`);
  await tx.delete(record).where(eq(record.key, key));
  await audit(tx, actor, "record", key, "delete", before, null);
}

export async function getRecord(key: string) {
  const d = db();
  const [r] = await d.select().from(record).where(eq(record.key, key));
  if (!r) throw notFound(`zápis ${key}`);
  const [vol, people, hl, imgs, cites] = await Promise.all([
    r.volumeKey ? d.select().from(volume).where(eq(volume.key, r.volumeKey)) : [],
    d
      .select({ personId: recordPerson.personId, role: recordPerson.role, nameAsWritten: recordPerson.nameAsWritten, given: personName.given, surname: personName.surname })
      .from(recordPerson)
      .leftJoin(personName, and(eq(personName.personId, recordPerson.personId), eq(personName.isPrimary, true)))
      .where(eq(recordPerson.recordKey, key)),
    d.select().from(highlight).where(eq(highlight.recordKey, key)),
    d
      .select({ sha256: media.sha256, variant: media.variant, width: media.width, height: media.height, mime: media.mime })
      .from(media)
      .where(eq(media.recordKey, key)),
    d.select().from(citation).where(eq(citation.recordKey, key)),
  ]);
  return { ...r, volume: vol[0] ?? null, persons: people, highlight: hl[0] ?? null, images: imgs, citations: cites };
}

export async function listRecords(opts: { q?: string; volumeKey?: string; review?: string; personId?: string; limit?: number }) {
  const d = db();
  const conds = [];
  if (opts.volumeKey) conds.push(eq(record.volumeKey, opts.volumeKey));
  if (opts.review) conds.push(sql`${record.review} = ${opts.review}`);
  if (opts.personId) conds.push(sql`${record.key} in (select record_key from record_person where person_id = ${opts.personId})`);
  const s = opts.q ? norm(opts.q) : "";
  if (s) conds.push(sql`(${record.search} like ${"%" + s + "%"} or ${record.search} % ${s})`);
  return d
    .select({
      key: record.key,
      volumeKey: record.volumeKey,
      imageNo: record.imageNo,
      kind: record.kind,
      dateText: record.dateText,
      year: record.year,
      title: record.title,
      summary: record.summary,
      review: record.review,
    })
    .from(record)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(s ? sql`similarity(${record.search}, ${s}) desc` : desc(record.updatedAt))
    .limit(Math.min(opts.limit ?? 100, 500));
}

// ---------- zvýraznění ----------
export async function setHighlight(tx: Tx, actor: Actor, key: string, inp: z.infer<typeof V.HighlightIn>) {
  requireEdit(actor);
  const [r] = await tx.select({ k: record.key }).from(record).where(eq(record.key, key));
  if (!r) throw notFound(`zápis ${key}`);
  const row = { recordKey: key, boxes: inp.boxes, status: inp.status ?? null, note: inp.note ?? null };
  const [before] = await tx.select().from(highlight).where(eq(highlight.recordKey, key));
  const [after] = await tx
    .insert(highlight)
    .values({ ...row, createdBy: actor.name })
    .onConflictDoUpdate({ target: highlight.recordKey, set: row })
    .returning();
  await audit(tx, actor, "highlight", key, before ? "update" : "create", before ?? null, after);
  return after;
}

// ---------- obrázky ----------
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel bere tělo požadavku do 4,5 MB

function imageSize(buf: Buffer, mime: string): { width: number | null; height: number | null } {
  try {
    if (mime === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) break;
        const m = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
    if (mime === "image/webp" && buf.toString("ascii", 12, 16) === "VP8X") {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
  } catch {}
  return { width: null, height: null };
}

export function sniffMime(buf: Buffer, hint?: string | null): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (hint && MIME[hint]) return MIME[hint];
  throw badRequest("Podporované jsou jen obrázky JPEG, PNG a WebP.");
}

export async function saveMedia(
  tx: Tx,
  actor: Actor,
  buf: Buffer,
  link: { recordKey?: string; documentId?: number; mapId?: number; variant?: "web" | "plny" },
) {
  requireEdit(actor);
  if (!buf.length) throw badRequest("Prázdný soubor.");
  if (buf.length > MAX_BYTES) throw badRequest(`Obrázek je větší než ${MAX_BYTES / 1024 / 1024} MB – zmenšete ho (vyrez.py dělá max 1800 px).`);
  const mime = sniffMime(buf);
  let sha256 = createHash("sha256").update(buf).digest("hex");
  const variant = link.variant ?? "web";
  if (link.recordKey) {
    const [r] = await tx.select({ k: record.key }).from(record).where(eq(record.key, link.recordKey));
    if (!r) throw notFound(`zápis ${link.recordKey}`);
  }
  // výřez zápisu má od každé varianty jen jeden obrázek: starý nahradit
  if (link.recordKey) {
    await tx.delete(media).where(and(eq(media.recordKey, link.recordKey), eq(media.variant, variant)));
  }
  // týž obrázek u jiného zápisu / dokumentu (dva zápisy na jednom výřezu): vlastní id, ať ho druhý nahrání nepřebere
  const owner = { recordKey: link.recordKey ?? null, documentId: link.documentId ?? null, mapId: link.mapId ?? null };
  const [same] = await tx.select({ recordKey: media.recordKey, documentId: media.documentId, mapId: media.mapId, variant: media.variant }).from(media).where(eq(media.sha256, sha256));
  if (same && (same.recordKey !== owner.recordKey || same.documentId !== owner.documentId || same.mapId !== owner.mapId || same.variant !== variant)) {
    sha256 = createHash("sha256").update(buf).update(JSON.stringify({ ...owner, variant })).digest("hex");
  }
  const { width, height } = imageSize(buf, mime);
  const row = {
    sha256,
    mime,
    width,
    height,
    size: buf.length,
    variant,
    recordKey: link.recordKey ?? null,
    documentId: link.documentId ?? null,
    mapId: link.mapId ?? null,
    bytes: buf,
    createdBy: actor.name,
  };
  await tx.insert(media).values(row).onConflictDoUpdate({ target: media.sha256, set: { ...row, bytes: buf } });
  await audit(tx, actor, "media", sha256, "create", null, { ...row, bytes: undefined });
  return { sha256, mime, width, height, size: buf.length, variant, url: `/media/${sha256}` };
}

export async function getMedia(sha: string) {
  if (!/^[a-f0-9]{64}$/.test(sha)) return null;
  const [m] = await db().select({ mime: media.mime, bytes: media.bytes }).from(media).where(eq(media.sha256, sha));
  return m ?? null;
}
