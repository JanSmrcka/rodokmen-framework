// Data webu pro přihlášeného (src/server/web.ts staví z DB; tvar převzatý ze starého site.json).

export type Status = "doc" | "prob" | "fam" | "mh" | "unk" | "lit";

export interface Mention {
  href: string;
  page: string;
  section: string;
}

export interface LifeDate {
  y: number | null;
  lo: number | null;
  hi: number | null;
  q: string;
}

export interface Home {
  house: string | null;
  obec: string;
  cp: string;
  since: number | null;
  until: number | null;
  role: string;
  records: string[];
  obecSlug: string;
}

export interface Person {
  slug: string;
  k: number | null;
  name: string;
  y: string;
  years: string;
  st: Status;
  status: string;
  gen: number | null;
  sex: "M" | "F";
  rel: string;
  line: number | null;
  lineSlug: string | null;
  facts: string[];
  note: string;
  records: string[];
  father: string | null;
  mother: string | null;
  fatherUnknown: boolean;
  motherUnknown: boolean;
  child: string | null;
  spouse: string | null;
  spouses: string[];
  siblings: string[];
  children: string[];
  side: { name: string; text: string; records: string[] }[];
  docs: unknown[];
  also: unknown[];
  path: string[];
  birth?: LifeDate;
  death?: LifeDate;
  alive?: boolean;
  place?: string | null;
  placeSlug?: string | null;
  homes?: Home[];
  mentions?: Mention[];
}

export interface RecordItem {
  key: string;
  kind: string;
  kindName: string;
  date: string;
  title: string;
  summary: string;
  scan: number | string | null;
  archive: string;
  volume: string;
  vdesc: string;
  portal: string;
  url: string;
  img: boolean;
  full: boolean;
  imgSrc: string | null; // /media/<sha256>
  fullSrc: string | null;
  boxes: [number, number, number, number][];
  orig: string;
  cs: string;
  people: string[];
  houses: string[];
  mentions: Mention[];
}

export interface Line {
  k: number;
  slug: string;
  name: string;
  desc: string;
  color: string;
  root: string;
  people: string[];
  auto?: boolean; // dopočítaný rod (pradědeček/prababička bez založeného rodu)
}

export interface Place {
  name: string;
  slug: string;
  lat: number;
  lon: number;
  lines: { k: number; people: string[] }[];
  years: [number, number] | [] | null;
  hypothesis: boolean;
  mine?: string[]; // předci přihlášeného, kteří tu žili
}

export interface HouseEntry {
  since?: string;
  until?: string;
  year?: string;
  name?: string;
  text?: string;
  how?: string;
  role?: string;
  years?: string;
  st: string;
  status: string;
  note?: string;
  source?: string;
  records: string[];
  person: string | null;
}

export interface House {
  slug: string;
  cp: string;
  obec: string;
  obecSlug: string;
  name: string;
  kind: string;
  st: string;
  status: string;
  desc: string;
  note: string;
  lat: number | null;
  lon: number | null;
  events: HouseEntry[];
  owners: HouseEntry[];
  people: HouseEntry[];
  records: string[];
  mentions: Mention[];
}

export interface SiteConfig {
  nazev: string;
  popis: string;
  zapati: string;
  kontakt?: { jmeno: string; email: string };
  uvod?: { nadpis: string; odstavce: string[]; foto: string; foto_popis: string };
  pribeh?: { menu: string; rod: number; tlacitko?: string };
  zajimavosti_na_uvodu?: { nadpis: string; text: string; href: string }[];
  pribehy?: { slug: string; titulek: string }[];
  maPribeh?: boolean;
  pribehDum?: unknown;
  pribehDomuStranka?: boolean;
}

// co se týká přihlášeného: on sám, pokrevní příbuzní a manžel(ka); jeho předci, rody a příběhy
export interface Mine {
  people: string[];
  ancestors: string[];
  lines: string[];
  stories: string[]; // odkazy na příběhy, které zmiňují někoho z people
}

export interface Site {
  config: SiteConfig;
  root: string;
  mine: Mine;
  roots: { key: string; id: string; name: string }[];
  people: Record<string, Person>;
  records: RecordItem[];
  lines: Record<string, Line>;
  places: Place[];
  houses: Record<string, House>;
  issues: { title: string; text: string; people: string[]; lines: string[] }[];
  hypotheses: { title: string; text: string; items: { name: string; text: string }[] }[];
  stats: Record<string, number>;
}
