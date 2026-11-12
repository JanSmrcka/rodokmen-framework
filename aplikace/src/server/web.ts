// Data webu z DB (náhrada site.json z tools/export_web.py). Základ se načte jednou na verzi dat,
// pohled (kořen, Kekulé, příbuznost, soukromí) se počítá pro každého přihlášeného zvlášť a drží v cache.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  citation,
  event,
  eventPerson,
  highlight,
  house,
  houseEvent,
  houseHolder,
  houseInhabitant,
  hypothesis,
  hypothesisRecord,
  line,
  media,
  place,
  question,
  record,
  recordPerson,
  residence,
  person,
  setting,
  sideNote,
  story,
  volume,
} from "@/db/schema";
import type { Home, House, HouseEntry, LifeDate, Line, Person, Place, RecordItem, Site, SiteConfig } from "@/lib/types";
import { seesPrivate, type Actor } from "./actor";
import { dataVersion } from "./audit";
import { loadGraf } from "./graf";
import { pribuznost } from "./pribuznost";
import { computeRody } from "./rody";

export const STATUS_NAME: Record<string, string> = {
  doc: "doloženo matrikou",
  prob: "pravděpodobné",
  fam: "údaj od rodiny",
  mh: "cizí rodokmen",
  unk: "neznámé",
  lit: "literatura",
};
const KIND_NAME: Record<string, string> = {
  N: "Narození", O: "Sňatek", Z: "Úmrtí", I: "Index", S: "Sčítání lidu", G: "Gruntovní kniha",
  K: "Katastr", M: "Mapa", C: "Cizí pramen", L: "Literatura", J: "Jiný pramen",
};
const PALETTE = ["#EFB45F", "#7FB7BE", "#D3756B", "#8FB573", "#A88BC7", "#E59AC0", "#6C9BD2", "#C9A66B"];

type Ev = typeof event.$inferSelect & { persons: { personId: string; role: string }[]; records: string[] };

// ---------- základ (jednou na verzi dat) ----------
async function loadBase() {
  const d = db();
  const [graf, events, eps, cites, rps, recs, vols, imgs, hls, places, houses, hevs, holders, inhabs, ress, lines, sides, stories, settings, qs, hyps, hrecs, pnotes] =
    await Promise.all([
      loadGraf(),
      d.select().from(event),
      d.select().from(eventPerson),
      d.select({ eventId: citation.eventId, personId: citation.personId, recordKey: citation.recordKey, residenceId: citation.residenceId }).from(citation),
      d.select().from(recordPerson),
      d.select().from(record).orderBy(asc(record.year)),
      d.select().from(volume),
      d.select({ sha256: media.sha256, recordKey: media.recordKey, variant: media.variant }).from(media),
      d.select().from(highlight),
      d.select().from(place),
      d.select().from(house),
      d.select().from(houseEvent).orderBy(asc(houseEvent.year)),
      d.select().from(houseHolder).orderBy(asc(houseHolder.yearFrom)),
      d.select().from(houseInhabitant),
      d.select().from(residence).orderBy(asc(residence.yearFrom)),
      d.select().from(line),
      d.select().from(sideNote),
      d.select().from(story).orderBy(asc(story.sort)),
      d.select().from(setting),
      d.select().from(question),
      d.select().from(hypothesis),
      d.select().from(hypothesisRecord),
      d.select({ id: person.id, note: person.note }).from(person),
    ]);
  const evById = new Map<number, Ev>(events.map((e) => [e.id, { ...e, persons: [], records: [] }]));
  for (const ep of eps) evById.get(ep.eventId)?.persons.push({ personId: ep.personId, role: ep.role });
  for (const c of cites) if (c.eventId && c.recordKey) evById.get(c.eventId)?.records.push(c.recordKey);
  const evsOf = new Map<string, Ev[]>();
  for (const e of evById.values()) for (const p of e.persons) evsOf.set(p.personId, [...(evsOf.get(p.personId) ?? []), e]);
  const recsOf = new Map<string, Set<string>>();
  const addRec = (pid: string, key: string) => recsOf.set(pid, (recsOf.get(pid) ?? new Set()).add(key));
  for (const rp of rps) addRec(rp.personId, rp.recordKey);
  for (const c of cites) if (c.personId && c.recordKey) addRec(c.personId, c.recordKey);
  const resCites = new Map<number, string[]>();
  for (const c of cites) if (c.residenceId && c.recordKey) resCites.set(c.residenceId, [...(resCites.get(c.residenceId) ?? []), c.recordKey]);

  return {
    graf,
    evsOf,
    recsOf,
    rps,
    recs,
    vols: new Map(vols.map((v) => [v.key, v])),
    imgs,
    hls: new Map(hls.map((h) => [h.recordKey, h])),
    places: new Map(places.map((p) => [p.slug, p])),
    houses,
    hevs,
    holders,
    inhabs,
    ress,
    resCites,
    sides,
    stories,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) as Record<string, unknown>,
    qs,
    hyps,
    hrecs,
    rody: computeRody(graf, lines, [settings.find((x) => x.key === "vychozi_koren")?.value].filter((x): x is string => typeof x === "string")),
    notes: new Map(pnotes.filter((x) => x.note).map((x) => [x.id, x.note!])),
  };
}
type Base = Awaited<ReturnType<typeof loadBase>>;

