// REST API /api/v1/* – tabulka cest → doménové funkce. Přehled: GET /api/v1 (bez přihlášení jen 401).
import { z } from "zod";
import { canEdit, requireAdmin, requireEdit, type Actor } from "./actor";
import { actorFromSession, actorFromToken, SESSION_COOKIE } from "./auth";
import { ApiError, badRequest, notFound } from "./errors";
import * as F from "./fronta";
import { loadGraf } from "./graf";
import { searchAll } from "./hledani";
import { kontrola } from "./kontrola";
import * as M from "./mista";
import { saveFinding } from "./nalez";
import * as O from "./osoby";
import * as P from "./prameny";
import { pribuznost, vsechnyCesty } from "./pribuznost";
import { loadRody, rodyFor, rodyOfPersons, vetve } from "./rody";
import { redactPerson } from "./soukromi";
import { withTx } from "./tx";
import * as U from "./uzivatele";
import * as V from "./vstupy";
import * as Y from "./vyklad";

interface Ctx {
  actor: Actor;
  params: Record<string, string>;
  query: URLSearchParams;
  body: () => Promise<unknown>;
  raw: () => Promise<Buffer>;
}
type Handler = (c: Ctx) => Promise<unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface Route {
  method: Method;
  path: string;
  doc: string;
  handler: Handler;
}

const routes: Route[] = [];
const r = (method: Method, path: string, doc: string, handler: Handler) => routes.push({ method, path, doc, handler });

const parse = async <T extends z.ZodType>(schema: T, c: Ctx): Promise<z.infer<T>> => {
  const res = schema.safeParse(await c.body());
  if (!res.success) throw badRequest("Neplatný vstup", z.treeifyError(res.error));
  return res.data;
};
const int = (s: string) => {
  const n = Number(s);
  if (!Number.isInteger(n)) throw badRequest(`Očekávám číslo, ne „${s}“.`);
  return n;
};
const q = (c: Ctx, k: string) => c.query.get(k) ?? undefined;

// ?rod=<slug> = položky s osobou z rodu, ?rod=bez = bez osoby v rodu; každá položka dostane lines (rody svých osob).
// ?vetev=<kořen> přidá branches (Kekule prarodičů kořene 4–7, jejichž větve se položka týká), &prarodic=<4–7> filtruje.
async function byRod<T>(c: Ctx, list: (personIds?: string[]) => Promise<T[]>, idsOf: (x: T) => string[]) {
  const { rody, graf } = await loadRody();
  const rod = q(c, "rod");
  if (rod && rod !== "bez" && !rody.lines.some((l) => l.slug === rod)) throw badRequest(`Neznámý rod: ${rod} (seznam: GET rody)`);
  const koren = q(c, "vetev");
  if (koren && !graf.nodes.has(koren)) throw badRequest(`Neznámá osoba: ${koren}`);
  const branches = koren ? vetve(graf, koren) : null;
  const prarodic = q(c, "prarodic");
  if (prarodic && !branches?.has(Number(prarodic))) throw badRequest("prarodic=<4–7> jen s vetev=<kořen> a známým prarodičem (4 = otcův otec … 7 = matčina matka)");
  let members = rod && rod !== "bez" ? [...rody.lineOf].filter(([, s]) => s === rod).map(([id]) => id) : undefined;
  if (prarodic) {
    const clan = branches!.get(Number(prarodic))!;
    members = members ? members.filter((id) => clan.has(id)) : [...clan];
  }
  const items = (await list(members)).map((x) => {
    const ids = idsOf(x);
    return {
      ...x,
      lines: rodyOfPersons(rody, ids),
      ...(branches ? { branches: [...branches].filter(([, clan]) => ids.some((id) => clan.has(graf.main(id)))).map(([k]) => k) } : {}),
    };
  });
  return rod === "bez" ? items.filter((x) => !x.lines.length) : items;
}
const tx = <T>(fn: Parameters<typeof withTx<T>>[0]) => withTx(fn);

// ---------- kdo jsem ----------
r("GET", "ja", "přihlášený uživatel / token", async ({ actor }) => actor);

