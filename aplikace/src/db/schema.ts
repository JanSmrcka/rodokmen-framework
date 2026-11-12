// Databázové schéma rodokmenu (Drizzle, PostgreSQL). Migrace: npm run db:generate → drizzle/*.sql.
// Klíče, které jsou v URL (osoba, zápis, svazek, místo, dům, rod, příběh), zůstávají textové slugy.
// Sloupce `search` drží text bez diakritiky a malými písmeny (lib/text.ts → norm); hledá se trigramy (pg_trgm).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  doublePrecision,
  type AnyPgColumn,
  type ExtraConfigColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const created = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: text("created_by"),
});
const stamps = () => ({
  ...created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
const trgm = (name: string, col: ExtraConfigColumn) => index(name).using("gin", col.op("gin_trgm_ops"));

// ---------- číselníky ----------
// doc = doloženo matrikou, prob = pravděpodobné, fam = od rodiny, mh = cizí rodokmen, unk = neznámé, lit = literatura
export const certainty = pgEnum("certainty", ["doc", "prob", "fam", "mh", "unk", "lit"]);
export const sex = pgEnum("sex", ["M", "F", "U"]);
export const relationType = pgEnum("relation_type", ["rodic", "manzele"]);
export const eventType = pgEnum("event_type", [
  "narozeni", "krest", "snatek", "umrti", "pohreb", "povolani", "sluzba", "jine",
]);
export const dateQual = pgEnum("date_qual", ["presne", "asi", "pred", "po", "mezi"]);
export const nameKind = pgEnum("name_kind", ["rodne", "po_snatku", "varianta", "v_zapisu"]);
// N narození, O oddaní, Z zemřelí, I index, S sčítání, G gruntovní kniha, K katastr, M mapa, C cizí, L literatura, J jiné
export const recordKind = pgEnum("record_kind", ["N", "O", "Z", "I", "S", "G", "K", "M", "C", "L", "J"]);
export const review = pgEnum("review", ["rozpracovano", "ke_kontrole", "overeno"]);
export const mediaVariant = pgEnum("media_variant", ["web", "plny"]);
export const storyKind = pgEnum("story_kind", ["pribeh", "pribeh_rodu", "pribeh_domu", "zajimavosti", "jine"]);
export const questionState = pgEnum("question_state", ["otevrene", "hypoteza", "vyreseno"]);
export const tipKind = pgEnum("tip_kind", ["od_rodiny", "zvest", "oprava", "napad"]);
export const tipStatus = pgEnum("tip_status", ["nezpracovano", "overuje_se", "potvrzeno", "vyvraceno", "nelze_overit", "rozdeleno"]);
export const researchResult = pgEnum("research_result", ["nalezeno", "nenalezeno", "castecne", "jine"]);
export const taskStatus = pgEnum("task_status", ["otevreny", "rozpracovany", "ceka", "hotovy", "zruseny"]);
export const userRole = pgEnum("user_role", ["admin", "member"]);
export const tokenRole = pgEnum("token_role", ["admin", "agent"]);

// ---------- osoby a graf ----------
export const person = pgTable(
  "person",
  {
    id: text("id").primaryKey(), // slug jmeno-prijmeni-rok, nikdy se nemění
    sex: sex("sex").notNull().default("U"),
    certainty: certainty("certainty").notNull().default("unk"),
    living: boolean("living"), // null = automaticky (bez úmrtí a narozen před < 110 lety)
    yearsText: text("years_text"), // „asi 1720–1785“ pro přehledy
    note: text("note"),
    notePrivate: text("note_private"), // jen admin
    sameAsId: text("same_as_id").references((): AnyPgColumn => person.id, { onDelete: "set null" }), // dřív `tataz`
    placeholder: boolean("placeholder").notNull().default(false), // „otec neuveden“
    ...stamps(),
  },
  (t) => [index("person_same_as_idx").on(t.sameAsId)],
);

export const personName = pgTable(
  "person_name",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
    given: text("given").notNull().default(""),
    surname: text("surname").notNull().default(""),
    kind: nameKind("kind").notNull().default("rodne"),
    isPrimary: boolean("is_primary").notNull().default(false),
    certainty: certainty("certainty").notNull().default("unk"),
    note: text("note"),
    search: text("search").notNull().default(""),
    ...created(),
  },
  (t) => [
    index("person_name_person_idx").on(t.personId),
    uniqueIndex("person_name_primary_uq").on(t.personId).where(sql`${t.isPrimary}`),
    trgm("person_name_search_trgm", t.search),
  ],
);

export const relation = pgTable(
  "relation",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: relationType("type").notNull(),
    aId: text("a_id").notNull().references(() => person.id, { onDelete: "cascade" }), // rodič / manžel 1
    bId: text("b_id").notNull().references(() => person.id, { onDelete: "cascade" }), // dítě / manžel 2
    certainty: certainty("certainty").notNull().default("unk"),
    note: text("note"),
    ...stamps(),
  },
  (t) => [
    uniqueIndex("relation_uq").on(t.type, t.aId, t.bId),
    index("relation_type_b_idx").on(t.type, t.bId),
    index("relation_b_idx").on(t.bId),
    check("relation_not_self", sql`${t.aId} <> ${t.bId}`),
  ],
);

