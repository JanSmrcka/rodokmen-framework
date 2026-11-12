// Rody: jedno pravidlo pro všechny (nezávisí na přihlášeném).
// Vrchol osoby = nejvyšší známý předek po meči (bez otce po matce, jen když nese její příjmení – nemanželské dítě).
// Rod má každý vrchol (aspoň se 2 členy linie), ke kterému vede některý předek žijící osoby do pradědů (Kekule 2–15), nebo uložený rod
// (tabulka line; zakladatel může stát kdekoli na linii). Osoba patří do rodu svého vrcholu; jinak (staří předci
// přes ženské linie) do rodu nejbližšího potomka, který rod má; jinak je bez rodu.
import { db } from "@/db";
import { line, setting } from "@/db/schema";
import { dataVersion } from "./audit";
import { loadGraf, type Graf } from "./graf";

export interface StoredLine {
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  founderId: string | null;
}

export interface Rod {
  slug: string;
  name: string;
  description: string;
  color: string | null;
  founderId: string; // uložený zakladatel, u dopočítaného rodu vrchol
  topId: string;
  auto: boolean;
  size: number;
}

export interface Rody {
  lines: Rod[];
  lineOf: Map<string, string>;
  conflicts: string[];
}

const SOFT: Record<string, string> = { n: "ň", d: "ď", t: "ť" };

// „Novákové“, „Horákové“, „Bílí“, „Staňkové“ z příjmení (ženské tvary převede na mužský základ)
export function rodName(surname: string): string {
  let s = surname.trim();
  if (!s) return "Rod bez příjmení";
  if (/ová$/.test(s)) {
    s = s.slice(0, -3);
    // Staňková → Staněk, Hájková → Hájek (vrátit vypuštěné e)
    if (/ňk$/.test(s)) s = `${s.slice(0, -2)}něk`;
    else if (/[ďť]k$/.test(s)) s = `${s.slice(0, -2)}${s.at(-2) === "ď" ? "d" : "t"}ěk`;
  } else if (/[áý]$/.test(s)) return `${s.slice(0, -1)}í`;
  if (/[ůíieouy]$/.test(s) || /ých$/.test(s)) return `Rod ${surname}`;
  if (/a$/.test(s)) return `${s.slice(0, -1)}ové`;
  // vypouštěné e: Staněk → Staňkové, Hájek → Hájkové (krátká jména jako Šek ne)
  const m = s.match(/^(.{2,}?)([^aeiouyáéíóúůýě])(ě|e)k$/i);
  if (m) return `${m[1]}${m[3] === "ě" ? (SOFT[m[2]] ?? m[2]) : m[2]}kové`;
  return `${s}ové`;
}

// linie od osoby k vrcholu (po otci; bez otce po matce se stejným příjmením)
export function chainOf(g: Graf, id: string): string[] {
  const out = [g.main(id)];
  const seen = new Set(out);
  const surname = (x: string) => rodName(g.nodes.get(x)?.surname ?? "");
  for (;;) {
    const cur = out[out.length - 1];
    const { father, mother } = g.parents(cur);
    const next = father ?? (mother && g.nodes.get(cur)?.surname && surname(mother) === surname(cur) ? mother : null);
    if (!next || seen.has(g.main(next))) return out;
    out.push(g.main(next));
    seen.add(g.main(next));
  }
}

export const topOf = (g: Graf, id: string) => chainOf(g, id).at(-1)!;