// ---------- osoby ----------
r(
  "GET",
  "osoby",
  "?q= jméno (snese tvary z matrik); ?misto=<slug>&od=&do=&udalost=narozeni|krest|snatek|umrti|pohreb|bydliste filtr; ?detail=1[&id=a,b,…] detaily víc osob",
  async (c) => {
  const s = q(c, "q");
  const g = await loadGraf();
  // řádek seznamu: roky a místo narození, ať jde rozlišit tři „Jany Nováky“ bez otevírání detailu
  const row = (id: string, extra: Record<string, unknown> = {}) => {
    const n = g.nodes.get(id);
    const hide = !!n?.living && !canEdit(c.actor);
    return {
      id,
      name: n?.name ?? id,
      sex: n?.sex,
      certainty: n?.certainty,
      yearsText: hide ? (n?.birthYear ? `* ${n.birthYear}` : null) : (n?.yearsText ?? null),
      birthYear: n?.birthYear ?? null,
      deathYear: hide ? null : (n?.deathYear ?? null),
      living: n?.living ?? false,
      sameAsId: n?.sameAsId ?? null,
      relationToViewer: c.actor.personId ? pribuznost(g, c.actor.personId, id).label : null,
      ...extra,
    };
  };
  const misto = q(c, "misto");
  if (misto || q(c, "od") || q(c, "do")) {
    const hits = await O.personsByPlaceAndYears({
      placeSlug: misto,
      from: q(c, "od") ? int(q(c, "od")!) : undefined,
      to: q(c, "do") ? int(q(c, "do")!) : undefined,
      type: q(c, "udalost"),
    });
    const ids = new Set(hits.map((h) => h.personId));
    const filtered = s ? (await O.searchPersons(s, 1000)).filter((p) => ids.has(p.id)).map((p) => p.id) : [...ids];
    return filtered.map((id) => row(id, { matches: hits.filter((h) => h.personId === id).map(({ personId: _p, ...h }) => (void _p, h)) }));
  }
  if (s) return (await O.searchPersons(s, Number(q(c, "limit") ?? 30))).map((p) => row(p.id, { matchedName: `${p.given} ${p.surname}`.trim(), nameKind: p.kind, score: p.score }));
  if (q(c, "detail") === "1") {
    const ids = q(c, "id")?.split(",").map((x) => x.trim()).filter(Boolean) ?? [...g.nodes.keys()];
    const viewer = c.actor.personId;
    const kek = viewer ? g.kekuleIndex(viewer) : null;
    return (await O.personsRaw(ids)).map((p) => {
      const living = g.nodes.get(p.id)?.living ?? false;
      return {
        ...redactPerson(c.actor, p, living),
        living,
        relationToViewer: viewer ? pribuznost(g, viewer, p.id) : null,
        kekule: kek?.get(g.main(p.id)) ?? null,
      };
    });
  }
  return [...g.nodes.values()].map((n) => ({
    id: n.id,
    name: n.name,
    sex: n.sex,
    certainty: n.certainty,
    yearsText: n.living && !canEdit(c.actor) ? (n.birthYear ? `* ${n.birthYear}` : null) : n.yearsText,
    living: n.living,
    sameAsId: n.sameAsId,
  }));
},
);
r("POST", "osoby", "nová osoba (+ jména, události, zdroje)", async (c) => {
  const inp = await parse(V.PersonIn, c);
  return tx((t) => O.createPerson(t, c.actor, inp));
});
r("GET", "osoby/:id", "detail osoby (jména, události, vztahy, zápisy, citace) + příbuznost k přihlášenému", async (c) => {
  const p = await O.personRaw(c.params.id);
  const g = await loadGraf();
  const node = g.nodes.get(p.id);
  const viewer = c.actor.personId;
  return {
    ...redactPerson(c.actor, p, node?.living ?? false),
    living: node?.living ?? false,
    relationToViewer: viewer ? pribuznost(g, viewer, p.id) : null,
    kekule: viewer ? (g.kekuleIndex(viewer).get(g.main(p.id)) ?? null) : null,
    lineSlug: (await loadRody()).rody.lineOf.get(p.id) ?? null,
  };
});
r("PATCH", "osoby/:id", "úprava osoby", async (c) => {
  const inp = await parse(V.PersonPatch, c);
  return tx((t) => O.updatePerson(t, c.actor, c.params.id, inp));
});
r("DELETE", "osoby/:id", "smazání osoby (admin)", async (c) => tx((t) => O.deletePerson(t, c.actor, c.params.id)));
r("POST", "osoby/:id/jmena", "další jméno osoby", async (c) => {
  const inp = await parse(V.NameIn, c);
  return tx((t) => O.addName(t, c.actor, c.params.id, inp));
});
r("POST", "osoby/:id/bocni", "souhrn o bočních příbuzných {title, text}", async (c) => {
  const inp = await parse(z.object({ title: z.string(), text: z.string() }), c);
  return tx((t) => O.addSideNote(t, c.actor, c.params.id, inp.title, inp.text));
});
r("PATCH", "jmena/:id", "úprava jména", async (c) => {
  const inp = await parse(V.patchOf(V.NameIn), c);
  return tx((t) => O.updateName(t, c.actor, int(c.params.id), inp));
});
r("DELETE", "jmena/:id", "smazání jména", async (c) => tx((t) => O.deleteName(t, c.actor, int(c.params.id))));

