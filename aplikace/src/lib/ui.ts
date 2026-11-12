import type { Person, Site } from "./types";

export const STATUS_LABEL: Record<string, string> = {
  doc: "doloženo matrikou",
  prob: "pravděpodobné",
  fam: "od rodiny",
  mh: "cizí strom",
  unk: "neznámé",
  lit: "literatura",
};

export const statusColor = (st: string) => `var(--st-${st in STATUS_LABEL && st !== "lit" ? st : "unk"})`;

export function lineColor(site: Site, p: Person | undefined) {
  return (p?.lineSlug && site.lines[p.lineSlug]?.color) || "var(--line)";
}

// Short life line: years from data, or the exporter's estimate when nothing is known yet.
export function lifeLabel(p: Pick<Person, "years" | "birth">) {
  if (p.years) return p.years;
  return p.birth?.q === "calc" && p.birth.y ? `asi ${p.birth.y} (odhad)` : "";
}

// Full birth / death facts ("* 23. 3. 1901 Lhota čp. 12") without the leading sign.
export function vitalFacts(facts: string[]) {
  const pick = (sign: string) => facts.find((f) => f.startsWith(sign))?.slice(sign.length).trim() ?? null;
  return { born: pick("*"), died: pick("†") };
}

export function personHref(id: string) {
  return `/osoba/${id}/`;
}

export function cz(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}