// souhrnné texty o bočních příbuzných (dřív druh="bocni")
export const sideNote = pgTable(
  "side_note",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    text: text("text").notNull().default(""),
    ...stamps(),
  },
  (t) => [index("side_note_person_idx").on(t.personId)],
);

// ---------- místa a domy ----------
export const place = pgTable(
  "place",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind"), // obec, část obce, farnost, okres…
    parentSlug: text("parent_slug").references((): AnyPgColumn => place.slug, { onDelete: "set null" }),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    osm: text("osm"),
    query: text("query"), // dotaz pro geokódování
    pattern: text("pattern"), // regex pro rozpoznání ve faktech (dřív `re`)
    hypothesis: boolean("hypothesis").notNull().default(false),
    description: text("description"),
    parish: text("parish"), // farnost (pro hledání matrik)
    estate: text("estate"), // panství
    district: text("district"), // okres
    modernName: text("modern_name"), // dnešní obec / část obce
    search: text("search").notNull().default(""),
    ...stamps(),
  },
  (t) => [index("place_parent_idx").on(t.parentSlug), trgm("place_search_trgm", t.search)],
);

// historické, německé a zkomolené názvy (dřív mista_nazvy.json)
export const placeName = pgTable(
  "place_name",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    placeSlug: text("place_slug").notNull().references(() => place.slug, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lang: text("lang"), // cs, de, la
    note: text("note"),
    search: text("search").notNull().default(""),
    ...created(),
  },
  (t) => [index("place_name_place_idx").on(t.placeSlug), trgm("place_name_search_trgm", t.search)],
);

// události obce (dřív OBEC_UDALOSTI)
export const placeEvent = pgTable(
  "place_event",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    placeSlug: text("place_slug").notNull().references(() => place.slug, { onDelete: "cascade" }),
    year: smallint("year"),
    text: text("text").notNull(),
    certainty: certainty("certainty").notNull().default("unk"),
    recordKey: text("record_key").references((): AnyPgColumn => record.key, { onDelete: "set null" }),
    ...stamps(),
  },
  (t) => [index("place_event_place_idx").on(t.placeSlug, t.year), index("place_event_record_idx").on(t.recordKey)],
);

// varianty příjmení (dřív prijmeni_varianty.json)
export const surnameVariant = pgTable(
  "surname_variant",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    surname: text("surname").notNull(), // dnešní tvar
    variant: text("variant").notNull(),
    note: text("note"),
    search: text("search").notNull().default(""),
    ...created(),
  },
  (t) => [uniqueIndex("surname_variant_uq").on(t.surname, t.variant), trgm("surname_variant_search_trgm", t.search)],
);