r("POST", "vztahy", "vztah rodic (a = rodič, b = dítě) nebo manzele", async (c) => {
  const inp = await parse(V.RelationIn, c);
  return tx((t) => O.addRelation(t, c.actor, inp));
});
r("PATCH", "vztahy/:id", "úprava jistoty / poznámky / konce manželství {endReason: umrti|rozvod|rozluka|jine, endText}", async (c) => {
  const inp = await parse(
    z.object({
      certainty: V.Certainty.optional(),
      note: z.string().nullable().optional(),
      endReason: z.enum(["umrti", "rozvod", "rozluka", "jine"]).nullable().optional(),
      endText: z.string().nullable().optional(),
    }),
    c,
  );
  return tx((t) => O.updateRelation(t, c.actor, int(c.params.id), inp));
});
r("DELETE", "vztahy/:id", "smazání vztahu", async (c) => tx((t) => O.deleteRelation(t, c.actor, int(c.params.id))));

r("POST", "udalosti", "událost (narození, sňatek…) s osobami a zdroji", async (c) => {
  const inp = await parse(V.EventIn, c);
  return tx((t) => O.addEvent(t, c.actor, inp));
});
r("PATCH", "udalosti/:id", "úprava události", async (c) => {
  const inp = await parse(V.EventPatch, c);
  return tx((t) => O.updateEvent(t, c.actor, int(c.params.id), inp));
});
r("DELETE", "udalosti/:id", "smazání události", async (c) => tx((t) => O.deleteEvent(t, c.actor, int(c.params.id))));

r("POST", "bydliste", "bydliště osoby (obec, čp., od–do)", async (c) => {
  const inp = await parse(V.ResidenceIn, c);
  return tx((t) => O.addResidence(t, c.actor, inp));
});
r("PATCH", "bydliste/:id", "úprava bydliště", async (c) => {
  const inp = await parse(V.patchOf(V.ResidenceIn), c);
  return tx((t) => O.updateResidence(t, c.actor, int(c.params.id), inp));
});
r("DELETE", "bydliste/:id", "smazání bydliště", async (c) => tx((t) => O.deleteResidence(t, c.actor, int(c.params.id))));

r("POST", "citace", "zdroj k události / vztahu / bydlišti / osobě", async (c) => {
  const inp = await parse(V.CitationIn, c);
  return tx((t) => O.addCitation(t, c.actor, inp));
});
r("DELETE", "citace/:id", "smazání citace", async (c) => tx((t) => O.deleteCitation(t, c.actor, int(c.params.id))));

