// Jednorázový import starého souborového formátu (tools/archiv/export_pro_import.py → JSON) do DB.
// Volné texty faktů se nezahazují: událost dostane původní text (text) a k tomu rok, místo a čp. pro výpočty a mapu.
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { person, place } from "@/db/schema";
import type { Actor } from "./actor";
import { addLog, addTask, addTip } from "./fronta";
import { addPlaceEvent, addPlaceName, upsertHouse, upsertPlace } from "./mista";
import { addCitation, addEvent, addRelation, addResidence, addSideNote, createPerson, linkRecordPerson } from "./osoby";
import { saveMedia, setHighlight, upsertRecord, upsertVolume } from "./prameny";
import { firstYear, norm, parseDate, slugify } from "./text";
import type { Tx } from "./tx";
import { addHypothesis, addMapSheet, addQuestion, setSetting, upsertLine, upsertStory } from "./vyklad";

/* eslint-disable @typescript-eslint/no-explicit-any -- tvar starých dat je volný */
type Any = any;
type Cert = "doc" | "prob" | "fam" | "mh" | "unk" | "lit";
const CERTS = new Set(["doc", "prob", "fam", "mh", "unk", "lit"]);
const cert = (s: unknown, fallback: Cert = "unk"): Cert => (typeof s === "string" && CERTS.has(s) ? (s as Cert) : fallback);

export interface ImportReport {
  counts: Record<string, number>;
  warnings: string[];
}