export const house = pgTable(
  "house",
  {
    key: text("key").primaryKey(), // „<obec-slug>-<čp>“
    placeSlug: text("place_slug").notNull().references(() => place.slug),
    cp: text("cp").notNull(),
    name: text("name"),
    kind: text("kind"), // chalupa, statek, domek…
    description: text("description"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    certainty: certainty("certainty").notNull().default("unk"),
    note: text("note"),
    ...stamps(),
  },
  (t) => [uniqueIndex("house_place_cp_uq").on(t.placeSlug, t.cp)],
);

// čísla popisná v různých obdobích
export const houseNumber = pgTable(
  "house_number",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    houseKey: text("house_key").notNull().references(() => house.key, { onDelete: "cascade" }),
    period: text("period").notNull(),
    number: text("number").notNull(),
  },
  (t) => [index("house_number_house_idx").on(t.houseKey)],
);

export const houseEvent = pgTable(
  "house_event",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    houseKey: text("house_key").notNull().references(() => house.key, { onDelete: "cascade" }),
    year: smallint("year"),
    text: text("text").notNull(),
    certainty: certainty("certainty").notNull().default("unk"),
    recordKey: text("record_key").references((): AnyPgColumn => record.key, { onDelete: "set null" }),
    moreRecordKeys: text("more_record_keys").array().notNull().default(sql`'{}'::text[]`), // další zdroje téže položky
    ...stamps(),
  },
  (t) => [index("house_event_house_idx").on(t.houseKey, t.year), index("house_event_record_idx").on(t.recordKey)],
);

// držitelé (gruntovní knihy) a obyvatelé (sčítání, matriky)
export const houseHolder = pgTable(
  "house_holder",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    houseKey: text("house_key").notNull().references(() => house.key, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    fromText: text("from_text"),
    toText: text("to_text"),
    yearFrom: smallint("year_from"),
    how: text("how"), // koupí, dědictvím, přiženěním…
    certainty: certainty("certainty").notNull().default("unk"),
    recordKey: text("record_key").references((): AnyPgColumn => record.key, { onDelete: "set null" }),
    moreRecordKeys: text("more_record_keys").array().notNull().default(sql`'{}'::text[]`), // další zdroje téže položky
    note: text("note"),
    ...stamps(),
  },
  (t) => [
    index("house_holder_house_idx").on(t.houseKey, t.yearFrom),
    index("house_holder_person_idx").on(t.personId),
    index("house_holder_record_idx").on(t.recordKey),
  ],
);

export const houseInhabitant = pgTable(
  "house_inhabitant",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    houseKey: text("house_key").notNull().references(() => house.key, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    yearsText: text("years_text"),
    role: text("role"),
    facts: text("facts"),
    certainty: certainty("certainty").notNull().default("unk"),
    recordKey: text("record_key").references((): AnyPgColumn => record.key, { onDelete: "set null" }),
    moreRecordKeys: text("more_record_keys").array().notNull().default(sql`'{}'::text[]`), // další zdroje téže položky
    ...stamps(),
  },
  (t) => [
    index("house_inhabitant_house_idx").on(t.houseKey),
    index("house_inhabitant_person_idx").on(t.personId),
    index("house_inhabitant_record_idx").on(t.recordKey),
  ],
);

// ---------- prameny ----------
export const volume = pgTable(
  "volume",
  {
    key: text("key").primaryKey(), // mza_10985, trebon_9544…
    archive: text("archive").notNull(),
    portal: text("portal"),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    kind: text("kind"), // N, O, Z, NOZ, I, S (sčítání), G (gruntovní kniha), K (katastr)…
    yearFrom: smallint("year_from"),
    yearTo: smallint("year_to"),
    imageCount: integer("image_count"),
    placeSlug: text("place_slug").references((): AnyPgColumn => place.slug, { onDelete: "set null" }), // obec / farnost svazku
    // údaje portálu potřebné ke stažení, např. sčítání MZA: {cesta, prefix, signatura}
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    ...stamps(),
  },
  (t) => [index("volume_place_kind_idx").on(t.placeSlug, t.kind, t.yearFrom)],
);

