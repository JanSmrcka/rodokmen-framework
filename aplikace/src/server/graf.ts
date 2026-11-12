// Graf osob v paměti (port tools/graf.py). Osob jsou stovky, takže se načtou všechny osoby a hrany
// jedním dotazem a výsledek se drží, dokud se data nezmění (verze = poslední id v change_log).
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { event, eventPerson, person, personName, relation } from "@/db/schema";
import { dataVersion } from "./audit";

export interface GNode {
  id: string;
  name: string;
  given: string;
  surname: string;
  sex: "M" | "F" | "U";
  certainty: string;
  yearsText: string | null;
  sameAsId: string | null;
  placeholder: boolean;
  livingFlag: boolean | null;
  birthYear: number | null;
  deathYear: number | null;
  living: boolean;
}

export interface GEdge {
  id: number;
  type: "rodic" | "manzele";
  a: string;
  b: string;
  certainty: string;
  end?: string | null; // konec manželství pro výpis („rozvedeni 1935“)
}

const END_LABEL: Record<string, string> = { rozvod: "rozvedeni", rozluka: "rozluka", jine: "manželství skončilo" };

export class Graf {
  readonly nodes = new Map<string, GNode>();
  readonly parentsOf = new Map<string, string[]>();
  readonly childrenOf = new Map<string, string[]>();
  readonly spousesOf = new Map<string, string[]>();

  constructor(
    nodes: GNode[],
    readonly edges: GEdge[],
  ) {
    for (const n of nodes) this.nodes.set(n.id, n);
    const push = (m: Map<string, string[]>, k: string, v: string) => {
      const l = m.get(k);
      if (l) {
        if (!l.includes(v)) l.push(v);
      } else m.set(k, [v]);
    };
    for (const e of edges) {
      if (e.type === "rodic") {
        push(this.parentsOf, e.b, e.a);
        push(this.childrenOf, e.a, e.b);
      } else {
        push(this.spousesOf, e.a, e.b);
        push(this.spousesOf, e.b, e.a);
      }
    }
  }

  // tentýž člověk zapsaný podruhé → hlavní záznam
  main(id: string): string {
    const seen = new Set<string>();
    let cur = id;
    while (this.nodes.get(cur)?.sameAsId && !seen.has(cur)) {
      seen.add(cur);
      cur = this.nodes.get(cur)!.sameAsId!;
    }
    return cur;
  }

  // (otec, matka) podle pohlaví
  parents(id: string): { father: string | null; mother: string | null } {
    let father: string | null = null;
    let mother: string | null = null;
    for (const p of this.parentsOf.get(id) ?? []) {
      const s = this.nodes.get(p)?.sex;
      if (s === "F") mother ??= p;
      else father ??= p;
    }
    return { father, mother };
  }
  children(id: string) {
    return this.childrenOf.get(id) ?? [];
  }
  spouses(id: string) {
    return this.spousesOf.get(id) ?? [];
  }
  // sourozenci = kdokoli se společným rodičem
  siblings(id: string): string[] {
    const out = new Set<string>();
    for (const p of this.parentsOf.get(id) ?? []) for (const c of this.children(p)) if (c !== id) out.add(c);
    return [...out];
  }

  // předci s nejmenší vzdáleností v generacích
  ancestors(id: string): Map<string, number> {
    const dist = new Map<string, number>([[id, 0]]);
    let frontier = [id];
    while (frontier.length) {
      const next: string[] = [];
      for (const x of frontier) {
        for (const p of this.parentsOf.get(x) ?? []) {
          if (!dist.has(p)) {
            dist.set(p, dist.get(x)! + 1);
            next.push(p);
          }
        }
      }
      frontier = next;
    }
    dist.delete(id);
    return dist;
  }

  descendants(id: string): Map<string, number> {
    const dist = new Map<string, number>([[id, 0]]);
    let frontier = [id];
    while (frontier.length) {
      const next: string[] = [];
      for (const x of frontier) {
        for (const c of this.children(x)) {
          if (!dist.has(c)) {
            dist.set(c, dist.get(x)! + 1);
            next.push(c);
          }
        }
      }
      frontier = next;
    }
    dist.delete(id);
    return dist;
  }

  // Kekulého čísla od kořene: 1 = kořen, otec 2k, matka 2k+1. Předek ve víc větvích dostane víc čísel,
  // dál se rozvíjí jen pod nejnižším (jako graf.py).
  kekule(root: string): Map<number, string> {
    const out = new Map<number, string>();
    const expanded = new Set<string>();
    let frontier: [number, string][] = [[1, this.main(root)]];
    while (frontier.length) {
      frontier.sort((a, b) => a[0] - b[0]);
      const next: [number, string][] = [];
      for (const [k, id] of frontier) {
        out.set(k, id);
        if (expanded.has(id)) continue;
        expanded.add(id);
        const { father, mother } = this.parents(id);
        if (father) next.push([2 * k, father]);
        if (mother) next.push([2 * k + 1, mother]);
      }
      frontier = next;
    }
    return out;
  }

