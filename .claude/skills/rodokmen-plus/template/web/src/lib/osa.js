// Časová osa /osa/: rozvržení řádků. Sdílí ho statické SVG (build) i JS ostrůvek v prohlížeči.
export const NOW = 2026;
export const SORTS = { rod: 'rod', gen: 'generace', misto: 'místo', chrono: 'chronologicky' };
const by = (...fs) => (a, b) => { for (const f of fs) { const x = f(a), y = f(b); if (x < y) return -1; if (x > y) return 1; } return 0; };
const start = (r) => r.b.y ?? r.b.lo;

export function groupsOf(rows, sort) {
  const key = {
    rod: (r) => [r.lineOrder, r.lineName],
    gen: (r) => [r.gen ?? 99, r.gen == null ? 'Mimo přímou linii' : `${r.gen}. generace`],
    misto: (r) => [r.place ? 0 : 1, r.place || 'Místo neznámé'],
    chrono: (r) => [Math.floor(start(r) / 50) * 50, `${Math.floor(start(r) / 50) * 50}–${Math.floor(start(r) / 50) * 50 + 49}`],
  }[sort];
  const sorted = [...rows].sort(by((r) => key(r)[0], (r) => key(r)[1], start, (r) => r.name));
  const out = [];
  for (const r of sorted) {
    const [, label] = key(r);
    if (!out.length || out[out.length - 1].label !== label) out.push({ label, rows: [] });
    out[out.length - 1].rows.push(r);
  }
  return out;
}

// px na rok, výška řádku; vrací pozice řádků a nadpisů skupin
export function layout(rows, { sort = 'rod', pxy = 6, hidden = new Set(), from, to = NOW + 4 } = {}) {
  const ROW = 26, HEAD = 30, TOP = 34;
  const x = (y) => Math.round((y - from) * pxy * 10) / 10;
  let y = TOP;
  const heads = [], pos = {};
  for (const g of groupsOf(rows.filter((r) => !hidden.has(r.line)), sort)) {
    heads.push({ label: g.label, y: y + 18 });
    y += HEAD;
    for (const r of g.rows) { pos[r.id] = y; y += ROW; }
  }
  return { x, heads, pos, height: y + 26, width: x(to) + 10 };
}

// tvar pruhu: vous na začátku (bl→bh), plný úsek, vous / rozplynutí na konci
export function bar(r, x) {
  const s = r.b.q === 'doc' ? r.b.y : r.b.hi;
  const e = r.alive ? NOW : r.d.q === 'doc' ? r.d.y : r.d.lo;
  return {
    in: r.b.q === 'doc' ? null : [x(r.b.lo), x(s)],
    solid: [x(s), Math.max(x(e), x(s) + 2)],
    out: r.alive || r.d.q === 'doc' ? null : [x(e), x(r.d.hi)],
    open: r.d?.q === 'unk',
  };
}