export const record = pgTable(
  "record",
  {
    key: text("key").primaryKey(), // n-obec-rok-jmeno
    volumeKey: text("volume_key").references(() => volume.key),
    imageNo: integer("image_no"),
    kind: recordKind("kind").notNull(),
    dateText: text("date_text"),
    year: smallint("year"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    url: text("url"),
    transcriptOrig: text("transcript_orig"),
    transcriptCs: text("transcript_cs"),
    review: review("review").notNull().default("rozpracovano"),
    search: text("search").notNull().default(""),
    ...stamps(),
  },
  (t) => [
    index("record_volume_idx").on(t.volumeKey, t.imageNo),
    index("record_kind_year_idx").on(t.kind, t.year),
    index("record_review_idx").on(t.review).where(sql`${t.review} <> 'overeno'`),
    trgm("record_search_trgm", t.search),
  ],
);

// kdo v zápisu vystupuje a v jaké roli (nahrazuje r=[…] i hrany kmotr/svedek)
export const recordPerson = pgTable(
  "record_person",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    recordKey: text("record_key").notNull().references(() => record.key, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("zminen"), // dite, otec, matka, kmotr, svedek, zenich, nevesta, zemrely, oddavajici…
    nameAsWritten: text("name_as_written"),
    ...created(),
  },
  (t) => [
    uniqueIndex("record_person_uq").on(t.recordKey, t.personId, t.role),
    index("record_person_person_idx").on(t.personId),
  ],
);

export const document = pgTable(
  "document",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    description: text("description"),
    groupName: text("group_name"),
    sort: integer("sort").notNull().default(0),
    hidden: boolean("hidden").notNull().default(false),
    ...stamps(),
  },
  (t) => [index("document_group_idx").on(t.groupName, t.sort)],
);

export const documentPerson = pgTable(
  "document_person",
  {
    documentId: integer("document_id").notNull().references(() => document.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.personId] }), index("document_person_person_idx").on(t.personId)],
);

export const documentHouse = pgTable(
  "document_house",
  {
    documentId: integer("document_id").notNull().references(() => document.id, { onDelete: "cascade" }),
    houseKey: text("house_key").notNull().references(() => house.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.houseKey] }), index("document_house_house_idx").on(t.houseKey)],
);

// historické mapy (dřív mapy.json)
export const mapSheet = pgTable("map_sheet", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  year: smallint("year"),
  url: text("url"),
  source: text("source"),
  description: text("description"),
  groupName: text("group_name"),
  ...stamps(),
});

// obrázky (výřezy zápisů, dokumenty, mapy) přímo v DB; čtou se jen přes /media/<sha256>
export const media = pgTable(
  "media",
  {
    sha256: text("sha256").primaryKey(),
    mime: text("mime").notNull(),
    width: integer("width"),
    height: integer("height"),
    size: integer("size").notNull(),
    variant: mediaVariant("variant").notNull().default("web"),
    recordKey: text("record_key").references(() => record.key, { onDelete: "cascade" }),
    documentId: integer("document_id").references(() => document.id, { onDelete: "cascade" }),
    mapId: integer("map_id").references(() => mapSheet.id, { onDelete: "cascade" }),
    bytes: bytea("bytes").notNull(),
    ...created(),
  },
  (t) => [
    index("media_record_idx").on(t.recordKey, t.variant),
    index("media_document_idx").on(t.documentId),
    index("media_map_idx").on(t.mapId),
  ],
);

// zvýraznění zápisu ve výřezu (dřív zvyrazneni.json); souřadnice 0..1
export const highlight = pgTable("highlight", {
  recordKey: text("record_key").primaryKey().references(() => record.key, { onDelete: "cascade" }),
  boxes: jsonb("boxes").$type<[number, number, number, number][]>().notNull().default([]),
  status: text("status"),
  note: text("note"),
  ...stamps(),
});

