// Vstupy API (zod). Názvy polí = názvy sloupců v src/db/schema.ts (camelCase).
import { z } from "zod";

export const Certainty = z.enum(["doc", "prob", "fam", "mh", "unk", "lit"]);
const opt = <T extends z.ZodType>(t: T) => t.nullish();

// PATCH: všechna pole volitelná a BEZ výchozích hodnot (zod .partial() by je dosadil a přepsal data)
export function patchOf<T extends z.ZodObject>(s: T): ReturnType<T["partial"]> {
  const shape = Object.fromEntries(
    Object.entries(s.shape).map(([k, v]) => [k, ((v instanceof z.ZodDefault ? v.unwrap() : v) as z.ZodType).optional()]),
  );
  return z.object(shape) as unknown as ReturnType<T["partial"]>;
}
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, "jen malá písmena bez diakritiky, číslice, - a _");
const year = z.number().int().min(800).max(2200);

// zdroj údaje: zápis z matriky, vodítko od rodiny, nebo dokument
export const Source = z
  .object({ recordKey: opt(z.string()), tipId: opt(z.number().int()), documentId: opt(z.number().int()), note: opt(z.string()) })
  .refine((s) => [s.recordKey, s.tipId, s.documentId].filter((x) => x != null).length === 1, {
    message: "zdroj: právě jedno z recordKey / tipId / documentId",
  });

export const NameIn = z.object({
  given: z.string().default(""),
  surname: z.string().default(""),
  kind: z.enum(["rodne", "po_snatku", "varianta", "v_zapisu"]).default("rodne"),
  isPrimary: z.boolean().default(false),
  certainty: Certainty.default("unk"),
  note: opt(z.string()),
});

export const EventIn = z.object({
  type: z.enum(["narozeni", "krest", "snatek", "umrti", "pohreb", "povolani", "sluzba", "jine"]),
  dateText: opt(z.string()),
  dateQual: opt(z.enum(["presne", "asi", "pred", "po", "mezi"])),
  yearFrom: opt(year),
  yearTo: opt(year),
  month: opt(z.number().int().min(1).max(12)),
  day: opt(z.number().int().min(1).max(31)),
  placeSlug: opt(z.string()),
  houseKey: opt(z.string()),
  placeText: opt(z.string()),
  text: opt(z.string()),
  certainty: Certainty.default("unk"),
  note: opt(z.string()),
  persons: z.array(z.object({ personId: z.string(), role: z.string().default("hlavni") })).min(1),
  sources: z.array(Source).default([]),
});

export const EventPatch = patchOf(EventIn.omit({ persons: true, sources: true }));

export const ResidenceIn = z.object({
  personId: z.string(),
  placeSlug: opt(z.string()),
  houseKey: opt(z.string()),
  placeText: opt(z.string()),
  cp: opt(z.string()),
  fromText: opt(z.string()),
  toText: opt(z.string()),
  role: opt(z.string()),
  certainty: Certainty.default("unk"),
  note: opt(z.string()),
  sources: z.array(Source).default([]),
});

export const PersonIn = z.object({
  id: opt(slug),
  sex: z.enum(["M", "F", "U"]),
  given: z.string().default(""),
  surname: z.string().default(""),
  certainty: Certainty.default("unk"),
  living: opt(z.boolean()),
  yearsText: opt(z.string()),
  note: opt(z.string()),
  notePrivate: opt(z.string()),
  sameAsId: opt(z.string()),
  placeholder: z.boolean().default(false),
  names: z.array(NameIn).default([]), // další jména (po sňatku, varianty)
  events: z.array(EventIn.omit({ persons: true }).extend({ role: z.string().default("hlavni") })).default([]),
  sources: z.array(Source).default([]), // zdroje k osobě jako celku
});

export const PersonPatch = z.object({
  sex: z.enum(["M", "F", "U"]),
  certainty: Certainty,
  living: z.boolean().nullable(),
  yearsText: z.string().nullable(),
  note: z.string().nullable(),
  notePrivate: z.string().nullable(),
  sameAsId: z.string().nullable(),
  placeholder: z.boolean(),
}).partial();