// ---------- graf ----------
r("GET", "graf/kekule", "?koren=<id> Kekulého čísla (výchozí kořen = přihlášený)", async (c) => {
  const g = await loadGraf();
  const root = q(c, "koren") ?? c.actor.personId;
  if (!root) throw badRequest("Chybí ?koren=<id osoby>.");
  return [...g.kekule(root)].map(([k, id]) => ({ k, id, name: g.nodes.get(id)?.name ?? id }));
});
r("GET", "graf/pribuznost", "?od=<id>&k=<id> jak je osoba k příbuzná (+ cesty: všechna pokrevní příbuzenství)", async (c) => {
  const g = await loadGraf();
  const od = q(c, "od") ?? c.actor.personId;
  const k = q(c, "k");
  if (!od || !k) throw badRequest("Použití: ?od=<id>&k=<id>");
  return { ...pribuznost(g, od, k), cesty: vsechnyCesty(g, od, k) };
});
r("GET", "graf/predci", "?id=<id> předci s generací", async (c) => {
  const g = await loadGraf();
  const id = q(c, "id") ?? c.actor.personId;
  if (!id) throw badRequest("Chybí ?id=");
  return [...g.ancestors(id)].map(([pid, gen]) => ({ id: pid, gen, name: g.nodes.get(pid)?.name }));
});
r("GET", "kontrola", "kontrola: graf (chyby) + zápisy bez výřezu/rámečku a doložené údaje bez zdroje (upozornění)", async (c) => {
  requireEdit(c.actor);
  return kontrola();
});

// ---------- prameny ----------
r("GET", "svazky", "?misto=&druh=&rok= svazky (např. sčítací operát obce pro rok: druh=S)", async (c) =>
  P.listVolumes({ placeSlug: q(c, "misto"), kind: q(c, "druh"), year: q(c, "rok") ? int(q(c, "rok")!) : undefined }),
);
r("GET", "svazky/:key", "svazek se zápisy", async (c) => P.getVolume(c.params.key));
r("PUT", "svazky/:key", "založení / úprava svazku", async (c) => {
  const inp = await parse(V.VolumeIn, c);
  return tx((t) => P.upsertVolume(t, c.actor, c.params.key, inp));
});
r("GET", "zaznamy", "?q=&svazek=&review=&osoba= zápisy", async (c) =>
  P.listRecords({ q: q(c, "q"), volumeKey: q(c, "svazek"), review: q(c, "review"), personId: q(c, "osoba"), limit: Number(q(c, "limit") ?? 100) }),
);
r("GET", "zaznamy/:key", "zápis (přepis, osoby v rolích, obrázky, zvýraznění)", async (c) => P.getRecord(c.params.key));
r("PUT", "zaznamy/:key", "založení / přepsání zápisu", async (c) => {
  const inp = await parse(V.RecordIn, c);
  return tx((t) => P.upsertRecord(t, c.actor, c.params.key, inp));
});
r("PATCH", "zaznamy/:key", "částečná úprava zápisu (např. review: overeno)", async (c) => {
  const inp = await parse(V.patchOf(V.RecordIn), c);
  return tx((t) => P.patchRecord(t, c.actor, c.params.key, inp));
});
r("DELETE", "zaznamy/:key", "smazání zápisu (admin)", async (c) => tx((t) => P.deleteRecord(t, c.actor, c.params.key)));
r("PUT", "zaznamy/:key/vyrez", "obrázek výřezu (tělo = JPEG/PNG/WebP, ?varianta=web|plny)", async (c) => {
  const buf = await c.raw();
  const variant = q(c, "varianta") === "plny" ? "plny" : "web";
  return tx((t) => P.saveMedia(t, c.actor, buf, { recordKey: c.params.key, variant }));
});
r("PUT", "zaznamy/:key/zvyrazneni", "rámečky zápisu ve výřezu {boxes: [[x0,y0,x1,y1]]}", async (c) => {
  const inp = await parse(V.HighlightIn, c);
  return tx((t) => P.setHighlight(t, c.actor, c.params.key, inp));
});
r("POST", "nalez", "nález z matriky v jedné transakci (svazek, zápis, osoby, vztahy, události, deník)", async (c) => {
  const inp = await parse(V.FindingIn, c);
  return tx((t) => saveFinding(t, c.actor, inp));
});