// ---------- události a bydliště ----------
export const event = pgTable(
  "event",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: eventType("type").notNull(),
    dateText: text("date_text"), // jak je v prameni / „asi 1720“
    dateQual: dateQual("date_qual").notNull().default("presne"),
    yearFrom: smallint("year_from"),
    yearTo: smallint("year_to"),
    month: smallint("month"),
    day: smallint("day"),
    placeSlug: text("place_slug").references(() => place.slug, { onDelete: "set null" }),
    houseKey: text("house_key").references(() => house.key, { onDelete: "set null" }),
    placeText: text("place_text"), // místo, jak je zapsané (i když ho zatím neznáme)
    text: text("text"), // povolání, poznámka k události
    certainty: certainty("certainty").notNull().default("unk"),
    note: text("note"),
    ...stamps(),
  },
  (t) => [
    index("event_type_year_idx").on(t.type, t.yearFrom),
    index("event_place_idx").on(t.placeSlug),
    index("event_house_idx").on(t.houseKey),
  ],
);

export const eventPerson = pgTable(
  "event_person",
  {
    eventId: integer("event_id").notNull().references(() => event.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("hlavni"), // hlavni, zenich, nevesta, otec, matka…
  },
  (t) => [primaryKey({ columns: [t.eventId, t.personId, t.role] }), index("event_person_person_idx").on(t.personId)],
);

// kde osoba žila (dřív bydliste); propojuje rodokmen s dějinami domů
export const residence = pgTable(
  "residence",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
    placeSlug: text("place_slug").references(() => place.slug, { onDelete: "set null" }),
    houseKey: text("house_key").references(() => house.key, { onDelete: "set null" }),
    placeText: text("place_text"),
    cp: text("cp"),
    fromText: text("from_text"),
    toText: text("to_text"),
    yearFrom: smallint("year_from"),
    yearTo: smallint("year_to"),
    role: text("role"),
    certainty: certainty("certainty").notNull().default("unk"),
    note: text("note"),
    ...stamps(),
  },
  (t) => [
    index("residence_person_idx").on(t.personId),
    index("residence_place_idx").on(t.placeSlug),
    index("residence_house_idx").on(t.houseKey),
  ],
);

// ---------- výklad ----------
export const line = pgTable(
  "line",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    founderId: text("founder_id").references(() => person.id, { onDelete: "set null" }), // nejstarší doložený předek rodu
    ...stamps(),
  },
  (t) => [index("line_founder_idx").on(t.founderId)],
);

export const hypothesis = pgTable(
  "hypothesis",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    text: text("text").notNull().default(""),
    items: jsonb("items").$type<{ name: string; text: string }[]>().notNull().default([]),
    ...stamps(),
  },
  (t) => [index("hypothesis_person_idx").on(t.personId)],
);

export const hypothesisRecord = pgTable(
  "hypothesis_record",
  {
    hypothesisId: integer("hypothesis_id").notNull().references(() => hypothesis.id, { onDelete: "cascade" }),
    recordKey: text("record_key").notNull().references(() => record.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.hypothesisId, t.recordKey] }), index("hypothesis_record_record_idx").on(t.recordKey)],
);

// otevřené otázky (dřív ISSUES)
export const question = pgTable(
  "question",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").references(() => person.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    answer: text("answer"),
    state: questionState("state").notNull().default("otevrene"),
    ...stamps(),
  },
  (t) => [index("question_state_idx").on(t.state), index("question_person_idx").on(t.personId)],
);

