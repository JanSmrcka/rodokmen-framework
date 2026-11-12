// Text pro hledání: malá písmena, bez diakritiky, jedna mezera.
export function norm(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// „Jan Novák“ → „jan-novak“
export function slugify(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ParsedDate {
  yearFrom: number | null;
  yearTo: number | null;
  month: number | null;
  day: number | null;
  dateQual: "presne" | "asi" | "pred" | "po" | "mezi";
}

// „12. 3. 1873“, „asi 1720“, „před 1740“, „po 1800“, „1720–1785“, „3/1873“ → strukturované datum
export function parseDate(text: string | null | undefined): ParsedDate {
  const out: ParsedDate = { yearFrom: null, yearTo: null, month: null, day: null, dateQual: "presne" };
  if (!text) return out;
  const t = norm(text);
  if (/\b(asi|kolem|cca|okolo)\b|~/.test(t)) out.dateQual = "asi";
  else if (/\bpred\b/.test(t)) out.dateQual = "pred";
  else if (/\bpo\b/.test(t)) out.dateQual = "po";
  const years = [...t.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)].map((m) => Number(m[1]));
  if (years.length) out.yearFrom = years[0];
  if (years.length > 1 && /[–-]|\bmezi\b|\baz\b/.test(t)) {
    out.yearTo = years[1];
    if (out.dateQual === "presne") out.dateQual = "mezi";
  }
  const dmy = t.match(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(1[0-9]{3}|20[0-9]{2})\b/);
  if (dmy) {
    out.day = Number(dmy[1]);
    out.month = Number(dmy[2]);
  } else {
    const my = t.match(/\b(\d{1,2})\s*[./]\s*(1[0-9]{3}|20[0-9]{2})\b/);
    if (my && Number(my[1]) <= 12) out.month = Number(my[1]);
  }
  return out;
}

// první čtyřciferný rok v textu („asi 1720–1785“ → 1720)
export function firstYear(s: string | null | undefined): number | null {
  const m = s?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? Number(m[1]) : null;
}