export const RelationIn = z.object({
  type: z.enum(["rodic", "manzele"]),
  aId: z.string(),
  bId: z.string(),
  certainty: Certainty.default("unk"),
  note: opt(z.string()),
  sources: z.array(Source).default([]),
});

export const CitationIn = z
  .object({
    eventId: opt(z.number().int()),
    relationId: opt(z.number().int()),
    residenceId: opt(z.number().int()),
    personId: opt(z.string()),
  })
  .and(Source);

export const VolumeIn = z.object({
  archive: z.string(),
  portal: opt(z.string()),
  title: z.string(),
  description: opt(z.string()),
  url: opt(z.string()),
  kind: opt(z.string()),
  yearFrom: opt(year),
  yearTo: opt(year),
  imageCount: opt(z.number().int().min(0)),
  placeSlug: opt(z.string()),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const RecordPersonIn = z.object({ personId: z.string(), role: z.string().default("zminen"), nameAsWritten: opt(z.string()) });

export const RecordIn = z.object({
  volumeKey: opt(z.string()),
  imageNo: opt(z.number().int()),
  kind: z.enum(["N", "O", "Z", "I", "S", "G", "K", "M", "C", "L", "J"]),
  dateText: opt(z.string()),
  year: opt(year),
  title: z.string(),
  summary: z.string().default(""),
  url: opt(z.string()),
  transcriptOrig: opt(z.string()),
  transcriptCs: opt(z.string()),
  review: z.enum(["rozpracovano", "ke_kontrole", "overeno"]).default("rozpracovano"),
  persons: z.array(RecordPersonIn).optional(), // když je uvedeno, nahradí celý seznam
});

export const HighlightIn = z.object({
  boxes: z.array(z.tuple([z.number(), z.number(), z.number(), z.number()])),
  status: opt(z.string()),
  note: opt(z.string()),
});

export const PlaceIn = z.object({
  name: z.string(),
  kind: opt(z.string()),
  parentSlug: opt(z.string()),
  lat: opt(z.number()),
  lon: opt(z.number()),
  osm: opt(z.string()),
  query: opt(z.string()),
  pattern: opt(z.string()),
  hypothesis: z.boolean().default(false),
  description: opt(z.string()),
  parish: opt(z.string()),
  estate: opt(z.string()),
  district: opt(z.string()),
  modernName: opt(z.string()),
  names: z.array(z.object({ name: z.string(), lang: opt(z.string()), note: opt(z.string()) })).optional(),
});

export const SurnameVariantIn = z.object({ surname: z.string(), variant: z.string(), note: opt(z.string()) });

const HouseRow = { certainty: Certainty.default("unk"), recordKey: opt(z.string()), moreRecordKeys: z.array(z.string()).default([]) };
export const HouseIn = z.object({
  placeSlug: z.string(),
  cp: z.string(),
  name: opt(z.string()),
  kind: opt(z.string()),
  description: opt(z.string()),
  lat: opt(z.number()),
  lon: opt(z.number()),
  certainty: Certainty.default("unk"),
  note: opt(z.string()),
  // když je seznam uveden, nahradí stávající
  numbers: z.array(z.object({ period: z.string(), number: z.string() })).optional(),
  events: z.array(z.object({ year: opt(z.number().int()), text: z.string(), ...HouseRow })).optional(),
  holders: z
    .array(
      z.object({
        name: z.string(),
        personId: opt(z.string()),
        fromText: opt(z.string()),
        toText: opt(z.string()),
        how: opt(z.string()),
        note: opt(z.string()),
        ...HouseRow,
      }),
    )
    .optional(),
  inhabitants: z
    .array(
      z.object({
        name: z.string(),
        personId: opt(z.string()),
        yearsText: opt(z.string()),
        role: opt(z.string()),
        facts: opt(z.string()),
        ...HouseRow,
      }),
    )
    .optional(),
});

export const PlaceEventIn = z.object({ year: opt(z.number().int()), text: z.string(), certainty: Certainty.default("unk"), recordKey: opt(z.string()) });

export const LineIn = z.object({
  name: z.string(),
  description: opt(z.string()),
  color: opt(z.string()),
  founderId: opt(z.string()),
});

export const HypothesisIn = z.object({
  personId: opt(z.string()),
  title: z.string(),
  text: z.string().default(""),
  items: z.array(z.object({ name: z.string(), text: z.string() })).default([]),
  recordKeys: z.array(z.string()).default([]),
});

export const QuestionIn = z.object({
  personId: opt(z.string()),
  question: z.string(),
  answer: opt(z.string()),
  state: z.enum(["otevrene", "hypoteza", "vyreseno"]).default("otevrene"),
});

export const StoryIn = z.object({
  kind: z.enum(["pribeh", "pribeh_rodu", "pribeh_domu", "zajimavosti", "jine"]).default("pribeh"),
  title: z.string(),
  lead: opt(z.string()),
  bodyMd: z.string().default(""),
  lineSlug: opt(z.string()),
  houseKey: opt(z.string()),
  yearFrom: opt(year),
  yearTo: opt(year),
  coverSha: opt(z.string().regex(/^[a-f0-9]{64}$/)),
  sort: z.number().int().default(0),
});

export const DocumentIn = z.object({
  title: z.string(),
  description: opt(z.string()),
  groupName: opt(z.string()),
  sort: z.number().int().default(0),
  hidden: z.boolean().default(false),
  personIds: z.array(z.string()).default([]),
  houseKeys: z.array(z.string()).default([]),
});

export const MapSheetIn = z.object({
  title: z.string(),
  year: opt(z.number().int()),
  url: opt(z.string()),
  source: opt(z.string()),
  description: opt(z.string()),
  groupName: opt(z.string()),
});

// vodítko: údaj od rodiny nebo zvěst – jde do nezpracované fronty
export const TipIn = z.object({
  kind: z.enum(["od_rodiny", "zvest", "oprava", "napad"]).default("od_rodiny"),
  text: z.string().min(3),
  personIds: z.array(z.string()).default([]),
  toldByPersonId: opt(z.string()),
  toldByName: opt(z.string()),
  channel: opt(z.string()),
  receivedAt: opt(z.coerce.date()),
  sensitive: z.boolean().default(false),
});

export const TipPatch = z
  .object({
    status: z.enum(["nezpracovano", "overuje_se", "potvrzeno", "vyvraceno", "nelze_overit", "rozdeleno"]),
    resolutionNote: z.string().nullable(),
    text: z.string(),
    sensitive: z.boolean(),
    personIds: z.array(z.string()),
    recordKeys: z.array(z.string()), // zápisy, které vodítko potvrdily / vyvrátily
  })
  .partial();

export const LogIn = z.object({
  title: z.string(),
  textMd: z.string().default(""),
  at: opt(z.coerce.date()),
  author: opt(z.string()),
  volumeKey: opt(z.string()),
  pages: opt(z.string()),
  result: z.enum(["nalezeno", "nenalezeno", "castecne", "jine"]).default("jine"),
  personIds: z.array(z.string()).default([]),
  recordKeys: z.array(z.string()).default([]),
  tipIds: z.array(z.number().int()).default([]),
});

export const TaskIn = z.object({
  title: z.string(),
  body: z.string().default(""),
  kind: z.string().default("badani"),
  status: z.enum(["otevreny", "rozpracovany", "ceka", "hotovy", "zruseny"]).default("otevreny"),
  priority: z.number().int().min(1).max(3).default(2),
  personIds: z.array(z.string()).default([]),
});

// nález z matriky v jedné transakci (dřív 6 kroků přes zapis.py a ruční úpravy osoby.py)
export const FindingIn = z.object({
  volume: VolumeIn.extend({ key: z.string() }).optional(),
  record: RecordIn.extend({ key: z.string() }),
  people: z.array(PersonIn.extend({ id: slug })).default([]), // nové osoby (id povinné, ať na ně jde odkazovat)
  relations: z.array(RelationIn).default([]),
  events: z.array(EventIn).default([]),
  residences: z.array(ResidenceIn).default([]),
  tips: z.array(z.object({ id: z.number().int(), status: TipPatch.shape.status })).default([]),
  log: LogIn.partial({ title: true }).optional(),
});

export const UsersIn = z.object({
  personIds: z.array(z.string()).min(1),
  role: z.enum(["admin", "member"]).default("member"),
});

export const SettingIn = z.object({ value: z.unknown() });
