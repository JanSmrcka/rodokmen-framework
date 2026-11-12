// Ořez údajů o žijících osobách. Uplatňuje se v doménové vrstvě (API i web), ne v UI.
// Člen rodiny u žijících vidí jen jméno, pohlaví a rok narození; admin a agent vidí vše.
import { seesPrivate, type Actor } from "./actor";
import type { PersonRaw } from "./osoby";

export function redactPerson(actor: Actor, p: PersonRaw & { living: boolean | null }, living: boolean): PersonRaw {
  if (seesPrivate(actor)) return p;
  const base = { ...p, notePrivate: null };
  if (!living) return base;
  const birth = p.events.find((e) => e.type === "narozeni" && e.role === "hlavni");
  return {
    ...base,
    note: null,
    yearsText: birth?.yearFrom ? `* ${birth.yearFrom}` : null,
    names: p.names.filter((n) => n.isPrimary || n.kind === "rodne").map((n) => ({ ...n, note: null })),
    // jen rok narození, bez dne, měsíce a místa
    events: birth
      ? [{ ...birth, dateText: String(birth.yearFrom ?? ""), month: null, day: null, placeSlug: null, houseKey: null, placeText: null, text: null, note: null, sources: [], persons: birth.persons }]
      : [],
    relations: p.relations.map((r) => ({ ...r, note: null, sources: [] })),
    residences: [],
    records: [],
    sources: [],
    sideNotes: [],
  };
}