  // id → nejnižší Kekulého číslo
  kekuleIndex(root: string): Map<string, number> {
    const idx = new Map<string, number>();
    for (const [k, id] of this.kekule(root)) if (!idx.has(id) || idx.get(id)! > k) idx.set(id, k);
    return idx;
  }

  // nekonzistence grafu (port Graf.chyby z tools/graf.py)
  errors(): string[] {
    const errs: string[] = [];
    for (const n of this.nodes.values()) {
      if (n.sex === "U" && !n.placeholder) errs.push(`${n.id}: chybí pohlaví`);
      if (n.sameAsId && !this.nodes.has(n.sameAsId)) errs.push(`${n.id}: tentýž člověk ${n.sameAsId} neexistuje`);
      const ps = (this.parentsOf.get(n.id) ?? []).map((p) => this.nodes.get(p)?.sex);
      if (ps.filter((s) => s === "F").length > 1) errs.push(`${n.id}: víc matek`);
      if (ps.filter((s) => s !== "F").length > 1) errs.push(`${n.id}: víc otců`);
      if (ps.length > 2) errs.push(`${n.id}: víc než dva rodiče`);
      if (this.isOwnAncestor(n.id)) errs.push(`${n.id}: cyklus v předcích (je sám sobě předkem)`);
      const b = n.birthYear;
      for (const p of this.parentsOf.get(n.id) ?? []) {
        const pb = this.nodes.get(p)?.birthYear;
        if (b && pb && b - pb < 13) errs.push(`${n.id}: rodič ${p} je jen o ${b - pb} let starší`);
      }
      if (n.birthYear && n.deathYear && n.deathYear < n.birthYear) errs.push(`${n.id}: úmrtí před narozením`);
    }
    return [...new Set(errs)];
  }

  isOwnAncestor(id: string): boolean {
    const seen = new Set<string>();
    const stack = [...(this.parentsOf.get(id) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      if (x === id) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(this.parentsOf.get(x) ?? []));
    }
    return false;
  }
}

const LIVING_YEARS = 110;

// žijící: výslovný příznak, jinak bez úmrtí a narozen před méně než 110 lety (bez data = ne)
export function isLiving(flag: boolean | null, birthYear: number | null, deathYear: number | null, hasDeath: boolean) {
  if (flag !== null) return flag;
  if (hasDeath || deathYear) return false;
  return birthYear !== null && birthYear > new Date().getFullYear() - LIVING_YEARS;
}

let cache: { version: number; graf: Graf } | null = null;

export async function loadGraf(): Promise<Graf> {
  const d = db();
  const version = await dataVersion(d);
  if (cache && cache.version === version) return cache.graf;

  const [people, names, rels, life] = await Promise.all([
    d.select().from(person),
    d.select().from(personName).where(eq(personName.isPrimary, true)),
    d.select().from(relation).orderBy(asc(relation.id)),
    d
      .select({
        personId: eventPerson.personId,
        type: event.type,
        year: sql<number | null>`min(${event.yearFrom})`,
      })
      .from(event)
      .innerJoin(eventPerson, eq(eventPerson.eventId, event.id))
      .where(inArray(event.type, ["narozeni", "krest", "umrti", "pohreb"]))
      .groupBy(eventPerson.personId, event.type),
  ]);
  const nameOf = new Map(names.map((n) => [n.personId, n]));
  const born = new Map<string, number>();
  const died = new Map<string, number | null>();
  for (const l of life) {
    if (l.type === "narozeni" || l.type === "krest") {
      if (l.year && (!born.has(l.personId) || l.type === "narozeni")) born.set(l.personId, l.year);
    } else if (!died.has(l.personId) || l.year) died.set(l.personId, l.year);
  }
  const nodes: GNode[] = people.map((p) => {
    const n = nameOf.get(p.id);
    const birthYear = born.get(p.id) ?? null;
    const deathYear = died.get(p.id) ?? null;
    return {
      id: p.id,
      name: n ? `${n.given} ${n.surname}`.trim() : p.id,
      given: n?.given ?? "",
      surname: n?.surname ?? "",
      sex: p.sex,
      certainty: p.certainty,
      yearsText: p.yearsText,
      sameAsId: p.sameAsId,
      placeholder: p.placeholder,
      livingFlag: p.living,
      birthYear,
      deathYear,
      living: isLiving(p.living, birthYear, deathYear, died.has(p.id)),
    };
  });
  const graf = new Graf(
    nodes,
    rels.map((r) => ({
      id: r.id,
      type: r.type,
      a: r.aId,
      b: r.bId,
      certainty: r.certainty,
      end: r.endReason && END_LABEL[r.endReason] ? [END_LABEL[r.endReason], r.endText].filter(Boolean).join(" ") : null,
    })),
  );
  cache = { version, graf };
  return graf;
}