// ---------- místa a domy ----------
r("GET", "mista", "?q= místa (i podle starých/německých názvů)", async (c) => {
  const s = q(c, "q");
  return s ? M.searchPlaces(s) : M.listPlaces();
});
r("GET", "mista/:slug", "místo s názvy, událostmi a domy", async (c) => M.getPlace(c.params.slug));
r("PUT", "mista/:slug", "založení / úprava místa", async (c) => {
  const inp = await parse(V.PlaceIn, c);
  return tx((t) => M.upsertPlace(t, c.actor, c.params.slug, inp));
});
r("PATCH", "mista/:slug", "částečná úprava místa (chybějící pole zůstanou)", async (c) => {
  const inp = await parse(V.patchOf(V.PlaceIn), c);
  return tx((t) => M.patchPlace(t, c.actor, c.params.slug, inp));
});
r("DELETE", "mista/:slug", "smazání místa (admin)", async (c) => tx((t) => M.deletePlace(t, c.actor, c.params.slug)));
r("POST", "mista/:slug/nazvy", "další název místa {name, lang}", async (c) => {
  const inp = await parse(z.object({ name: z.string(), lang: z.string().nullish(), note: z.string().nullish() }), c);
  return tx((t) => M.addPlaceName(t, c.actor, c.params.slug, inp));
});
r("DELETE", "mista/:slug/nazvy/:id", "smazání omylem přidaného názvu místa", async (c) =>
  tx((t) => M.deletePlaceName(t, c.actor, c.params.slug, Number(c.params.id))),
);
r("POST", "mista/:slug/udalosti", "událost obce {year, text}", async (c) => {
  const inp = await parse(V.PlaceEventIn, c);
  return tx((t) => M.addPlaceEvent(t, c.actor, c.params.slug, inp));
});
r("GET", "domy", "seznam domů", async () => M.listHouses());
r("GET", "domy/:key", "dům s čísly, držiteli, obyvateli a událostmi", async (c) => M.getHouse(c.params.key));
r("PUT", "domy/:key", "založení / úprava domu (seznamy se nahradí; bez certainty zůstane stávající)", async (c) => {
  const inp = await parse(V.HouseIn.extend({ certainty: V.Certainty.optional() }), c);
  return tx((t) => M.upsertHouse(t, c.actor, c.params.key, inp));
});
r("PATCH", "domy/:key", "částečná úprava domu (seznamy jen když jsou uvedené)", async (c) => {
  const inp = await parse(V.patchOf(V.HouseIn), c);
  return tx((t) => M.patchHouse(t, c.actor, c.params.key, inp));
});
r("POST", "domy", "nový dům (klíč = <místo>-<čp>)", async (c) => {
  const inp = await parse(V.HouseIn, c);
  return tx((t) => M.upsertHouse(t, c.actor, null, inp));
});
r("GET", "prijmeni", "?q= varianty příjmení", async (c) => M.listSurnameVariants(q(c, "q")));
r("POST", "prijmeni", "varianta příjmení {surname, variant}", async (c) => {
  const inp = await parse(V.SurnameVariantIn, c);
  return tx((t) => M.addSurnameVariant(t, c.actor, inp));
});

