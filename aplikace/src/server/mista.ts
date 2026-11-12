// Místa (s historickými názvy), domy (čísla, držitelé, obyvatelé, události) a varianty příjmení.
import { and, asc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/db";
import {
  house,
  houseEvent,
  houseHolder,
  houseInhabitant,
  houseNumber,
  place,
  placeEvent,
  placeName,
  residence,
  surnameVariant,
} from "@/db/schema";
import { requireAdmin, requireEdit, type Actor } from "./actor";
import { audit } from "./audit";
import { badRequest, must, notFound } from "./errors";
import { firstYear, norm, slugify } from "./text";
import type { Tx } from "./tx";
import type * as V from "./vstupy";
import { HouseIn } from "./vstupy";

// ---------- místa ----------
export async function upsertPlace(tx: Tx, actor: Actor, slug: string, inp: z.infer<typeof V.PlaceIn>) {
  requireEdit(actor);
  if (slug !== slugify(slug)) throw badRequest(`Slug místa má být „${slugify(slug)}“.`);
  const { names, ...rest } = inp;
  const row = { ...rest, slug, search: norm(inp.name) };
  const [before] = await tx.select().from(place).where(eq(place.slug, slug));
  const [after] = before
    ? await tx.update(place).set(row).where(eq(place.slug, slug)).returning()
    : await tx.insert(place).values({ ...row, createdBy: actor.name }).returning();
  if (names) {
    await tx.delete(placeName).where(eq(placeName.placeSlug, slug));
    if (names.length) {
      await tx.insert(placeName).values(
        names.map((n) => ({ placeSlug: slug, name: n.name, lang: n.lang ?? null, note: n.note ?? null, search: norm(n.name), createdBy: actor.name })),
      );
    }
  }
  await audit(tx, actor, "place", slug, before ? "update" : "create", before ?? null, { ...after, names });
  return after;
}

// částečná úprava: chybějící pole zůstanou (PUT nahrazuje celý řádek)
export async function patchPlace(tx: Tx, actor: Actor, slug: string, patch: Partial<z.infer<typeof V.PlaceIn>>) {
  const [before] = await tx.select().from(place).where(eq(place.slug, slug));
  must(before, `místo ${slug}`);
  const { slug: _slug, search: _search, createdAt: _c, createdBy: _b, updatedAt: _u, ...cur } = before;
  void [_slug, _search, _c, _b, _u];
  return upsertPlace(tx, actor, slug, { ...cur, ...patch } as z.infer<typeof V.PlaceIn>);
}

export async function patchHouse(tx: Tx, actor: Actor, key: string, patch: Partial<z.infer<typeof V.HouseIn>>) {
  const [before] = await tx.select().from(house).where(eq(house.key, key));
  must(before, `dům ${key}`);
  const { key: _k, createdAt: _c, createdBy: _b, updatedAt: _u, ...cur } = before;
  void [_k, _c, _b, _u];
  return upsertHouse(tx, actor, key, { ...cur, ...patch } as z.infer<typeof V.HouseIn>);
}

export async function addPlaceName(tx: Tx, actor: Actor, slug: string, n: { name: string; lang?: string | null; note?: string | null }) {
  requireEdit(actor);
  const [p] = await tx.select({ s: place.slug }).from(place).where(eq(place.slug, slug));
  if (!p) throw notFound(`místo ${slug}`);
  const [r] = await tx
    .insert(placeName)
    .values({ placeSlug: slug, name: n.name, lang: n.lang ?? null, note: n.note ?? null, search: norm(n.name), createdBy: actor.name })
    .returning();
  await audit(tx, actor, "place_name", r.id, "create", null, r);
  return r;
}

export async function deletePlaceName(tx: Tx, actor: Actor, slug: string, id: number) {
  requireEdit(actor);
  const [before] = await tx.select().from(placeName).where(and(eq(placeName.id, id), eq(placeName.placeSlug, slug)));
  must(before, `název ${id} místa ${slug}`);
  await tx.delete(placeName).where(eq(placeName.id, id));
  await audit(tx, actor, "place_name", id, "delete", before, null);
}

export async function addPlaceEvent(tx: Tx, actor: Actor, slug: string, inp: z.infer<typeof V.PlaceEventIn>) {
  requireEdit(actor);
  const [r] = await tx
    .insert(placeEvent)
    .values({ placeSlug: slug, year: inp.year ?? null, text: inp.text, certainty: inp.certainty, recordKey: inp.recordKey ?? null, createdBy: actor.name })
    .returning();
  await audit(tx, actor, "place_event", r.id, "create", null, r);
  return r;
}

export async function listPlaces() {
  return db().select().from(place).orderBy(asc(place.name));
}

// hledání místa i podle starých a německých názvů
export async function searchPlaces(q: string, limit = 20) {
  const s = norm(q);
  if (!s) return [];
  const r = await db().execute<{ slug: string; name: string; matched: string; score: number }>(sql`
    select p.slug, p.name, m.name as matched, m.score from place p join (
      select slug as place_slug, name, similarity(search, ${s}) as score from place where search % ${s} or search like ${"%" + s + "%"}
      union all
      select place_slug, name, similarity(search, ${s}) from place_name where search % ${s} or search like ${"%" + s + "%"}
    ) m on m.place_slug = p.slug order by m.score desc limit ${limit}`);
  const seen = new Set<string>();
  return r.rows.filter((x) => !seen.has(x.slug) && seen.add(x.slug));
}

export async function getPlace(slug: string) {
  const d = db();
  const [p] = await d.select().from(place).where(eq(place.slug, slug));
  if (!p) throw notFound(`místo ${slug}`);
  const [names, events, houses] = await Promise.all([
    d.select().from(placeName).where(eq(placeName.placeSlug, slug)),
    d.select().from(placeEvent).where(eq(placeEvent.placeSlug, slug)).orderBy(asc(placeEvent.year)),
    d.select().from(house).where(eq(house.placeSlug, slug)).orderBy(asc(house.cp)),
  ]);
  return { ...p, names, events, houses };
}

export async function deletePlace(tx: Tx, actor: Actor, slug: string) {
  requireAdmin(actor);
  const [before] = await tx.select().from(place).where(eq(place.slug, slug));
  must(before, `místo ${slug}`);
  await tx.delete(place).where(eq(place.slug, slug));
  await audit(tx, actor, "place", slug, "delete", before, null);
}

// ---------- domy ----------
export const houseKeyOf = (placeSlug: string, cp: string) => `${placeSlug}-${slugify(cp)}`;

export async function upsertHouse(tx: Tx, actor: Actor, key: string | null, raw: z.input<typeof V.HouseIn>) {
  requireEdit(actor);
  const inp = HouseIn.parse(raw); // výchozí hodnoty i při volání z kódu (import, ukázka)
  const k = key ?? houseKeyOf(inp.placeSlug, inp.cp);
  const [pl] = await tx.select({ s: place.slug }).from(place).where(eq(place.slug, inp.placeSlug));
  if (!pl) throw badRequest(`Neznámé místo ${inp.placeSlug} – nejdřív PUT /mista/<slug>.`);
  const { numbers, events, holders, inhabitants, ...rest } = inp;
  const [before] = await tx.select().from(house).where(eq(house.key, k));
  // jistota bez výslovné hodnoty u existujícího domu zůstává (výchozí „unk“ jen u nového)
  const row = { ...rest, key: k, certainty: raw.certainty === undefined && before ? before.certainty : rest.certainty };
  const [after] = before
    ? await tx.update(house).set(row).where(eq(house.key, k)).returning()
    : await tx.insert(house).values({ ...row, createdBy: actor.name }).returning();
  const by = { createdBy: actor.name };
  if (numbers) {
    await tx.delete(houseNumber).where(eq(houseNumber.houseKey, k));
    if (numbers.length) await tx.insert(houseNumber).values(numbers.map((n) => ({ houseKey: k, ...n })));
  }
  if (events) {
    await tx.delete(houseEvent).where(eq(houseEvent.houseKey, k));
    if (events.length) await tx.insert(houseEvent).values(events.map((e) => ({ houseKey: k, ...e, year: e.year ?? null, ...by })));
  }
  if (holders) {
    await tx.delete(houseHolder).where(eq(houseHolder.houseKey, k));
    if (holders.length) {
      await tx.insert(houseHolder).values(holders.map((h) => ({ houseKey: k, ...h, yearFrom: firstYear(h.fromText), ...by })));
    }
  }
  if (inhabitants) {
    await tx.delete(houseInhabitant).where(eq(houseInhabitant.houseKey, k));
    if (inhabitants.length) await tx.insert(houseInhabitant).values(inhabitants.map((h) => ({ houseKey: k, ...h, ...by })));
  }
  await audit(tx, actor, "house", k, before ? "update" : "create", before ?? null, { ...after, numbers, events, holders, inhabitants });
  return after;
}

export async function getHouse(key: string) {
  const d = db();
  const [h] = await d.select().from(house).where(eq(house.key, key));
  if (!h) throw notFound(`dům ${key}`);
  const [numbers, events, holders, inhabitants, residents] = await Promise.all([
    d.select().from(houseNumber).where(eq(houseNumber.houseKey, key)),
    d.select().from(houseEvent).where(eq(houseEvent.houseKey, key)).orderBy(asc(houseEvent.year)),
    d.select().from(houseHolder).where(eq(houseHolder.houseKey, key)).orderBy(asc(houseHolder.yearFrom)),
    d.select().from(houseInhabitant).where(eq(houseInhabitant.houseKey, key)),
    d.select().from(residence).where(eq(residence.houseKey, key)),
  ]);
  return { ...h, numbers, events, holders, inhabitants, residents };
}

export async function listHouses() {
  return db().select().from(house).orderBy(asc(house.placeSlug), asc(house.cp));
}

// ---------- příjmení ----------
export async function addSurnameVariant(tx: Tx, actor: Actor, inp: z.infer<typeof V.SurnameVariantIn>) {
  requireEdit(actor);
  const [r] = await tx
    .insert(surnameVariant)
    .values({ ...inp, note: inp.note ?? null, search: norm(inp.surname, inp.variant), createdBy: actor.name })
    .onConflictDoNothing()
    .returning();
  if (r) await audit(tx, actor, "surname_variant", r.id, "create", null, r);
  return r ?? null;
}

export async function listSurnameVariants(q?: string) {
  const s = q ? norm(q) : "";
  return db()
    .select()
    .from(surnameVariant)
    .where(s ? sql`${surnameVariant.search} like ${"%" + s + "%"} or ${surnameVariant.search} % ${s}` : undefined)
    .orderBy(asc(surnameVariant.surname));
}