export const story = pgTable(
  "story",
  {
    slug: text("slug").primaryKey(),
    kind: storyKind("kind").notNull().default("pribeh"),
    title: text("title").notNull(),
    lead: text("lead"),
    bodyMd: text("body_md").notNull().default(""),
    lineSlug: text("line_slug").references(() => line.slug, { onDelete: "set null" }),
    houseKey: text("house_key").references(() => house.key, { onDelete: "set null" }),
    yearFrom: smallint("year_from"), // období příběhu
    yearTo: smallint("year_to"),
    coverSha: text("cover_sha").references(() => media.sha256, { onDelete: "set null" }), // titulní obrázek
    sort: integer("sort").notNull().default(0),
    ...stamps(),
  },
  (t) => [index("story_kind_idx").on(t.kind, t.sort)],
);

// nastavení webu (dřív web.json): název, kontakt…
export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...stamps(),
});

// ---------- fronta vodítek, deník, úkoly ----------
// údaje od rodiny a zvěsti: nezpracovaná fronta, podklad pro další hledání (dřív udaje_od_rodiny.md)
export const tip = pgTable(
  "tip",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: tipKind("kind").notNull().default("od_rodiny"),
    text: text("text").notNull(),
    toldByPersonId: text("told_by_person_id").references(() => person.id, { onDelete: "set null" }),
    toldByName: text("told_by_name"),
    channel: text("channel"), // z paměti, zpráva, dokument, fotka, rozhovor
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    sensitive: boolean("sensitive").notNull().default(false), // vidí jen admin
    submittedByUserId: integer("submitted_by_user_id").references((): AnyPgColumn => userAccount.id, { onDelete: "set null" }),
    status: tipStatus("status").notNull().default("nezpracovano"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    search: text("search").notNull().default(""),
    ...stamps(),
  },
  (t) => [
    index("tip_open_idx").on(t.status, t.receivedAt).where(sql`${t.status} in ('nezpracovano', 'overuje_se')`),
    index("tip_told_by_idx").on(t.toldByPersonId),
    index("tip_user_idx").on(t.submittedByUserId),
    trgm("tip_search_trgm", t.search),
  ],
);

export const tipPerson = pgTable(
  "tip_person",
  {
    tipId: integer("tip_id").notNull().references(() => tip.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tipId, t.personId] }), index("tip_person_person_idx").on(t.personId)],
);

// zápisy, které vodítko potvrdily nebo vyvrátily
export const tipRecord = pgTable(
  "tip_record",
  {
    tipId: integer("tip_id").notNull().references(() => tip.id, { onDelete: "cascade" }),
    recordKey: text("record_key").notNull().references(() => record.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.tipId, t.recordKey] }), index("tip_record_record_idx").on(t.recordKey)],
);

// deník bádání (dřív research_log.md) – i neúspěšná hledání, ať se neopakují
export const researchLog = pgTable(
  "research_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    author: text("author"),
    title: text("title").notNull(),
    textMd: text("text_md").notNull().default(""),
    volumeKey: text("volume_key").references(() => volume.key, { onDelete: "set null" }),
    pages: text("pages"), // „snímky 120–148“
    result: researchResult("result").notNull().default("jine"),
    search: text("search").notNull().default(""),
    ...created(),
  },
  (t) => [
    index("research_log_at_idx").on(t.at),
    index("research_log_volume_idx").on(t.volumeKey),
    trgm("research_log_search_trgm", t.search),
  ],
);

export const researchLogPerson = pgTable(
  "research_log_person",
  {
    logId: integer("log_id").notNull().references(() => researchLog.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.logId, t.personId] }), index("research_log_person_person_idx").on(t.personId)],
);

export const researchLogRecord = pgTable(
  "research_log_record",
  {
    logId: integer("log_id").notNull().references(() => researchLog.id, { onDelete: "cascade" }),
    recordKey: text("record_key").notNull().references(() => record.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.logId, t.recordKey] }), index("research_log_record_record_idx").on(t.recordKey)],
);

export const researchLogTip = pgTable(
  "research_log_tip",
  {
    logId: integer("log_id").notNull().references(() => researchLog.id, { onDelete: "cascade" }),
    tipId: integer("tip_id").notNull().references(() => tip.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.logId, t.tipId] }), index("research_log_tip_tip_idx").on(t.tipId)],
);