// ---------- výklad ----------
r("GET", "rody", "?pro=<osoba> rody (uložené i dopočítané) s počty otevřených vodítek a úkolů; pro= jen rody osoby a jejích předků", async (c) => {
  const { rody, graf } = await loadRody();
  const pro = q(c, "pro");
  if (pro && !graf.nodes.has(pro)) throw badRequest(`Neznámá osoba: ${pro}`);
  const order = pro ? rodyFor(graf, rody, pro) : rody.lines.map((l) => l.slug);
  const [tips, tasks] = await Promise.all([F.listTips(c.actor, { open: true, limit: 1000 }), canEdit(c.actor) ? F.listTasks({}) : []]);
  const count = (items: { personIds: string[] }[], slug: string) => items.filter((x) => rodyOfPersons(rody, x.personIds).includes(slug)).length;
  const tipItems = tips.map((t) => ({ personIds: t.persons.map((p) => p.personId) }));
  const bySlug = new Map(rody.lines.map((l) => [l.slug, l]));
  return {
    rody: order.map((slug) => ({ ...bySlug.get(slug)!, openTips: count(tipItems, slug), openTasks: count(tasks, slug) })),
    bezRodu: { openTips: tipItems.filter((x) => !rodyOfPersons(rody, x.personIds).length).length, openTasks: tasks.filter((x) => !rodyOfPersons(rody, x.personIds).length).length },
    conflicts: rody.conflicts,
  };
});
r("GET", "rody/:slug", "detail rodu: vrchol, členové", async (c) => {
  const { rody, graf } = await loadRody();
  const l = rody.lines.find((x) => x.slug === c.params.slug);
  if (!l) throw notFound(`rod ${c.params.slug}`);
  const members = [...rody.lineOf].filter(([id, s]) => s === l.slug && !graf.nodes.get(id)?.sameAsId && !graf.nodes.get(id)?.placeholder);
  return { ...l, members: members.map(([id]) => ({ id, name: graf.nodes.get(id)?.name ?? id, birthYear: graf.nodes.get(id)?.birthYear ?? null })) };
});
r("PUT", "rody/:slug", "založení / úprava rodu", async (c) => {
  const inp = await parse(V.LineIn, c);
  return tx((t) => Y.upsertLine(t, c.actor, c.params.slug, inp));
});
r("GET", "hypotezy", "hypotézy", async () => Y.listHypotheses());
r("POST", "hypotezy", "nová hypotéza", async (c) => {
  const inp = await parse(V.HypothesisIn, c);
  return tx((t) => Y.addHypothesis(t, c.actor, inp));
});
r("PATCH", "hypotezy/:id", "úprava hypotézy", async (c) => {
  const inp = await parse(V.patchOf(V.HypothesisIn), c);
  return tx((t) => Y.updateHypothesis(t, c.actor, int(c.params.id), inp));
});
r("DELETE", "hypotezy/:id", "smazání hypotézy", async (c) => tx((t) => Y.deleteHypothesis(t, c.actor, int(c.params.id))));
r("GET", "otazky", "otevřené otázky", async () => Y.listQuestions());
r("POST", "otazky", "nová otázka", async (c) => {
  const inp = await parse(V.QuestionIn, c);
  return tx((t) => Y.addQuestion(t, c.actor, inp));
});
r("PATCH", "otazky/:id", "úprava otázky (state, answer)", async (c) => {
  const inp = await parse(V.patchOf(V.QuestionIn), c);
  return tx((t) => Y.updateQuestion(t, c.actor, int(c.params.id), inp));
});
r("GET", "pribehy", "seznam příběhů", async () => Y.listStories());
r("GET", "pribehy/:slug", "příběh (markdown)", async (c) => Y.getStory(c.params.slug));
r("PUT", "pribehy/:slug", "uložení příběhu", async (c) => {
  const inp = await parse(V.StoryIn, c);
  return tx((t) => Y.upsertStory(t, c.actor, c.params.slug, inp));
});
r("DELETE", "pribehy/:slug", "smazání příběhu (admin)", async (c) => tx((t) => Y.deleteStory(t, c.actor, c.params.slug)));
r("GET", "dokumenty", "rodinné dokumenty", async () => Y.listDocuments());
r("POST", "dokumenty", "nový dokument (obrázek pak PUT dokumenty/:id/obrazek)", async (c) => {
  const inp = await parse(V.DocumentIn, c);
  return tx((t) => Y.addDocument(t, c.actor, inp));
});
r("PUT", "dokumenty/:id/obrazek", "obrázek dokumentu (tělo = obrázek)", async (c) => {
  const buf = await c.raw();
  return tx((t) => P.saveMedia(t, c.actor, buf, { documentId: int(c.params.id) }));
});
r("GET", "mapy", "historické mapy", async () => Y.listMapSheets());
r("POST", "mapy", "nová mapa", async (c) => {
  const inp = await parse(V.MapSheetIn, c);
  return tx((t) => Y.addMapSheet(t, c.actor, inp));
});
r("PUT", "mapy/:id/obrazek", "obrázek mapy (tělo = obrázek)", async (c) => {
  const buf = await c.raw();
  return tx((t) => P.saveMedia(t, c.actor, buf, { mapId: int(c.params.id) }));
});
r("GET", "nastaveni", "nastavení webu", async () => Y.getSettings());
r("PUT", "nastaveni/:key", "nastavení {value} (admin)", async (c) => {
  const inp = await parse(V.SettingIn, c);
  return tx((t) => Y.setSetting(t, c.actor, c.params.key, inp.value));
});

