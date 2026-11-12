// Česká označení příbuzenství z pohledu přihlášeného („prababička“, „teta“, „švagr“).
import type { Graf } from "./graf";

export interface Pribuznost {
  label: string; // „prababička“, „bratranec z 2. kolena“, „tchán“
  kind: "ja" | "predek" | "potomek" | "pokrevni" | "manzel" | "svagrovstvi" | "zadna";
  up: number | null; // generace od přihlášeného ke společnému předkovi
  down: number | null; // generace od společného předka k osobě
  via: string | null; // společný předek / osoba, přes kterou vede sňatek
}

type S = "M" | "F" | "U";
const g = (sex: S, m: string, f: string) => (sex === "F" ? f : m);
const pra = (n: number) => "pra".repeat(Math.max(0, n));

function ancestorLabel(n: number, sex: S): string {
  if (n === 1) return g(sex, "otec", "matka");
  if (n <= 6) return pra(n - 2) + g(sex, "děd", "babička");
  return `${g(sex, "předek", "předkyně")} v ${n}. pokolení`;
}

function descendantLabel(n: number, sex: S): string {
  if (n === 1) return g(sex, "syn", "dcera");
  if (n <= 6) return pra(n - 2) + g(sex, "vnuk", "vnučka");
  return `${g(sex, "potomek", "potomkyně")} v ${n}. pokolení`;
}

// up = generace od přihlášeného ke společnému předkovi, down = od společného předka k osobě
export function bloodLabel(up: number, down: number, sex: S, halfSibling = false): string {
  if (up === 0) return descendantLabel(down, sex);
  if (down === 0) return ancestorLabel(up, sex);
  if (up === 1 && down === 1) return (halfSibling ? "nevlastní " : "") + g(sex, "bratr", "sestra");
  if (up === 1) return pra(down - 2) + g(sex, "synovec", "neteř");
  if (down === 1) return pra(up - 2) + g(sex, "strýc", "teta");
  const k = Math.min(up, down); // bratranec = 2/2, z 2. kolena = 3/3
  const cousin = g(sex, "bratranec", "sestřenice") + (k > 2 ? ` z ${k - 1}. kolena` : "");
  if (up === down) return cousin;
  // nestejné generace: „bratranec otce“ zjednodušeně jako vzdálený příbuzný s popisem
  return up > down ? `${cousin} (o ${up - down} gen. starší větev)` : `${cousin} (o ${down - up} gen. mladší)`;
}

// 2. pád prvního slova pro „babička manželky“, „manželka bratrance“
const GEN: Record<string, string> = {
  otec: "otce", matka: "matky", děd: "děda", babička: "babičky", syn: "syna", dcera: "dcery",
  vnuk: "vnuka", vnučka: "vnučky", bratr: "bratra", sestra: "sestry", strýc: "strýce", teta: "tety",
  bratranec: "bratrance", sestřenice: "sestřenice", synovec: "synovce", neteř: "neteře",
  předek: "předka", předkyně: "předkyně", potomek: "potomka", potomkyně: "potomkyně",
  nevlastní: "nevlastního",
};
export function genitive(label: string): string {
  const [first, ...rest] = label.split(" ");
  const m = first.match(/^((?:pra)*)(.*)$/)!;
  const base = GEN[m[2]];
  if (!base) return label;
  const restG = first === "nevlastní" && rest[0] ? [GEN[rest[0]] ?? rest[0], ...rest.slice(1)] : rest;
  return [m[1] + base, ...restG].join(" ");
}

interface Blood {
  up: number;
  down: number;
  via: string;
}

// nejbližší společný předek (nejmenší součet generací)
function nearestCommon(gr: Graf, a: string, b: string): Blood | null {
  const ua = gr.ancestors(a);
  ua.set(a, 0);
  const ub = gr.ancestors(b);
  ub.set(b, 0);
  let best: Blood | null = null;
  for (const [id, da] of ua) {
    const db = ub.get(id);
    if (db === undefined) continue;
    if (!best || da + db < best.up + best.down) best = { up: da, down: db, via: id };
  }
  return best;
}

// osoba na cestě: předek `from` ve vzdálenosti `dist`, který pochází z `via` (ve vzdálenosti `rest`)
function onPath(gr: Graf, from: string, dist: number, via: string, rest: number): string | null {
  for (const [id, d] of gr.ancestors(from)) {
    if (d === dist && gr.ancestors(id).get(via) === rest) return id;
  }
  return null;
}

// bratranci v nestejných generacích: „syn bratrance“, „sestřenice matky“
function unevenCousin(gr: Graf, v: string, t: string, b: Blood, sex: S): string | null {
  if (b.up < 2 || b.down < 2 || b.up === b.down) return null;
  const sexOf = (id: string) => (gr.nodes.get(id)?.sex ?? "U") as S;
  if (b.down > b.up) {
    const cousin = onPath(gr, t, b.down - b.up, b.via, b.up);
    if (!cousin) return null;
    return `${descendantLabel(b.down - b.up, sex)} ${genitive(bloodLabel(b.up, b.up, sexOf(cousin)))}`;
  }
  const anc = onPath(gr, v, b.up - b.down, b.via, b.down);
  if (!anc) return null;
  return `${bloodLabel(b.down, b.down, sex)} ${genitive(ancestorLabel(b.up - b.down, sexOf(anc)))}`;
}

function isHalfSibling(gr: Graf, a: string, b: string) {
  const pa = gr.parentsOf.get(a) ?? [];
  const pb = gr.parentsOf.get(b) ?? [];
  const common = pa.filter((p) => pb.includes(p)).length;
  return common === 1 && pa.length === 2 && pb.length === 2;
}

