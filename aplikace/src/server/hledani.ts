// Jedno hledání napříč osobami, místy, zápisy, deníkem a vodítky (vše bez diakritiky, trigramy).
import { canEdit, seesPrivate, type Actor } from "./actor";
import { loadGraf } from "./graf";
import { listLog, listTips } from "./fronta";
import { searchPlaces } from "./mista";
import { searchPersons } from "./osoby";
import { listRecords } from "./prameny";

export async function searchAll(actor: Actor, q: string) {
  const [persons, places, records, log, tips] = await Promise.all([
    searchPersons(q, 20),
    searchPlaces(q, 10),
    listRecords({ q, limit: 20 }),
    seesPrivate(actor) ? listLog({ q, limit: 20 }) : [],
    seesPrivate(actor) ? listTips(actor, { q, limit: 20 }) : [],
  ]);
  const g = await loadGraf();
  const withYears = persons.map((p) => {
    const n = g.nodes.get(p.id);
    const hide = !!n?.living && !canEdit(actor);
    return { ...p, name: n?.name ?? `${p.given} ${p.surname}`, yearsText: hide ? (n?.birthYear ? `* ${n.birthYear}` : null) : (n?.yearsText ?? null) };
  });
  return { persons: withYears, places, records, log, tips };
}