// ---------- fronta, deník, úkoly ----------
r("GET", "voditka", "?stav=&osoba=&rod=<slug>|bez&vetev=<kořen>&prarodic=<4–7>&otevrena=1&q= vodítka s rody (lines) jejich osob (člen vidí jen svá)", async (c) =>
  byRod(c, (personIds) =>
    F.listTips(c.actor, { status: q(c, "stav"), personId: q(c, "osoba"), personIds, open: q(c, "otevrena") === "1", q: q(c, "q"), limit: Number(q(c, "limit") ?? 200) }),
  (t) => t.persons.map((p) => p.personId)),
);
r("GET", "voditka/:id", "detail vodítka", async (c) => F.getTip(c.actor, int(c.params.id)));
r("POST", "voditka", "nové vodítko: údaj od rodiny nebo zvěst (může kdokoli přihlášený)", async (c) => {
  const inp = await parse(V.TipIn, c);
  return tx((t) => F.addTip(t, c.actor, inp));
});
r("PATCH", "voditka/:id", "stav vodítka (overuje_se, potvrzeno, vyvraceno, nelze_overit) + řešení", async (c) => {
  const inp = await parse(V.TipPatch, c);
  return tx((t) => F.updateTip(t, c.actor, int(c.params.id), inp));
});
r("GET", "denik", "?q=&osoba=&rod=<slug>|bez&vetev=<kořen>&prarodic=<4–7>&svazek=&vysledek=&limit= deník bádání (nejnovější první)", async (c) => {
  requireEdit(c.actor);
  return byRod(c, (personIds) =>
    F.listLog({ q: q(c, "q"), personId: q(c, "osoba"), personIds, volumeKey: q(c, "svazek"), result: q(c, "vysledek"), limit: Number(q(c, "limit") ?? 50) }),
  (l) => l.personIds);
});
r("POST", "denik", "záznam do deníku (i neúspěšné hledání: result=nenalezeno)", async (c) => {
  const inp = await parse(V.LogIn, c);
  return tx((t) => F.addLog(t, c.actor, inp));
});
r("PATCH", "denik/:id", "úprava záznamu deníku (uvedené personIds / recordKeys / tipIds se nahradí)", async (c) => {
  const inp = await parse(V.patchOf(V.LogIn), c);
  return tx((t) => F.updateLog(t, c.actor, int(c.params.id), inp));
});
r("GET", "ukoly", "?stav=&vse=1&rod=<slug>|bez&vetev=<kořen>&prarodic=<4–7> úkoly (výchozí: otevřené) s rody (lines) jejich osob", async (c) => {
  requireEdit(c.actor);
  return byRod(c, (personIds) => F.listTasks({ status: q(c, "stav"), all: q(c, "vse") === "1", personIds }), (t) => t.personIds);
});
r("POST", "ukoly", "nový úkol", async (c) => {
  const inp = await parse(V.TaskIn, c);
  return tx((t) => F.addTask(t, c.actor, inp));
});
r("PATCH", "ukoly/:id", "úprava úkolu", async (c) => {
  const inp = await parse(V.patchOf(V.TaskIn), c);
  return tx((t) => F.updateTask(t, c.actor, int(c.params.id), inp));
});

r("GET", "hledat", "?q= hledání ve všem", async (c) => {
  const s = q(c, "q");
  if (!s) throw badRequest("Chybí ?q=");
  return searchAll(c.actor, s);
});