// ---------- pomocné ----------
const SIGN: Record<string, string> = { narozeni: "*", krest: "pokřtěn(a)", snatek: "×", umrti: "†", pohreb: "pohřben(a)" };
const ROLE: Record<string, string> = { kmotr: "kmotr", kmotra: "kmotra", svedek: "svědek", svedkyne: "svědkyně", porodni_baba: "porodní bába", oddavajici: "oddávající" };
const OF_EVENT: Record<string, string> = { narozeni: "narození", krest: "křtu", snatek: "sňatku", umrti: "úmrtí", pohreb: "pohřbu" };
// role rodičů u narození dětí je vidět v rodině, do životopisu je nepsat
const SKIP_ROLES = new Set(["otec", "matka"]);

function lifeDate(e: Ev | undefined): LifeDate | undefined {
  if (!e || (!e.yearFrom && !e.yearTo)) return undefined;
  const q = e.dateQual === "presne" ? "" : e.dateQual;
  return { y: e.dateQual === "mezi" ? null : e.yearFrom, lo: e.yearFrom, hi: e.yearTo ?? e.yearFrom, q };
}

function placeLabel(b: Base, e: { placeSlug: string | null; houseKey: string | null; placeText: string | null }) {
  const p = e.placeSlug ? b.places.get(e.placeSlug)?.name : null;
  const h = e.houseKey ? b.houses.find((x) => x.key === e.houseKey) : null;
  return [p ?? e.placeText, h ? `čp. ${h.cp}` : null].filter(Boolean).join(" ");
}

function factOf(b: Base, e: Ev, self: string): string {
  const where = placeLabel(b, e);
  const own = e.persons.find((p) => p.personId === self)?.role;
  // u vlastní události s popisem (např. importovaný fakt) ukázat text, jak je zapsaný
  if (e.text && SIGN[e.type] && (own === "hlavni" || own === "zenich" || own === "nevesta")) {
    return `${SIGN[e.type]} ${e.text}`;
  }
  if (e.type === "snatek") {
    const others = e.persons.filter((p) => p.personId !== self && ["zenich", "nevesta", "hlavni"].includes(p.role));
    const names = others.map((p) => b.graf.nodes.get(p.personId)?.name).filter(Boolean);
    return ["×", e.dateText, names.join(", "), where && `(${where})`].filter(Boolean).join(" ");
  }
  if (e.type === "povolani" || e.type === "jine" || e.type === "sluzba") return [e.text, e.dateText && `(${e.dateText})`].filter(Boolean).join(" ");
  const role = e.persons.find((p) => p.personId === self)?.role;
  if (role && role !== "hlavni") {
    // kmotr, svědek… u cizí události („kmotr při křtu – Marie Nováková, 2. 2. 1886 Lhota“)
    const main = e.persons.find((p) => p.role === "hlavni" || p.role === "dite" || p.role === "zenich");
    const whose = main ? b.graf.nodes.get(main.personId)?.name : "";
    return `${ROLE[role] ?? role} při ${OF_EVENT[e.type] ?? "události"}${whose ? ` – ${whose}` : ""}${[e.dateText, where].some(Boolean) ? `, ${[e.dateText, where].filter(Boolean).join(" ")}` : ""}`;
  }
  return [SIGN[e.type] ?? e.type, e.dateText, where].filter(Boolean).join(" ");
}