// polorodí: děti společného předka na obou cestách mají jen jednoho rodiče společného
// (nevlastní bratr, nevlastní strýc, nevlastní bratranec…)
function isHalfBlood(gr: Graf, v: string, t: string, b: Blood): boolean {
  if (b.up === 0 || b.down === 0) return false;
  const ca = b.up === 1 ? v : onPath(gr, v, b.up - 1, b.via, 1);
  const cb = b.down === 1 ? t : onPath(gr, t, b.down - 1, b.via, 1);
  return !!ca && !!cb && ca !== cb && isHalfSibling(gr, ca, cb);
}

const half = (label: string) => (label.startsWith("nevlastní ") ? label : `nevlastní ${label}`);

// všichni nejbližší společní předci (každá samostatná cesta příbuzenství); manželský pár = jedna cesta
function commonAncestors(gr: Graf, a: string, b: string): Blood[] {
  const ua = gr.ancestors(a);
  ua.set(a, 0);
  const ub = gr.ancestors(b);
  ub.set(b, 0);
  const common = [...ua.keys()].filter((id) => ub.has(id));
  // nejbližší: žádný jiný společný předek není jeho potomkem
  const lowest = common.filter((c) => !common.some((d) => d !== c && gr.ancestors(d).has(c)));
  const out: Blood[] = [];
  for (const c of lowest.sort((x, y) => ua.get(x)! + ub.get(x)! - (ua.get(y)! + ub.get(y)!) || x.localeCompare(y))) {
    const up = ua.get(c)!;
    const down = ub.get(c)!;
    if (out.some((o) => o.up === up && o.down === down && gr.spouses(o.via).includes(c))) continue;
    out.push({ up, down, via: c });
  }
  return out;
}

export interface Cesta {
  label: string;
  up: number;
  down: number;
  via: string; // společný předek (u páru jeden z nich)
  half: boolean;
}

// všechny pokrevní cesty mezi dvěma osobami (dvojí příbuzenství, sňatky v rodině)
export function vsechnyCesty(gr: Graf, viewerId: string, targetId: string): Cesta[] {
  const v = gr.main(viewerId);
  const t = gr.main(targetId);
  if (v === t) return [];
  const sex = (gr.nodes.get(t)?.sex ?? "U") as S;
  return commonAncestors(gr, v, t).map((b) => {
    const h = isHalfBlood(gr, v, t, b);
    const base = unevenCousin(gr, v, t, b, sex) ?? bloodLabel(b.up, b.down, sex);
    return { label: h ? half(base) : base, up: b.up, down: b.down, via: b.via, half: h };
  });
}

export function pribuznost(gr: Graf, viewerId: string, targetId: string): Pribuznost {
  const v = gr.main(viewerId);
  const t = gr.main(targetId);
  const tn = gr.nodes.get(t);
  const sex = (tn?.sex ?? "U") as S;
  if (v === t) return { label: "já", kind: "ja", up: 0, down: 0, via: null };

  const blood = nearestCommon(gr, v, t);
  if (blood) {
    const base = unevenCousin(gr, v, t, blood, sex) ?? bloodLabel(blood.up, blood.down, sex);
    const label = isHalfBlood(gr, v, t, blood) ? half(base) : base;
    const kind = blood.down === 0 ? "predek" : blood.up === 0 ? "potomek" : "pokrevni";
    return { label, kind, ...blood };
  }

  // manžel(ka)
  if (gr.spouses(v).includes(t)) return { label: g(sex, "manžel", "manželka"), kind: "manzel", up: null, down: null, via: null };

  // příbuzný manžela/manželky: tchán, tchyně, švagr, „babička manželky“
  for (const s of gr.spouses(v)) {
    const b = nearestCommon(gr, s, t);
    if (!b) continue;
    const sSex = (gr.nodes.get(s)?.sex ?? "U") as S;
    let label: string;
    if (b.up === 1 && b.down === 0) label = g(sex, "tchán", "tchyně");
    else if (b.up === 1 && b.down === 1) label = g(sex, "švagr", "švagrová");
    else if (b.up === 0 && b.down === 1) label = g(sex, "nevlastní syn", "nevlastní dcera");
    else label = `${bloodLabel(b.up, b.down, sex)} ${g(sSex, "manžela", "manželky")}`;
    return { label, kind: "svagrovstvi", up: b.up, down: b.down, via: s };
  }

  // manžel(ka) pokrevního příbuzného: zeť, snacha, švagr, nevlastní rodič, přiženěná teta
  for (const s of gr.spouses(t)) {
    const b = nearestCommon(gr, v, s);
    if (!b) continue;
    let label: string;
    if (b.up === 0 && b.down === 1) label = g(sex, "zeť", "snacha");
    else if (b.up === 1 && b.down === 1) label = g(sex, "švagr", "švagrová");
    else if (b.up === 1 && b.down === 0) label = g(sex, "nevlastní otec", "macecha");
    else if (b.down === 1 && b.up >= 2) label = bloodLabel(b.up, 1, sex) + " (přiženěn" + g(sex, "ý", "á") + ")";
    else label = `${g(sex, "manžel", "manželka")} ${genitive(bloodLabel(b.up, b.down, (gr.nodes.get(s)?.sex ?? "U") as S))}`;
    return { label, kind: "svagrovstvi", up: b.up, down: b.down, via: s };
  }

  return { label: "", kind: "zadna", up: null, down: null, via: null };
}