// úkoly a rozpracované věci (dřív část STAV.md a archivni_dotazy.md)
export const task = pgTable(
  "task",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    kind: text("kind").notNull().default("badani"), // badani, archivni_dotaz, web, jine
    status: taskStatus("status").notNull().default("otevreny"),
    priority: smallint("priority").notNull().default(2), // 1 vysoká – 3 nízká
    ...stamps(),
  },
  (t) => [index("task_status_idx").on(t.status, t.priority)],
);

export const taskPerson = pgTable(
  "task_person",
  {
    taskId: integer("task_id").notNull().references(() => task.id, { onDelete: "cascade" }),
    personId: text("person_id").notNull().references(() => person.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] }), index("task_person_person_idx").on(t.personId)],
);

// ---------- odkud údaj je ----------
// cíl: právě jeden z event/relation/residence/person; zdroj: právě jeden z record/tip/document
export const citation = pgTable(
  "citation",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    eventId: integer("event_id").references(() => event.id, { onDelete: "cascade" }),
    relationId: integer("relation_id").references(() => relation.id, { onDelete: "cascade" }),
    residenceId: integer("residence_id").references(() => residence.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "cascade" }),
    recordKey: text("record_key").references(() => record.key, { onDelete: "cascade" }),
    tipId: integer("tip_id").references(() => tip.id, { onDelete: "cascade" }),
    documentId: integer("document_id").references(() => document.id, { onDelete: "cascade" }),
    note: text("note"),
    ...created(),
  },
  (t) => [
    index("citation_event_idx").on(t.eventId),
    index("citation_relation_idx").on(t.relationId),
    index("citation_residence_idx").on(t.residenceId),
    index("citation_person_idx").on(t.personId),
    index("citation_record_idx").on(t.recordKey),
    index("citation_tip_idx").on(t.tipId),
    index("citation_document_idx").on(t.documentId),
    check(
      "citation_one_target",
      sql`num_nonnulls(${t.eventId}, ${t.relationId}, ${t.residenceId}, ${t.personId}) = 1`,
    ),
    check("citation_one_source", sql`num_nonnulls(${t.recordKey}, ${t.tipId}, ${t.documentId}) = 1`),
  ],
);

// ---------- účty a audit ----------
export const userAccount = pgTable(
  "user_account",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    personId: text("person_id").notNull().references(() => person.id),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }), // null = heslo z karty
    role: userRole("role").notNull().default("member"),
    disabled: boolean("disabled").notNull().default(false),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    ...stamps(),
  },
  (t) => [uniqueIndex("user_account_username_uq").on(t.username), uniqueIndex("user_account_person_uq").on(t.personId)],
);

export const session = pgTable(
  "session",
  {
    idHash: text("id_hash").primaryKey(),
    userId: integer("user_id").notNull().references(() => userAccount.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...created(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    username: text("username").notNull(),
    ip: text("ip"),
    ok: boolean("ok").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempt_username_at_idx").on(t.username, t.at), index("login_attempt_ip_at_idx").on(t.ip, t.at)],
);

export const apiToken = pgTable(
  "api_token",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    role: tokenRole("role").notNull().default("agent"),
    disabled: boolean("disabled").notNull().default(false),
    lastUsed: timestamp("last_used", { withTimezone: true }),
    ...created(),
  },
  (t) => [uniqueIndex("api_token_hash_uq").on(t.tokenHash), uniqueIndex("api_token_name_uq").on(t.name)],
);

// kdo co změnil – data už nejsou v gitu, tohle je jejich historie
export const changeLog = pgTable(
  "change_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actor: text("actor").notNull(), // user:<username> / token:<nazev>
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // create, update, delete
    before: jsonb("before"),
    after: jsonb("after"),
  },
  (t) => [index("change_log_entity_idx").on(t.entity, t.entityId, t.at), index("change_log_at_idx").on(t.at)],
);
