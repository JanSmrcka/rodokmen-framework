// Data exported from the research repo by tools/export_web.py (re-run `npm run data` after changes).
import site from '../data/site.json';

export const { people, families, lines, stats, issues, hypotheses, docs, config } = site;
export const houses = site.houses ?? {};
export const villages = site.villages ?? {};
export const houseList = Object.values(houses);
/** „Horní Lhota čp. 12 – U Nováků“ */
export const houseTitle = (h) => `${h.obec} čp. ${h.cp}${h.name ? ` – ${h.name}` : ''}`;
/** Roky pobytu „1910–1921“, „od 1934“, „1901“. */
export const span = (a, b) => (a && b ? (a === b ? `${a}` : `${a}–${b}`) : a ? `od ${a}` : b ? `do ${b}` : '');
/** Počet rodů slovem pro nadpisy („Osm rodů“). */
export const linesTitle = (n) => (['Žádný rod', 'Jeden rod', 'Dva rody', 'Tři rody', 'Čtyři rody', 'Pět rodů', 'Šest rodů', 'Sedm rodů', 'Osm rodů'][n] ?? `${n} rodů`);
export const root = people[site.root];
/** Kořeny rodokmenu (KORENY v data/osoby.py): [{ key, id, name }]; první je výchozí. */
export const roots = site.roots ?? [{ key: 'hlavni', id: site.root, name: people[site.root].name }];
export const records = Object.fromEntries(site.records.map((r) => [r.key, r]));
export const recordList = site.records;
export const byK = Object.fromEntries([
  ...Object.values(people).map((p) => [p.k, p]),
  ...Object.entries(site.aliases ?? {}).map(([k, slug]) => [Number(k), people[slug]]),
]);
/** Předci osoby číslovaní od ní (1 = osoba, 2j = otec, 2j+1 = matka) – průchod po father/mother, ne po globálním k. */
export function localTree(slug, gens = 4) {
  const t = { 1: people[slug] };
  for (let j = 1; j < 2 ** (gens - 1); j++) {
    const p = t[j];
    if (!p) continue;
    if (p.father && people[p.father]) t[2 * j] = people[p.father];
    if (p.mother && people[p.mother]) t[2 * j + 1] = people[p.mother];
  }
  return t;
}
/** Počet známých generací za osobou (0 = rodiče neznámí). */
export const depthOf = (p) => {
  if (!p) return 0;
  const f = people[p.father], m = people[p.mother];
  return f || m ? 1 + Math.max(depthOf(f), depthOf(m)) : 0;
};
/** Počet známých předků včetně osoby (osoba ve více větvích se počítá vícekrát, jako dřív). */
export const knownOf = (p) => (p ? 1 + knownOf(people[p.father]) + knownOf(people[p.mother]) : 0);
export const lineByK = Object.fromEntries(Object.values(lines).map((l) => [l.k, l]));

export const href = {
  person: (slug) => `/osoba/${slug}/`,
  family: (id) => `/rodina/${id}/`,
  line: (slug) => `/rod/${slug}/`,
  record: (key) => `/zdroj/${key}/`,
  house: (slug) => `/dum/${slug}/`,
  place: (slug) => `/misto/${slug}/`,
};

/** Sortable number from dates like "12. 5. 1811", "3/1867", "12/1790", "1797". */
export function dateKey(date) {
  const y = (date.match(/\d{4}/) || ['9999'])[0];
  const parts = date.replace(y, '').match(/\d+/g) || [];
  const [d, m] = parts.length >= 2 ? [parts[0], parts[1]] : [0, parts[0] || 0];
  return Number(y) * 10000 + Number(m) * 100 + Number(d);
}

export const genName = (g) =>
  ['výchozí osoba', 'rodiče', 'prarodiče', 'praprarodiče'][g] ?? `${g}. generace (${'pra'.repeat(g - 1)}rodiče)`;

export const statusClass = (st) => ({ doc: 'st-doc', lit: 'st-fam', prob: 'st-prob', fam: 'st-fam', mh: 'st-mh' })[st] ?? 'st-unk';