export async function importOld(tx: Tx, actor: Actor, data: Any): Promise<ImportReport> {
  const counts: Record<string, number> = {};
  const warnings: string[] = [];
  const inc = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);
  const warn = (w: string) => warnings.push(w);
  const root: string = data.koren;
  const O: Record<string, Any> = data.osoby.OSOBY ?? {};
  const VZ: Any[] = data.osoby.VZTAHY ?? [];

  // ---------- místa ----------
  const places = new Map<string, { slug: string; name: string; re: RegExp | null }>();
  const ensurePlace = async (name: string | null | undefined): Promise<string | null> => {
    const n = (name ?? "").trim();
    if (!n) return null;
    const slug = slugify(n);
    if (!slug) return null;
    if (!places.has(slug)) {
      await upsertPlace(tx, actor, slug, { name: n, hypothesis: false });
      places.set(slug, { slug, name: n, re: null });
      inc("místa (doplněná)");
    }
    return slug;
  };
  for (const [name, m] of Object.entries<Any>(data.mista ?? {})) {
    const slug = slugify(name);
    await upsertPlace(tx, actor, slug, {
      name,
      lat: m.lat ?? null,
      lon: m.lon ?? null,
      osm: m.osm ?? null,
      query: m.dotaz ?? null,
      pattern: m.re ?? null,
      hypothesis: !!m.hypoteza,
      description: m.popis ?? null,
    });
    let re: RegExp | null = null;
    try {
      re = m.re ? new RegExp(m.re) : null;
    } catch {
      warn(`místo ${name}: neplatný regex ${m.re}`);
    }
    places.set(slug, { slug, name, re });
    inc("místa");
  }
  for (const m of data.mista_nazvy?.mista ?? []) {
    const modern = String(m.obec ?? "");
    const first = modern.split(",")[0].trim();
    const slug = (await ensurePlace(first)) ?? null;
    if (!slug) continue;
    await tx
      .update(place)
      .set({ modernName: modern || null, estate: m.panstvi ?? null })
      .where(eq(place.slug, slug));
    for (const tvar of String(m.tvar ?? "").split("/").map((x: string) => x.replace(/\(.*?\)/g, "").trim()).filter(Boolean)) {
      await addPlaceName(tx, actor, slug, { name: tvar, note: [m.jistota && `jistota ${m.jistota}`, m.overeno].filter(Boolean).join("; ") || null });
      inc("historické názvy míst");
    }
  }
  const pv = data.prijmeni_varianty ?? {};
  if (pv.obecne_vzorce?.length) await setSetting(tx, actor, "prijmeni_vzorce", pv.obecne_vzorce);
  for (const p of pv.prijmeni ?? []) warn(`varianta příjmení nepřevedena (neznámý tvar): ${JSON.stringify(p).slice(0, 80)}`);

  // místo ve volném textu: nejdřív regex místa, pak název
  const findPlace = (text: string): string | null => {
    let best: { slug: string; at: number } | null = null;
    for (const p of places.values()) {
      const m = p.re ? text.match(p.re) : null;
      const at = m?.index ?? text.indexOf(p.name);
      if (at >= 0 && (!best || at < best.at)) best = { slug: p.slug, at };
    }
    return best?.slug ?? null;
  };

  // ---------- svazky a zápisy ----------
  for (const [key, v] of Object.entries<Any>(data.svazky ?? {})) {
    const title: string = v.svazek ?? key;
    const kind = title.match(/^(NOZ|NO|NZ|OZ|N|O|Z|I)\b/)?.[1] ?? null;
    const years = [...title.matchAll(/\b(1[5-9]\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
    await upsertVolume(tx, actor, key, {
      archive: v.archiv || "?",
      portal: v.portal ?? null,
      title,
      description: v.popis ?? null,
      url: v.url ?? null,
      kind,
      yearFrom: years[0] ?? null,
      yearTo: years[1] ?? years[0] ?? null,
    });
    inc("svazky");
  }
  const vyrezy = new Set<string>(data.vyrezy ?? []);
  const zdroje = new Set<string>(data.zdroje ?? []);
  const recKind = new Map<string, { kind: string; year: number | null }>();
  for (const z of data.zaznamy ?? []) {
    const key: string = z.klic;
    if (z.svazek && !(z.svazek in (data.svazky ?? {}))) {
      await upsertVolume(tx, actor, z.svazek, { archive: "?", title: z.svazek });
      warn(`svazek ${z.svazek} chyběl ve svazky.json – založen prázdný`);
    }
    const pr = data.prepisy?.[key] ?? {};
    await upsertRecord(tx, actor, key, {
      volumeKey: z.svazek || null,
      imageNo: Number.isInteger(z.snimek) && z.snimek > 0 ? z.snimek : null,
      kind: z.druh,
      dateText: z.datum ?? null,
      title: z.nazev ?? key,
      summary: z.shrnuti ?? "",
      url: z.odkaz ?? null,
      transcriptOrig: pr.orig ?? null,
      transcriptCs: pr.cs ?? null,
      review: "overeno", // ve starém postupu šlo do dat až po kontrole
    });
    recKind.set(key, { kind: z.druh, year: firstYear(z.datum) });
    const hl = data.zvyrazneni?.[key];
    if (hl?.boxes?.length) await setHighlight(tx, actor, key, { boxes: hl.boxes, status: hl.status ?? null, note: hl.note || null });
    for (const [dir, set, variant] of [["vyrezy", vyrezy, "web"], ["zdroje", zdroje, "plny"]] as const) {
      if (set.has(`${key}.jpg`)) {
        await saveMedia(tx, actor, fs.readFileSync(path.join(root, dir, `${key}.jpg`)), { recordKey: key, variant });
        inc(`obrázky ${variant}`);
      }
    }
    if (!vyrezy.has(`${key}.jpg`) && !zdroje.has(`${key}.jpg`)) warn(`zápis ${key}: chybí výřez`);
    inc("zápisy");
  }
  const hasRecord = (k: string) => recKind.has(k);

  // ---------- osoby ----------
  const sideNodes = new Set(Object.entries<Any>(O).filter(([, d]) => d.druh === "bocni").map(([id]) => id));
  const nameOf = new Map<string, string>();
  for (const [id, d] of Object.entries<Any>(O)) {
    if (sideNodes.has(id)) continue;
    const raw: string = d.n ?? id;
    const unsure = /\(\?\)/.test(raw);
    const extra = [...raw.matchAll(/\(([^)?][^)]*)\)/g)].map((m) => m[1].trim());
    const clean = raw.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    const parts = clean.split(" ");
    const placeholder = /neuveden|^\?$/i.test(raw) || /neuveden/.test(id);
    const surname = parts.length > 1 ? parts[parts.length - 1] : "";
    const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "";
    const variants = extra.filter((x) => !/nečiteln|doplní|neuveden/.test(x));
    const nameNote = extra.filter((x) => /nečiteln|doplní/.test(x)).join("; ") || null;
    await createPerson(tx, actor, {
      id,
      sex: d.sex === "F" ? "F" : d.sex === "M" ? "M" : "U",
      given,
      surname,
      certainty: cert(d.st),
      living: /^žijící/i.test(String(d.note ?? "")) ? true : null,
      yearsText: d.y || null,
      note: [d.note, nameNote && `Jméno: ${nameNote}`].filter(Boolean).join(" ") || null,
      placeholder,
      names: variants.map((v) => {
        const p = v.split(" ");
        return { given: p.length > 1 ? p.slice(0, -1).join(" ") : v, surname: p.length > 1 ? p[p.length - 1] : "", kind: "varianta" as const, isPrimary: false, certainty: "unk" as const };
      }),
      events: [],
      sources: [],
    });
    if (unsure) {
      await tx.execute(sql`update person_name set certainty = 'prob', note = 'čtení nejisté' where person_id = ${id} and is_primary`);
    }
    nameOf.set(id, clean);
    inc("osoby");
  }
  for (const [id, d] of Object.entries<Any>(O)) {
    if (d.tataz && !sideNodes.has(id)) await tx.update(person).set({ sameAsId: d.tataz }).where(eq(person.id, id));
  }

  // fakta → události
  const SIGN: Record<string, "narozeni" | "umrti" | "snatek"> = { "*": "narozeni", "†": "umrti", "×": "snatek" };
  const DATE = /^((?:asi |kolem |cca |před |po |~\s?)?(?:\d{1,2}\.\s*(?:\d{1,2}|\?)\.\s*)?(?:\d{1,2}\/)?(?:1[0-9]{3}|20[0-9]{2})(?:\s*[–-]\s*(?:1[0-9]{3}|20[0-9]{2}))?)/;
  const KIND_FOR: Record<string, string[]> = { narozeni: ["N"], krest: ["N"], snatek: ["O"], umrti: ["Z"], pohreb: ["Z"] };
  const ROLE_FOR = (type: string, sex: string) =>
    type === "snatek" ? (sex === "F" ? "nevesta" : "zenich") : type === "umrti" || type === "pohreb" ? "zemrely" : "dite";
  const marriageYears = new Map<string, Set<number>>(); // sňatky z faktů (kvůli duplicitám z hran)
  for (const [id, d] of Object.entries<Any>(O)) {
    if (sideNodes.has(id)) continue;
    const refs: string[] = (d.r ?? []).filter((k: string) => {
      if (!hasRecord(k)) warn(`osoba ${id}: neznámý zápis ${k}`);
      return hasRecord(k);
    });
    const used = new Set<string>();
    for (const f of d.f ?? []) {
      const fact = String(f).trim();
      if (!fact) continue;
      const type0: string | undefined = SIGN[fact[0]];
      const type = type0 ?? (/^pokř/i.test(fact) ? "krest" : /^pohřb/i.test(fact) ? "pohreb" : "jine");
      const body = type0 ? fact.slice(1).trim() : fact;
      const dateText = type === "jine" ? null : (body.match(DATE)?.[1]?.trim() ?? null);
      const pd = parseDate(dateText ?? (type === "jine" ? null : body));
      const year = pd.yearFrom ?? (type === "jine" ? firstYear(body) : null);
      const placeSlug = type === "jine" ? null : findPlace(body);
      if (type === "snatek" && year) marriageYears.set(id, (marriageYears.get(id) ?? new Set()).add(year));
      // zdroj: zápis osoby odpovídajícího druhu a roku
      const kinds = KIND_FOR[type] ?? [];
      const rec = refs.find((k) => !used.has(k) && kinds.includes(recKind.get(k)!.kind) && (!year || !recKind.get(k)!.year || Math.abs(recKind.get(k)!.year! - year) <= 1));
      if (rec) used.add(rec);
      const ev = await addEvent(tx, actor, {
        type: type as never,
        dateText,
        yearFrom: year,
        yearTo: pd.yearTo,
        month: pd.month,
        day: pd.day,
        dateQual: pd.dateQual,
        placeSlug,
        text: body, // původní text faktu (web ho ukazuje beze změny)
        certainty: rec ? "doc" : cert(d.st),
        persons: [{ personId: id, role: "hlavni" }],
        sources: [],
      });
      if (rec) {
        await addCitation(tx, actor, { eventId: ev.id, recordKey: rec });
        await linkRecordPerson(tx, rec, id, ROLE_FOR(type, d.sex));
      }
      inc("události");
    }
    // zbylé zápisy osoby: zmínka
    for (const k of refs) if (!used.has(k)) await addCitation(tx, actor, { personId: id, recordKey: k });
    // bydliště
    for (const b of d.bydliste ?? []) {
      const slug = await ensurePlace(b.obec);
      const cp = b.cp ? String(b.cp) : null;
      // dům se doplní až po importu domů (SQL níže)
      await addResidence(tx, actor, {
        personId: id,
        placeSlug: slug,
        placeText: b.obec ?? null,
        cp,
        fromText: b.od != null ? String(b.od) : null,
        toText: b.do != null ? String(b.do) : null,
        role: b.role ?? null,
        certainty: String(b.obec ?? "").includes("(?)") ? "prob" : cert(d.st),
        sources: (b.zdroj ?? []).filter((k: string) => hasRecord(k)).map((k: string) => ({ recordKey: k })),
      });
      inc("bydliště");
    }
  }

  // ---------- vztahy ----------
  for (const e of VZ) {
    const refs: string[] = (e.r ?? []).filter((k: string) => hasRecord(k));
    if (e.t === "rodic" || e.t === "manzele") {
      if (sideNodes.has(e.a) || sideNodes.has(e.b)) continue;
      const certainty = cert(e.st, refs.length ? "doc" : cert(O[e.b]?.st));
      try {
        await addRelation(tx, actor, { type: e.t, aId: e.a, bId: e.b, certainty, note: e.note ?? null, sources: refs.map((k) => ({ recordKey: k })) });
        const y = firstYear(String(e.datum ?? ""));
        // datum sňatku z hrany jen tam, kde ho manželé nemají jako fakt
        if (e.t === "manzele" && e.datum && !(y && (marriageYears.get(e.a)?.has(y) || marriageYears.get(e.b)?.has(y)))) {
          await addEvent(tx, actor, {
            type: "snatek",
            dateText: String(e.datum),
            certainty,
            persons: [
              { personId: e.a, role: O[e.a]?.sex === "F" ? "nevesta" : "zenich" },
              { personId: e.b, role: O[e.b]?.sex === "F" ? "nevesta" : "zenich" },
            ],
            sources: refs.map((k) => ({ recordKey: k })),
          });
          inc("sňatky z hran");
        }
        inc(e.t === "rodic" ? "vztahy rodič" : "vztahy manželé");
      } catch (err) {
        warn(`vztah ${e.t} ${e.a} → ${e.b}: ${(err as Error).message}`);
      }
    } else if (e.t === "kmotr" || e.t === "svedek") {
      if (!refs.length) warn(`${e.t} ${e.a} (u ${e.b}) bez zápisu – jen jako vztah se nepřevádí`);
      for (const k of refs) await linkRecordPerson(tx, k, e.a, e.t);
      inc(`role ${e.t}`);
    } else if (e.t === "pribuzny") {
      const d = O[e.a]?.druh === "bocni" ? O[e.a] : O[e.b];
      const target = O[e.a]?.druh === "bocni" ? e.b : e.a;
      if (d) await addSideNote(tx, actor, target, d.n ?? "Další příbuzní", d.t ?? "");
      inc("boční souhrny");
    }
  }

  // ---------- rody, kořen, hypotézy, otázky ----------
  for (const [slug, l] of Object.entries<Any>(data.osoby.RODY ?? {})) {
    await upsertLine(tx, actor, slugify(slug), { name: l.nazev, description: l.popis ?? null, founderId: l.zakladatel ?? null });
    inc("rody");
  }
  const koreny = data.osoby.KORENY ?? {};
  if (koreny.hlavni) await setSetting(tx, actor, "vychozi_koren", koreny.hlavni);
  for (const h of data.osoby.HYPOTEZY ?? []) {
    await addHypothesis(tx, actor, {
      personId: h.rod ?? null,
      title: h.nadpis,
      text: h.text ?? "",
      items: (h.polozky ?? []).map(([name, text]: [string, string]) => ({ name, text })),
      recordKeys: (h.zaznamy ?? []).filter(hasRecord),
    });
    inc("hypotézy");
  }
  for (const [q, a] of [...(data.osoby.ISSUES ?? []), ...(data.domy.ISSUES ?? [])]) {
    const state = /^vyřešeno/i.test(a) ? "vyreseno" : /^hypotéza/i.test(a) ? "hypoteza" : "otevrene";
    await addQuestion(tx, actor, { question: q, answer: a || null, state });
    inc("otázky");
  }

  // ---------- domy ----------
  const D = data.domy ?? {};
  const obec0 = D.OBEC?.nazev || null;
  for (const u of D.OBEC_UDALOSTI ?? []) {
    const slug = await ensurePlace(obec0);
    if (slug) await addPlaceEvent(tx, actor, slug, { year: Number(u.rok) || null, text: u.text, certainty: cert(u.st), recordKey: (u.r ?? [])[0] ?? null });
  }
  const firstRec = (r: string[] | undefined) => (r ?? []).find(hasRecord) ?? null;
  const moreRecs = (r: string[] | undefined) => (r ?? []).filter(hasRecord).slice(1);
  for (const [key, h] of Object.entries<Any>(D.D ?? {})) {
    const slug = await ensurePlace(h.obec || obec0 || key.replace(/\s*\d+$/, ""));
    if (!slug) {
      warn(`dům ${key}: neznámá obec`);
      continue;
    }
    await upsertHouse(tx, actor, null, {
      placeSlug: slug,
      cp: String(h.cp ?? key.match(/(\d+)$/)?.[1] ?? key),
      name: h.nazev || null,
      kind: h.druh || null,
      description: h.popis || null,
      lat: h.lat ?? null,
      lon: h.lon ?? null,
      certainty: cert(h.st),
      note: h.note || null,
      numbers: (h.cisla ?? []).map(([period, number]: [string, string]) => ({ period: String(period), number: String(number) })),
      events: (h.udalosti ?? []).map((u: Any) => ({ year: Number(u.rok) || null, text: u.text, certainty: cert(u.st), recordKey: firstRec(u.r), moreRecordKeys: moreRecs(u.r) })),
      holders: (h.drzitele ?? []).map((o: Any) => ({
        name: o.n,
        personId: o.o && O[o.o] ? o.o : null,
        fromText: o.od && o.od !== "?" ? String(o.od) : null,
        toText: o.do ? String(o.do) : null,
        how: o.jak || null,
        note: o.note || null,
        certainty: cert(o.st),
        recordKey: firstRec(o.r),
        moreRecordKeys: moreRecs(o.r),
      })),
      inhabitants: (h.obyvatele ?? []).map((o: Any) => ({
        name: o.n,
        personId: o.o && O[o.o] ? o.o : null,
        yearsText: o.y || null,
        role: o.role || null,
        facts: Array.isArray(o.f) ? o.f.join("; ") : o.f || null,
        certainty: cert(o.st),
        recordKey: firstRec(o.r),
        moreRecordKeys: moreRecs(o.r),
      })),
    });
    inc("domy");
  }
  // bydliště a události u domů, které vznikly až teď
  await tx.execute(sql`update residence r set house_key = h.key from house h where r.house_key is null and r.place_slug = h.place_slug and r.cp = h.cp`);
  await tx.execute(sql`update event e set house_key = h.key from house h
    where e.house_key is null and e.place_slug = h.place_slug and e.text ~ ('čp\\.\\s*' || h.cp || '([^0-9]|$)')`);

  // ---------- mapy a dokumenty ----------
  for (const m of data.mapy ?? []) {
    const ms = await addMapSheet(tx, actor, {
      title: m.nazev,
      year: Number(m.rok) || null,
      url: m.url ?? null,
      source: m.zdroj ?? null,
      description: m.popis ?? null,
      groupName: m.skupina ?? m.obec ?? null,
    });
    const file = [["zdroje", zdroje], ["vyrezy", vyrezy]].find(([, s]) => (s as Set<string>).has(`${m.img}.jpg`));
    if (file) await saveMedia(tx, actor, fs.readFileSync(path.join(root, file[0] as string, `${m.img}.jpg`)), { mapId: ms.id, variant: "plny" });
    else warn(`mapa ${m.img}: chybí obrázek`);
    inc("mapy");
  }
  if ((data.dokumenty ?? []).length) warn(`dokumenty.json má ${data.dokumenty.length} položek – nepřevedeny (zatím prázdné vzory)`);

  // ---------- nastavení a příběhy ----------
  const web = data.web ?? {};
  for (const k of ["nazev", "popis", "zapati", "kontakt", "uvod", "pribeh", "zajimavosti_na_uvodu"]) {
    if (web[k] !== undefined) await setSetting(tx, actor, k, web[k]);
  }
  if (data.web_domy && Object.keys(data.web_domy).length) await setSetting(tx, actor, "web_domy", data.web_domy);
  const md: Record<string, string | null> = data.md ?? {};
  const story = async (slug: string, file: string, kind: "pribeh" | "zajimavosti", fallback: string, sort: number) => {
    const src = md[file];
    if (!src) return;
    const fm = src.match(/^---\n([\s\S]*?)\n---\n?/);
    const meta: Record<string, string> = {};
    for (const line of fm?.[1].split("\n") ?? []) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2];
    }
    const body = (fm ? src.slice(fm[0].length) : src).replace(/<!--[\s\S]*?-->/g, "").replace(/^# .*\n+/, "").trim();
    await upsertStory(tx, actor, slug, { kind, title: meta.title || fallback, lead: meta.lead || null, bodyMd: body, sort });
    inc("příběhy");
  };
  await story("pribeh", "pribeh.md", "pribeh", web.pribeh?.menu || "Příběh rodu", 0);
  let i = 1;
  for (const p of web.pribehy ?? []) await story(slugify(p.slug), p.soubor, "pribeh", p.titulek, i++);
  await story("zajimavosti", "zajimavosti.md", "zajimavosti", "Zajímavosti", 99);

  // ---------- deník ----------
  const volumes = new Set(Object.keys(data.svazky ?? {}));
  // číslo knihy z názvu svazku („… (kniha 6336)“) → klíč svazku; deník cituje knihy i id portálu
  const byBook = new Map<string, string>();
  for (const [k, v] of Object.entries<Any>(data.svazky ?? {})) {
    for (const m of String(v.svazek ?? "").matchAll(/kniha\s+(\d+[a-z]?)/gi)) byBook.set(m[1], k);
  }
  // jednoznačná celá jména osob (stejné jméno víckrát = nepropojovat, ať deník neukazuje na špatného člověka)
  const nameCount = new Map<string, string[]>();
  for (const [id, n] of nameOf) if (n.split(" ").length >= 2) nameCount.set(norm(n), [...(nameCount.get(norm(n)) ?? []), id]);
  const recPersons = new Map<string, string[]>();
  for (const [id, d] of Object.entries<Any>(O)) for (const k of d.r ?? []) recPersons.set(k, [...(recPersons.get(k) ?? []), id]);
  for (const line of (md["research_log.md"] ?? "").split("\n")) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 7 || !/^\d+$/.test(cells[0])) continue;
    const [num, datum, zdroj, rozsah, hledano, vysledek, citace] = cells;
    const v = norm(vysledek);
    const result = /^nalezen|^nalezeno|^ano\b/.test(v) ? "nalezeno" : /nenalezen|^ne\b|neni |nedohled|negativni|^0 /.test(v) ? "nenalezeno" : /castecn/.test(v) ? "castecne" : "jine";
    const nums = [...zdroj.matchAll(/\b(\d{3,6})\b/g)].map((m) => m[1]);
    const volumeKey =
      nums.flatMap((n) => [`mza_${n}`, `trebon_${n}`, `ebad_${n}`, `pf_${n}`]).find((k) => volumes.has(k)) ??
      [...zdroj.matchAll(/\b(\d{3,6}[a-z]?)\b/g)].map((m) => byBook.get(m[1])).find(Boolean) ??
      null;
    const recordKeys = [...new Set((citace.match(/[a-z]-[a-z0-9-]+/g) ?? []).filter(hasRecord))];
    const txt = norm(`${hledano} ${vysledek}`);
    const personIds = [
      ...new Set([
        ...[...nameCount].filter(([n, ids]) => ids.length === 1 && txt.includes(n)).map(([, ids]) => ids[0]),
        ...recordKeys.flatMap((k) => recPersons.get(k) ?? []),
      ]),
    ];
    await addLog(tx, actor, {
      at: new Date(`${datum}T12:00:00Z`),
      author: "deník (import)",
      title: `${hledano && hledano !== "–" ? hledano : zdroj}`.slice(0, 300),
      textMd: [`**Zdroj:** ${zdroj}`, `**Výsledek:** ${vysledek}`, citace && citace !== "–" ? `**Citace:** ${citace}` : "", `(starý deník č. ${num})`].filter(Boolean).join("\n\n"),
      volumeKey,
      pages: rozsah && rozsah !== "–" ? rozsah : null,
      result: result as never,
      personIds,
      recordKeys,
      tipIds: [],
    });
    inc("deník");
  }

  // ---------- úkoly (STAV.md, archivni_dotazy.md) ----------
  const stav = md["STAV.md"] ?? "";
  const rozpr = stav.split(/^## Rozpracováno.*$/m)[1] ?? "";
  const kroky = rozpr.split(/\*\*DALŠÍ KROKY:\*\*/)[1]?.split(/\n\*\*/)[0] ?? "";
  for (const b of kroky.split("\n").filter((l) => l.startsWith("- "))) {
    await addTask(tx, actor, { title: b.slice(2).split(/ – | \(|; /)[0].trim().slice(0, 140), body: b.slice(2), kind: "badani", status: "otevreny", priority: 1, personIds: [] });
    inc("úkoly");
  }
  if (rozpr.trim()) {
    await addTask(tx, actor, { title: "Přehled linií a technické poznámky (ze STAV.md)", body: rozpr.trim(), kind: "poznamky", status: "otevreny", priority: 3, personIds: [] });
    inc("úkoly");
  }
  for (const b of (md["archivni_dotazy.md"] ?? "").split("\n").filter((l) => l.startsWith("- "))) {
    const done = /~~|VYŘEŠENO/.test(b);
    const title = b.slice(2).replace(/~~|\*\*/g, "").split(/ – /)[0].trim().slice(0, 140);
    await addTask(tx, actor, { title, body: b.slice(2), kind: "archivni_dotaz", status: done ? "hotovy" : "otevreny", priority: 2, personIds: [] });
    inc("úkoly");
  }

  // ---------- údaje od rodiny → vodítka ----------
  const fam = md["udaje_od_rodiny.md"] ?? "";
  const people = [...nameOf].filter(([, n]) => n.split(" ").length >= 2);
  for (const sec of fam.split(/^## /m).slice(1)) {
    const [head, ...rest] = sec.split("\n");
    const text = rest.join("\n").trim();
    if (!text) continue;
    const date = head.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const who = head.replace(/^\d{4}-\d{2}-\d{2}\s*–\s*/, "").replace(/\(.*$/, "").replace(/,.*$/, "").trim();
    const channel = head.match(/\(([^)]*)\)/)?.[1] ?? head.split(",").slice(1).join(",").trim() ?? null;
    const about = people.filter(([, n]) => text.includes(n)).map(([id]) => id);
    const teller = people.find(([, n]) => who.includes(n))?.[0] ?? null;
    await addTip(tx, actor, {
      kind: "od_rodiny",
      text: `${head.trim()}\n\n${text}`,
      personIds: [...new Set(about)],
      toldByPersonId: teller,
      toldByName: who || null,
      channel: channel || null,
      receivedAt: date ? new Date(`${date}T12:00:00Z`) : undefined,
      sensitive: /citliv|kontakt/i.test(sec),
    });
    inc("vodítka");
  }
  const unseen = [...new Set(VZ.map((e) => e.t))].filter((t) => !["rodic", "manzele", "kmotr", "svedek", "pribuzny"].includes(t));
  if (unseen.length) warn(`neznámé typy hran: ${unseen.join(", ")}`);
  const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from record`)).rows;
  counts["zápisy v DB"] = n;
  return { counts, warnings };
}

// tabulky s daty rodokmenu (bez účtů a tokenů) – pro opakovaný zkušební import
export const DATA_TABLES = [
  "citation", "event_person", "event", "residence", "record_person", "highlight", "media", "hypothesis_record", "hypothesis",
  "question", "story", "tip_record", "tip_person", "research_log_tip", "research_log_record", "research_log_person", "research_log",
  "tip", "task_person", "task", "document_person", "document_house", "document", "map_sheet", "house_number", "house_event",
  "house_holder", "house_inhabitant", "house", "place_event", "place_name", "surname_variant", "line", "side_note", "relation",
  "person_name", "record", "volume", "setting", "change_log", "session", "user_account", "person", "place",
];