const ORDER: Record<string, number> = { narozeni: 0, krest: 1, povolani: 2, sluzba: 3, snatek: 4, jine: 5, umrti: 6, pohreb: 7 };
const evSort = (a: Ev, b: Ev) => (a.yearFrom ?? 9999) - (b.yearFrom ?? 9999) || ORDER[a.type] - ORDER[b.type];

// zmínky osob a zápisů v příbězích (odkazy /osoba/<id>/, /zdroj/<klic>/)
function mentions(b: Base) {
  const out = new Map<string, { href: string; page: string; section: string }[]>();
  for (const s of b.stories) {
    const href = s.slug === "pribeh" ? "/pribeh-rodu/" : s.slug === "zajimavosti" ? "/zajimavosti/" : s.slug === "pribeh-domu" ? "/pribeh-domu/" : `/pribeh/${s.slug}/`;
    let section = "";
    for (const lineText of s.bodyMd.split("\n")) {
      const h = lineText.match(/^##\s+(.*)/);
      if (h) section = h[1];
      for (const m of lineText.matchAll(/\/(osoba|zdroj|dum)\/([a-z0-9_-]+)\/?/g)) {
        const key = `${m[1]}:${m[2]}`;
        const list = out.get(key) ?? [];
        if (!list.some((x) => x.href === href && x.section === section)) list.push({ href, page: s.title, section });
        out.set(key, list);
      }
    }
  }
  return out;
}

// ---------- pohled pro přihlášeného ----------
function buildView(b: Base, actor: Actor): Site {
  const g = b.graf;
  const priv = seesPrivate(actor);
  const fallbackRoot = (b.settings.vychozi_koren as string | undefined) ?? [...g.nodes.keys()][0] ?? "";
  const root = g.main(actor.personId && g.nodes.has(actor.personId) ? actor.personId : fallbackRoot);
  const kek = root ? g.kekuleIndex(root) : new Map<string, number>();
  const byK = root ? g.kekule(root) : new Map<number, string>();
  const ments = mentions(b);

  // k = nejbližší předek přihlášeného v rodu (pořadí rodů), 0 = rod mimo jeho předky
  const lineOf = b.rody.lineOf;
  const linesOut: Record<string, Line> = {};
  // barvy bez vlastní: uložené rody napřed (jako dřív), pak dopočítané
  [...b.rody.lines.filter((l) => !l.auto), ...b.rody.lines.filter((l) => l.auto)].forEach((l, i) => {
    linesOut[l.slug] = { k: 0, slug: l.slug, name: l.name, desc: l.description, color: l.color || PALETTE[i % PALETTE.length], root: l.founderId, people: [], ...(l.auto ? { auto: true } : {}) };
  });
  for (const [id, k] of kek) {
    const l = linesOut[lineOf.get(id) ?? ""];
    if (l && (!l.k || k < l.k)) l.k = k;
  }

  const rels = new Map<string, ReturnType<typeof pribuznost>>();
  const relOf = (id: string) => {
    if (!rels.has(id)) rels.set(id, root ? pribuznost(g, root, id) : { label: "", kind: "zadna", up: null, down: null, via: null });
    return rels.get(id)!;
  };
  const people: Record<string, Person> = {};
  let documented = 0;
  let maxGen = 0;
  for (const n of g.nodes.values()) {
    if (n.placeholder || n.sameAsId) continue;
    const id = n.id;
    const k = kek.get(id) ?? null;
    const gen = k ? Math.floor(Math.log2(k)) : null;
    if (gen !== null) maxGen = Math.max(maxGen, gen);
    const hide = n.living && !priv;
    const evs = (b.evsOf.get(id) ?? []).slice().sort(evSort);
    const birthEv = evs.find((e) => e.type === "narozeni" && e.persons.some((p) => p.personId === id && p.role === "hlavni")) ??
      evs.find((e) => e.type === "krest" && e.persons.some((p) => p.personId === id && p.role === "hlavni"));
    const deathEv = evs.find((e) => (e.type === "umrti" || e.type === "pohreb") && e.persons.some((p) => p.personId === id && p.role === "hlavni"));
    const { father, mother } = g.parents(id);
    const real = (x: string | null) => (x && !g.nodes.get(x)?.placeholder ? x : null);
    const lineSlug = lineOf.get(id) ?? null;
    if (lineSlug && linesOut[lineSlug]) linesOut[lineSlug].people.push(id);
    if (n.certainty === "doc") documented++;
    const homes: Home[] = hide
      ? []
      : b.ress
          .filter((r) => r.personId === id)
          .map((r) => ({
            house: r.houseKey,
            obec: (r.placeSlug && b.places.get(r.placeSlug)?.name) || r.placeText || "",
            cp: r.cp ?? "",
            since: r.yearFrom,
            until: r.yearTo,
            role: r.role ?? "",
            records: b.resCites.get(r.id) ?? [],
            obecSlug: r.placeSlug ?? "",
          }));
    const years = hide ? (n.birthYear ? `* ${n.birthYear}` : "") : n.yearsText || [n.birthYear ?? "", n.deathYear ?? ""].join("–").replace(/^–$/, "");
    people[id] = {
      slug: id,
      k,
      name: n.name,
      y: years,
      years,
      st: n.certainty as Person["st"],
      status: STATUS_NAME[n.certainty] ?? n.certainty,
      gen,
      sex: n.sex === "F" ? "F" : "M",
      rel: relOf(id).label,
      line: lineSlug ? linesOut[lineSlug]?.k ?? null : null,
      lineSlug,
      facts: hide
        ? n.birthYear
          ? [`* ${n.birthYear}`]
          : []
        : evs.filter((e) => !e.persons.some((p) => p.personId === id && SKIP_ROLES.has(p.role))).map((e) => factOf(b, e, id)),
      note: hide ? "" : (b.notes.get(id) ?? ""),
      records: hide ? [] : [...(b.recsOf.get(id) ?? [])],
      father: real(father),
      mother: real(mother),
      fatherUnknown: !!father && !real(father),
      motherUnknown: !!mother && !real(mother),
      child: k && k > 1 ? (byK.get(Math.floor(k / 2)) ?? null) : null,
      spouse: g.spouses(id)[0] ?? null,
      spouses: g.spouses(id),
      spouseEnds: hide
        ? {}
        : Object.fromEntries(g.edges.filter((e) => e.type === "manzele" && e.end && (e.a === id || e.b === id)).map((e) => [e.a === id ? e.b : e.a, e.end!])),
      siblings: g.siblings(id),
      children: g.children(id).filter((c) => !g.nodes.get(c)?.placeholder),
      side: hide ? [] : b.sides.filter((s) => s.personId === id).map((s) => ({ name: s.title, text: s.text, records: [] })),
      docs: [],
      also: [],
      path: [],
      birth: hide ? (n.birthYear ? { y: n.birthYear, lo: n.birthYear, hi: n.birthYear, q: "" } : undefined) : lifeDate(birthEv),
      death: hide ? undefined : lifeDate(deathEv),
      alive: n.living,
      place: hide || !birthEv ? null : placeLabel(b, birthEv) || null,
      placeSlug: hide ? null : (birthEv?.placeSlug ?? null),
      homes,
      mentions: ments.get(`osoba:${id}`) ?? [],
    };
  }

  // zápisy
  const imgOf = new Map<string, { web?: string; plny?: string }>();
  for (const m of b.imgs) if (m.recordKey) imgOf.set(m.recordKey, { ...imgOf.get(m.recordKey), [m.variant]: m.sha256 });
  const records: RecordItem[] = b.recs.map((r) => {
    const v = r.volumeKey ? b.vols.get(r.volumeKey) : undefined;
    const im = imgOf.get(r.key) ?? {};
    const web = im.web ?? im.plny;
    return {
      key: r.key,
      kind: r.kind,
      kindName: KIND_NAME[r.kind] ?? r.kind,
      date: r.dateText ?? "",
      title: r.title,
      summary: r.summary,
      scan: r.imageNo,
      archive: v?.archive ?? "",
      volume: v?.title ?? "",
      vdesc: v?.description ?? "",
      portal: v?.portal ?? "",
      url: r.url ?? v?.url ?? "",
      img: !!web,
      full: !!im.plny,
      imgSrc: web ? `/media/${web}` : null,
      fullSrc: im.plny ? `/media/${im.plny}` : web ? `/media/${web}` : null,
      boxes: b.hls.get(r.key)?.boxes ?? [],
      orig: r.transcriptOrig ?? "",
      cs: r.transcriptCs ?? "",
      people: [...new Set(b.rps.filter((x) => x.recordKey === r.key).map((x) => x.personId))].filter((id) => people[id]),
      houses: [],
      mentions: ments.get(`zdroj:${r.key}`) ?? [],
    };
  });

  // místa: kdo tam žil (události a bydliště), skupiny podle rodu; „moje“ = předci přihlášeného
  const placePeople = new Map<string, Set<string>>();
  const placeYears = new Map<string, number[]>();
  const touch = (slug: string | null, pid: string, year: number | null) => {
    if (!slug || !people[pid]) return;
    placePeople.set(slug, (placePeople.get(slug) ?? new Set()).add(pid));
    if (year) placeYears.set(slug, [...(placeYears.get(slug) ?? []), year]);
  };
  const OWN = ["hlavni", "zenich", "nevesta"];
  for (const [pid, evs] of b.evsOf) {
    for (const e of evs) if (e.persons.some((p) => p.personId === pid && OWN.includes(p.role))) touch(e.placeSlug, pid, e.yearFrom);
  }
  for (const r of b.ress) touch(r.placeSlug, r.personId, r.yearFrom);
  const ancestorsOfRoot = new Set([root, ...g.ancestors(root).keys()]);
  const places: Place[] = [...placePeople].flatMap(([slug, ids]) => {
    const p = b.places.get(slug);
    if (!p || p.lat == null || p.lon == null) return [];
    const byLine = new Map<number, string[]>();
    for (const id of ids) {
      const k = people[id].line ?? 0;
      byLine.set(k, [...(byLine.get(k) ?? []), id]);
    }
    const ys = placeYears.get(slug) ?? [];
    return [
      {
        name: p.name,
        slug,
        lat: p.lat,
        lon: p.lon,
        lines: [...byLine].map(([k, ppl]) => ({ k, people: ppl })),
        years: ys.length ? [Math.min(...ys), Math.max(...ys)] : [],
        hypothesis: p.hypothesis,
        mine: [...ids].filter((id) => ancestorsOfRoot.has(id)),
      },
    ];
  });

  // domy
  const entry = (
    st: string,
    rest: Partial<HouseEntry> & { recordKey?: string | null; moreRecordKeys?: string[]; personId?: string | null },
  ): HouseEntry => ({
    ...rest,
    st,
    status: STATUS_NAME[st] ?? st,
    records: [...(rest.recordKey ? [rest.recordKey] : []), ...(rest.moreRecordKeys ?? [])],
    person: rest.personId && people[rest.personId] ? rest.personId : null,
  });
  const housesOut: Record<string, House> = {};
  for (const h of b.houses) {
    const evs = b.hevs.filter((e) => e.houseKey === h.key);
    const owners = b.holders.filter((x) => x.houseKey === h.key);
    const inh = b.inhabs.filter((x) => x.houseKey === h.key);
    housesOut[h.key] = {
      slug: h.key,
      cp: h.cp,
      obec: b.places.get(h.placeSlug)?.name ?? h.placeSlug,
      obecSlug: h.placeSlug,
      name: h.name ?? "",
      kind: h.kind ?? "",
      st: h.certainty,
      status: STATUS_NAME[h.certainty] ?? h.certainty,
      desc: h.description ?? "",
      note: h.note ?? "",
      lat: h.lat,
      lon: h.lon,
      events: evs.map((e) => entry(e.certainty, { year: e.year ? String(e.year) : "", text: e.text, recordKey: e.recordKey, moreRecordKeys: e.moreRecordKeys })),
      owners: owners.map((o) =>
        entry(o.certainty, { since: o.fromText ?? "", until: o.toText ?? "", name: o.name, how: o.how ?? "", note: o.note ?? "", recordKey: o.recordKey, moreRecordKeys: o.moreRecordKeys, personId: o.personId }),
      ),
      people: inh.map((o) => entry(o.certainty, { name: o.name, years: o.yearsText ?? "", role: o.role ?? "", text: o.facts ?? "", recordKey: o.recordKey, moreRecordKeys: o.moreRecordKeys, personId: o.personId })),
      records: [...new Set([...evs, ...owners, ...inh].flatMap((x) => [x.recordKey, ...x.moreRecordKeys]).filter((x): x is string => !!x))],
      mentions: ments.get(`dum:${h.key}`) ?? [],
    };
  }

  // nastavení a příběhy
  const s = b.settings;
  const rootName = g.nodes.get(root)?.name ?? "";
  const storySlugs = b.stories.filter((x) => (x.kind === "pribeh" || x.kind === "pribeh_rodu") && x.slug !== "pribeh").map((x) => ({ slug: x.slug, titulek: x.title }));
  const config: SiteConfig = {
    nazev: (s.nazev as string) ?? "Rodokmen",
    popis: (s.popis as string) ?? "Rodinný rodokmen z českých matrik.",
    zapati: (s.zapati as string) ?? "Rodokmen z českých matrik",
    kontakt: s.kontakt as SiteConfig["kontakt"],
    uvod: s.uvod as SiteConfig["uvod"],
    pribeh: s.pribeh as SiteConfig["pribeh"],
    zajimavosti_na_uvodu: s.zajimavosti_na_uvodu as SiteConfig["zajimavosti_na_uvodu"],
    pribehy: storySlugs,
    maPribeh: b.stories.some((x) => x.slug === "pribeh"),
    pribehDomuStranka: b.stories.some((x) => x.slug === "pribeh-domu"),
  };

  // „moje“: já, pokrevní příbuzní a manžel(ka)
  const MINE_KINDS = new Set(["ja", "predek", "potomek", "pokrevni", "manzel"]);
  const minePeople = Object.keys(people).filter((id) => MINE_KINDS.has(relOf(id).kind));
  const ancestors = [...g.ancestors(root).keys()].filter((id) => people[id]);
  const mineLines = Object.values(linesOut)
    .filter((l) => l.people.some((id) => id === root || kek.has(id)))
    .sort((a, b) => (a.k || 1e9) - (b.k || 1e9))
    .map((l) => l.slug);
  // příběhy: jen pokrevní příbuzní (příběh rodu manžela patří pod „Vše“)
  const blood = new Set(minePeople.filter((id) => relOf(id).kind !== "manzel"));
  // pořadí: nejvíc zmíněných předků přihlášeného napřed (příběh vlastního rodu před příběhem rodu dětí)
  const ancSet = new Set(ancestors);
  const storyScore = new Map<string, number>();
  for (const [k, v] of ments) {
    if (!k.startsWith("osoba:") || !blood.has(k.slice(6))) continue;
    for (const m of v) storyScore.set(m.href, (storyScore.get(m.href) ?? 0) + (ancSet.has(k.slice(6)) ? 10 : 1));
  }
  const mineStories = [...storyScore].sort((a, b) => b[1] - a[1]).map(([h]) => h);

  return {
    config,
    root,
    mine: { people: minePeople, ancestors, lines: mineLines, stories: mineStories },
    roots: root ? [{ key: "ja", id: root, name: rootName }] : [],
    people,
    records,
    lines: linesOut,
    places,
    houses: housesOut,
    issues: b.qs
      .filter((q) => q.state !== "vyreseno")
      .map((q) => ({ title: q.question, text: q.answer ?? "", people: q.personId ? [q.personId] : [], lines: [] })),
    hypotheses: b.hyps.map((h) => ({ title: h.title, text: h.text, items: h.items })),
    stats: { people: Object.keys(people).length, documented, records: records.length, generations: maxGen + 1 },
  };
}

// ---------- cache ----------
let base: { version: number; data: Base; views: Map<string, Site> } | null = null;

export async function getSiteFor(actor: Actor): Promise<Site> {
  const version = await dataVersion(db());
  if (!base || base.version !== version) {
    base = { version, data: await loadBase(), views: new Map() };
  }
  const key = `${actor.personId ?? ""}|${seesPrivate(actor) ? "p" : "m"}`;
  let v = base.views.get(key);
  if (!v) {
    v = buildView(base.data, actor);
    if (base.views.size > 50) base.views.clear();
    base.views.set(key, v);
  }
  return v;
}

export async function getStoryRow(slug: string) {
  const [s] = await db().select().from(story).where(eq(story.slug, slug));
  return s ?? null;
}