// ---------- účty (admin) ----------
r("GET", "uzivatele", "žijící osoby ve stromu a jejich účty", async (c) => U.listAccounts(c.actor));
r("POST", "uzivatele", "vytvoření účtů {personIds} → jména a hesla (ukážou se jen jednou)", async (c) => {
  const inp = await parse(V.UsersIn, c);
  return tx((t) => U.createAccounts(t, c.actor, inp.personIds, inp.role));
});
r("POST", "uzivatele/:id/nove-heslo", "nové heslo (ukáže se jen jednou)", async (c) => tx((t) => U.resetPassword(t, c.actor, int(c.params.id))));
r("PATCH", "uzivatele/:id", "{disabled} zablokování účtu", async (c) => {
  const inp = await parse(z.object({ disabled: z.boolean() }), c);
  return tx((t) => U.setDisabled(t, c.actor, int(c.params.id), inp.disabled));
});

r("GET", "", "přehled API", async (c) => {
  requireAdmin(c.actor);
  return routes.map((x) => ({ method: x.method, path: `/api/v1/${x.path}`, doc: x.doc }));
});

// ---------- dispatch ----------
function match(method: string, parts: string[]): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const pp = route.path ? route.path.split("/") : [];
    if (pp.length !== parts.length) continue;
    const params: Record<string, string> = {};
    if (pp.every((p, i) => (p.startsWith(":") ? ((params[p.slice(1)] = decodeURIComponent(parts[i])), true) : p === parts[i]))) {
      return { route, params };
    }
  }
  return null;
}

export async function actorFromRequest(req: Request): Promise<Actor | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return actorFromToken(auth.slice(7).trim());
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return actorFromSession(m?.[1]);
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data ?? null), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export async function dispatch(req: Request, parts: string[]): Promise<Response> {
  try {
    const actor = await actorFromRequest(req);
    if (!actor) return json({ chyba: "Nepřihlášeno (Authorization: Bearer <token> nebo přihlášení na webu)." }, 401);
    const m = match(req.method, parts);
    if (!m) {
      const other = routes.some((x) => x.method !== req.method && match(x.method, parts));
      return json({ chyba: other ? `Metoda ${req.method} tu není.` : `Neznámá cesta /api/v1/${parts.join("/")}` }, other ? 405 : 404);
    }
    // člen rodiny smí jen číst a posílat vodítka / měnit své heslo
    if (actor.role === "member" && req.method !== "GET" && !(req.method === "POST" && m.route.path === "voditka")) {
      return json({ chyba: "Nemáte oprávnění." }, 403);
    }
    const url = new URL(req.url);
    let bodyCache: Promise<unknown> | null = null;
    const ctx: Ctx = {
      actor,
      params: m.params,
      query: url.searchParams,
      body: () =>
        (bodyCache ??= req.text().then((t) => {
          if (!t) return {};
          try {
            return JSON.parse(t);
          } catch {
            throw badRequest("Tělo požadavku není platný JSON.");
          }
        })),
      raw: async () => Buffer.from(await req.arrayBuffer()),
    };
    const out = await m.route.handler(ctx);
    return json(out, req.method === "POST" ? 201 : 200);
  } catch (e) {
    if (e instanceof ApiError) return json({ chyba: e.message, detail: e.detail }, e.status);
    // drizzle balí chybu Postgresu do .cause
    const pg = ((e as { cause?: unknown }).cause ?? e) as { code?: string; detail?: string; message?: string };
    if (pg.code === "23503") return json({ chyba: "Odkaz na neexistující záznam.", detail: pg.detail }, 400);
    if (pg.code === "23505") return json({ chyba: "Už existuje.", detail: pg.detail }, 409);
    if (pg.code === "23514") return json({ chyba: "Porušené pravidlo dat.", detail: pg.message }, 400);
    console.error(e);
    return json({ chyba: "Chyba serveru." }, 500);
  }
}

export const routeList = () => routes.map((x) => ({ method: x.method, path: x.path, doc: x.doc }));