export function computeRody(g: Graf, stored: StoredLine[], extraRoots: string[] = []): Rody {
  const rody = new Map<string, Rod>();
  const byTop = new Map<string, string>();
  const conflicts: string[] = [];

  for (const l of [...stored].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const founder = l.founderId && g.nodes.has(l.founderId) ? g.main(l.founderId) : null;
    const top = founder ? topOf(g, founder) : "";
    rody.set(l.slug, { slug: l.slug, name: l.name, description: l.description ?? "", color: l.color, founderId: founder ?? "", topId: top, auto: false, size: 0 });
    if (!top) continue;
    if (byTop.has(top)) conflicts.push(`rod ${l.slug} je stejná linie jako ${byTop.get(top)} (vrchol ${top})`);
    else byTop.set(top, l.slug);
  }

  // velikost linie podle vrcholu (bez placeholderů) – samotná přivdaná žena bez rodičů vlastní rod nedostane
  const mains = [...g.nodes.values()].filter((n) => !n.sameAsId).map((n) => n.id);
  const lineSize = new Map<string, number>();
  for (const id of mains) if (!g.nodes.get(id)!.placeholder) lineSize.set(topOf(g, id), (lineSize.get(topOf(g, id)) ?? 0) + 1);

  const roots = new Set(extraRoots.filter((r) => g.nodes.has(r)).map((r) => g.main(r)));
  for (const n of g.nodes.values()) if (n.living && !n.placeholder && !n.sameAsId) roots.add(n.id);
  for (const r of roots) {
    for (const [id, k] of g.kekuleIndex(r)) {
      if (k < 2 || k > 15) continue;
      const chain = chainOf(g, id);
      const top = chain.at(-1)!;
      if (byTop.has(top) || (lineSize.get(top) ?? 0) < 2) continue;
      // jméno podle nejvyššího člena linie se jménem (vrchol bývá „neznámý otec“)
      const named = [...chain].reverse().find((x) => !g.nodes.get(x)?.placeholder && g.nodes.get(x)?.surname);
      const slug = `rod-${top}`;
      rody.set(slug, { slug, name: rodName(named ? g.nodes.get(named)!.surname : ""), description: "", color: null, founderId: top, topId: top, auto: true, size: 0 });
      byTop.set(top, slug);
    }
  }

  // členství: vrchol, jinak nejbližší potomek s rodem
  const lineOf = new Map<string, string>();
  for (const id of mains) {
    const s = byTop.get(topOf(g, id));
    if (s) lineOf.set(id, s);
  }
  const direct = new Map(lineOf);
  for (const id of mains) {
    if (lineOf.has(id)) continue;
    let best: [number, string] | null = null;
    for (const [d, dist] of g.descendants(id)) {
      const s = direct.get(d);
      if (s && (!best || dist < best[0])) best = [dist, s];
    }
    if (best) lineOf.set(id, best[1]);
  }
  for (const n of g.nodes.values()) if (n.sameAsId && lineOf.has(g.main(n.id))) lineOf.set(n.id, lineOf.get(g.main(n.id))!);

  // stejné jméno u dvou dopočítaných rodů → doplnit vrchol
  const names = new Map<string, number>();
  for (const r of rody.values()) names.set(r.name, (names.get(r.name) ?? 0) + 1);
  for (const r of rody.values()) if (r.auto && names.get(r.name)! > 1) r.name = `${r.name} (${g.nodes.get(r.topId)?.name ?? r.topId})`;

  for (const [id, s] of lineOf) {
    const n = g.nodes.get(id);
    if (n && !n.placeholder && !n.sameAsId) rody.get(s)!.size++;
  }
  return { lines: [...rody.values()].sort((a, b) => a.slug.localeCompare(b.slug)), lineOf, conflicts };
}

// rody osoby: její vlastní a rody všech jejích předků (pořadí od nejbližších)
export function rodyFor(g: Graf, r: Rody, id: string): string[] {
  const out: string[] = [];
  const kek = [...g.kekuleIndex(id)].sort((a, b) => a[1] - b[1]);
  for (const [p] of kek) {
    const s = r.lineOf.get(p);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

// rody osob (pořadí podle prvního výskytu)
export function rodyOfPersons(r: Rody, ids: string[]): string[] {
  return [...new Set(ids.map((id) => r.lineOf.get(id)).filter((s): s is string => !!s))];
}

let cache: { version: number; rody: Rody; graf: Graf } | null = null;

export async function loadRody(): Promise<{ rody: Rody; graf: Graf }> {
  const d = db();
  const version = await dataVersion(d);
  if (cache && cache.version === version) return cache;
  const [graf, stored, root] = await Promise.all([loadGraf(), d.select().from(line), d.select().from(setting)]);
  const koren = root.find((s) => s.key === "vychozi_koren")?.value;
  const rody = computeRody(graf, stored, typeof koren === "string" ? [koren] : []);
  cache = { version, rody, graf };
  return cache;
}

// Větve podle prarodičů kořene (Kekule 4–7): prarodič, jeho předci a všichni jejich potomci (boční linie,
// přivdaní předci). Kořen, rodiče a jejich potomci (sourozenci, děti) do žádné větve nepatří – jsou společní.
export function vetve(g: Graf, root: string): Map<number, Set<string>> {
  const r = g.main(root);
  const kek = g.kekule(r);
  const near = new Set([r]);
  for (const k of [2, 3]) {
    const p = kek.get(k);
    if (!p) continue;
    near.add(p);
    for (const d of g.descendants(p).keys()) near.add(d);
  }
  const out = new Map<number, Set<string>>();
  for (let k = 4; k <= 7; k++) {
    const gp = kek.get(k);
    if (!gp) continue;
    const clan = new Set<string>();
    for (const a of [gp, ...g.ancestors(gp).keys()]) {
      clan.add(a);
      for (const d of g.descendants(a).keys()) if (!near.has(d)) clan.add(d);
    }
    out.set(k, clan);
  }
  return out;
}
