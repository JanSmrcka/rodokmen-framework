// Pohledy s vazbami v čase: A – Časová osa s vazbami (/osa-vazby/), B – Vějíř v čase (/vejir-cas/),
// C – Řeka času (/reka/). Rozložení se počítá v prohlížeči (kolem libovolné osoby ?o=<id>) z kompaktních dat,
// která na stránku vloží compact() při buildu. Roky narození/úmrtí jsou už dopočtené v exportu (birth/death,
// q = doc/calc/est/unk); sňatek se bere z families[].marriage: přesné datum → jen rok → odhad (rok před
// narozením 1. dítěte) → bez data.
export const NOW = new Date().getFullYear();

/** Rok a přesnost sňatku: { y, q: 'doc' | 'year' | 'est' } nebo null. */
export function marriageOf(fam, people) {
  const t = (fam.marriage ?? []).join(' ');
  const d = t.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (d) return { y: Number(d[3]), q: 'doc' };
  const y = t.match(/\b(1[0-9]\d\d|20\d\d)\b/);
  if (y) return { y: Number(y[1]), q: 'year' };
  const kids = (fam.children ?? []).map((c) => yearOf(people[c]?.birth)).filter((v) => v != null);
  return kids.length ? { y: Math.min(...kids) - 1, q: 'est' } : null;
}

/** Jeden rok z intervalu {y, lo, hi, q}; null = nejde umístit. */
export function yearOf(t) {
  if (!t) return null;
  if (t.y != null) return t.y;
  if (t.q === 'unk') return null;
  return t.lo != null && t.hi != null ? Math.round((t.lo + t.hi) / 2) : (t.lo ?? t.hi ?? null);
}

/** Kompaktní data pro prohlížeč (vkládá se při buildu jako JSON). */
export function compact(people, families) {
  const P = {};
  for (const p of Object.values(people)) {
    const b = yearOf(p.birth);
    const d = p.alive ? null : p.death?.q === 'unk' ? null : yearOf(p.death);
    P[p.slug] = [p.name, p.sex === 'F' ? 'F' : 'M', b, b == null ? null : p.birth.q, d, d == null ? null : p.death.q, p.alive ? 1 : 0, p.father ?? null, p.mother ?? null];
  }
  const F = Object.values(families).map((f) => {
    const m = marriageOf(f, people);
    return [f.father ?? null, f.mother ?? null, f.children ?? [], m ? m.y : null, m ? m.q : null];
  });
  return { P, F };
}

/** Rozbalí kompaktní data na objekty s indexy. */
export function expand({ P, F }) {
  const people = {};
  for (const [id, [n, s, b, bq, d, dq, a, f, m]] of Object.entries(P)) people[id] = { id, n, s, b, bq, d, dq, alive: !!a, f, m };
  const fams = F.map(([f, m, c, y, q]) => ({ f, m, c, mar: y == null ? null : { y, q } }));
  const famOfChild = {}, famsOf = {};
  for (const fa of fams) {
    for (const c of fa.c) famOfChild[c] ??= fa;
    for (const p of [fa.f, fa.m]) if (p) (famsOf[p] ??= []).push(fa);
  }
  const famOf = (f, m) => fams.find((x) => x.f === f && x.m === m);
  return { people, fams, famOfChild, famsOf, famOf };
}

/** Předci osoby v Ahnentafel číslování (1 = osoba, 2k otec, 2k+1 matka) včetně generace maxGen (0 = osoba). */
export function ahnen(db, id, maxGen = 12) {
  const t = { 1: db.people[id] };
  for (let k = 1; k < 2 ** maxGen; k++) {
    const p = t[k];
    if (!p) continue;
    if (p.f && db.people[p.f]) t[2 * k] = db.people[p.f];
    if (p.m && db.people[p.m]) t[2 * k + 1] = db.people[p.m];
  }
  return t;
}
const genOf = (k) => Math.floor(Math.log2(k));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (v) => Math.round(v * 10) / 10;
const DASH = { doc: '', year: '6 4', est: '1.5 3.5' };
const MQ = { doc: '', year: '', est: ' (odhad)' };
const sexCls = (p) => (p.s === 'F' ? 'sx-f' : 'sx-m');
const life = (p) => `${p.b ?? '?'}${p.alive ? '' : `–${p.d ?? '?'}`}`;
const link = (p, inner, extra = '') => `<a href="/osoba/${esc(p.id)}/" class="vz-p ${sexCls(p)}" data-id="${esc(p.id)}"${extra}><title>${esc(p.n)} (${life(p)})</title>${inner}</a>`;
/** Konec života pro kreslení: úmrtí, dnešek u žijících, jinak odhad 60 let (nejistý konec). */
const endOf = (p) => (p.alive ? { y: NOW, sure: true } : p.d != null ? { y: p.d, sure: p.dq === 'doc' || p.dq === 'calc' } : { y: Math.min(NOW, p.b + 60), sure: false });

function yearGrid(from, to, step, fn) {
  const out = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) out.push(fn(y));
  return out.join('');
}

// ───────────────────────────── A – Časová osa s vazbami ─────────────────────────────
export function layoutOsa(db, id, { maxGen = 12, pxy = 3, row = 24 } = {}) {
  const t = ahnen(db, id, maxGen);
  const order = [];
  const walk = (k) => { if (!t[k]) return; walk(2 * k); order.push(k); walk(2 * k + 1); };
  walk(1);
  const placed = order.filter((k) => t[k].b != null);
  const unplaced = new Set(order.filter((k) => t[k].b == null).map((k) => t[k].id)).size;
  const from = Math.floor((Math.min(...placed.map((k) => t[k].b)) - 10) / 50) * 50;
  const L = 240, TOP = 40;
  const x = (y) => L + (y - from) * pxy;
  const rowY = {};
  placed.forEach((k, i) => (rowY[k] = TOP + i * row + row / 2));
  const W = x(NOW + 8), H = TOP + placed.length * row + 30;
  const parts = [];
  parts.push(`<g class="vz-grid">${yearGrid(from, NOW, 25, (y) => `<line x1="${x(y)}" x2="${x(y)}" y1="${TOP - 6}" y2="${H - 20}" class="${y % 100 ? 'g25' : 'g100'}"/><text x="${x(y)}" y="${TOP - 12}" class="vz-ax">${y % 50 ? '' : y}</text>`)}</g>`);
  // sňatky: svislice mezi manželi + čára k narození dítěte
  const mar = [];
  for (const k of placed) {
    const fk = 2 * k, mk = 2 * k + 1, c = t[k];
    if (!(fk in rowY) || !(mk in rowY)) continue;
    const fam = db.famOf(t[fk].id, t[mk].id) ?? db.famOfChild[c.id];
    const m = fam?.mar ?? { y: c.b - 1, q: 'est' };
    const xm = x(m.y);
    const rel = `${t[fk].id} ${t[mk].id} ${c.id}`;
    mar.push(`<g class="vz-mar q-${m.q}" data-rel="${esc(rel)}"><title>⚭ ${m.y}${MQ[m.q]}: ${esc(t[fk].n)} a ${esc(t[mk].n)}</title><line x1="${xm}" x2="${xm}" y1="${rowY[fk]}" y2="${rowY[mk]}" stroke-dasharray="${DASH[m.q]}"/><circle cx="${xm}" cy="${rowY[fk]}" r="2.6"/><circle cx="${xm}" cy="${rowY[mk]}" r="2.6"/><path d="M${xm},${rowY[k]} H${x(c.b)}" class="vz-kid"/></g>`);
  }
  parts.push(`<g class="vz-mars">${mar.join('')}</g>`);
  const bars = placed.map((k) => {
    const p = t[k], e = endOf(p), y = rowY[k];
    const x0 = x(p.b), x1 = Math.max(x(e.y), x0 + 3);
    const est = p.bq !== 'doc';
    return link(p, `<rect x="${x0}" y="${y - 6}" width="${r1(x1 - x0)}" height="12" rx="3" class="vz-lifebar${e.sure ? '' : ' open'}${est ? ' est' : ''}"/>`
      + `<text x="${L - 10}" y="${y + 4}" text-anchor="end" class="vz-n${genOf(k) > 6 ? ' vz-small' : ''}">${esc(p.n)}</text>`
      + `<text x="${x1 + 5}" y="${y + 4}" class="vz-s">${life(p)}</text>`, ` data-rel="${esc([t[2 * k]?.id, t[2 * k + 1]?.id, t[k >> 1]?.id].filter(Boolean).join(' '))}"`);
  });
  parts.push(`<g class="vz-people">${bars.join('')}</g>`);
  return { svg: svgWrap(W, H, parts.join(''), 'Časová osa předků s vazbami'), start: { x: 0, y: 0, w: W, h: Math.min(H, W * 0.6) }, rowPx: row, count: new Set(placed.map((k) => t[k].id)).size, unplaced };
}

// ───────────────────────────── B – Vějíř v čase ─────────────────────────────
export function layoutVejir(db, id, { maxGen = 12, pxy = 2.6, span = 240, labelGen = 5 } = {}) {
  const t = ahnen(db, id, maxGen);
  const ks = Object.keys(t).map(Number);
  const placed = ks.filter((k) => t[k].b != null);
  const unplaced = new Set(ks.filter((k) => t[k].b == null).map((k) => t[k].id)).size;
  const oldest = Math.min(...placed.map((k) => t[k].b));
  const R = (NOW - oldest + 20) * pxy;
  const rad = (y) => (NOW - y) * pxy;
  const a0 = -90 - span / 2;
  const ang = (k) => { const g = genOf(k), i = k - 2 ** g; return ((a0 + (span * (i + 0.5)) / 2 ** g) * Math.PI) / 180; };
  const pt = (k, y) => [r1(Math.cos(ang(k)) * rad(y)), r1(Math.sin(ang(k)) * rad(y))];
  const parts = [];
  const rings = [];
  for (let y = Math.floor(NOW / 50) * 50; y >= oldest - 20; y -= 50) {
    const r = rad(y);
    if (r <= 0) continue;
    rings.push(`<circle r="${r1(r)}" class="${y % 100 ? 'g25' : 'g100'}"/><text x="0" y="${r1(-r - 4)}" text-anchor="middle" class="vz-ax">${y}</text>`);
  }
  parts.push(`<g class="vz-grid">${rings.join('')}<circle r="3" class="vz-now"/><text y="16" text-anchor="middle" class="vz-ax">dnes</text></g>`);
  const mar = [];
  for (const k of placed) {
    const fk = 2 * k, mk = 2 * k + 1, c = t[k];
    if (!t[fk]?.b || !t[mk]?.b) continue;
    const fam = db.famOf(t[fk].id, t[mk].id) ?? db.famOfChild[c.id];
    const m = fam?.mar ?? { y: c.b - 1, q: 'est' };
    const r = rad(m.y), A = ang(fk), B = ang(mk);
    const [ax, ay] = [Math.cos(A) * r, Math.sin(A) * r], [bx, by] = [Math.cos(B) * r, Math.sin(B) * r];
    const [cx, cy] = pt(k, m.y), [kx, ky] = pt(k, c.b);
    const rel = `${t[fk].id} ${t[mk].id} ${c.id}`;
    mar.push(`<g class="vz-mar q-${m.q}" data-rel="${esc(rel)}"><title>⚭ ${m.y}${MQ[m.q]}: ${esc(t[fk].n)} a ${esc(t[mk].n)}</title>`
      + `<path d="M${r1(ax)},${r1(ay)} A${r1(r)},${r1(r)} 0 0 1 ${r1(bx)},${r1(by)}" stroke-dasharray="${DASH[m.q]}"/>`
      + `<path d="M${cx},${cy} L${kx},${ky}" class="vz-kid"/>`
      + `<path d="M${pt(fk, t[fk].b).join(',')} L${r1(ax)},${r1(ay)} M${pt(mk, t[mk].b).join(',')} L${r1(bx)},${r1(by)}" class="vz-spoke"/></g>`);
  }
  parts.push(`<g class="vz-mars">${mar.join('')}</g>`);
  const dots = placed.map((k) => {
    const p = t[k], g = genOf(k), [px, py] = pt(k, p.b);
    const deg = (ang(k) * 180) / Math.PI;
    const flip = deg < -90 || deg > 90;
    const rot = flip ? deg + 180 : deg;
    const lbl = `<text transform="translate(${px},${py}) rotate(${r1(rot)})" x="${flip ? -8 : 8}" y="4" text-anchor="${flip ? 'end' : 'start'}" class="vz-n ${g <= labelGen ? '' : 'vz-detail'}">${esc(p.n)}${g <= 3 ? ` <tspan class="vz-s">${p.b}</tspan>` : ''}</text>`;
    return link(p, `<circle cx="${px}" cy="${py}" r="${g <= labelGen ? 4.5 : 3}" class="vz-dot${p.bq === 'doc' ? '' : ' est'}"/>${lbl}`, ` data-rel="${esc([t[2 * k]?.id, t[2 * k + 1]?.id, t[k >> 1]?.id].filter(Boolean).join(' '))}"`);
  });
  parts.push(`<g class="vz-people">${dots.join('')}</g>`);
  const M = R + 60;
  return { svg: svgWrap(2 * M, 2 * M, parts.join(''), 'Vějíř předků v čase', `${-M} ${-M} ${2 * M} ${2 * M}`), rowPx: 40, count: new Set(placed.map((k) => t[k].id)).size, unplaced };
}

// ───────────────────────────── C – Řeka času ─────────────────────────────
export function layoutReka(db, id, { gens = 4, col = 78, pxy = 5.2 } = {}) {
  const t = ahnen(db, id, gens);
  const inTree = new Set(Object.values(t).map((p) => p.id));
  const sibsOf = (k) => {
    const p = t[k];
    if (!t[2 * k] && !t[2 * k + 1]) return [k];
    const fam = db.famOf(t[2 * k]?.id ?? null, t[2 * k + 1]?.id ?? null) ?? db.famOfChild[p.id];
    const kids = (fam?.c ?? [p.id]).map((c) => db.people[c]).filter(Boolean);
    if (!kids.some((c) => c.id === p.id)) kids.push(p);
    return kids.sort((a, b) => (a.b ?? 9999) - (b.b ?? 9999)).map((c) => (c.id === p.id ? k : c));
  };
  const cols = []; // { p, k? } k = přímý předek
  const block = (k) => {
    if (!t[k]) return;
    block(2 * k);
    for (const s of sibsOf(k)) {
      if (typeof s === 'number') cols.push({ p: t[s], k: s, par: k });
      else if (!inTree.has(s.id)) cols.push({ p: s, par: k });
    }
    block(2 * k + 1);
  };
  block(1);
  const all = cols.map((c) => c.p);
  const placed = cols.filter((c) => c.p.b != null);
  const unplaced = new Set(cols.filter((c) => c.p.b == null).map((c) => c.p.id)).size;
  const oldest = Math.min(...placed.map((c) => c.p.b));
  const TOP = 60, L = 70;
  const yy = (y) => r1(TOP + (NOW - y) * pxy);
  const xOf = {};
  placed.forEach((c, i) => (xOf[c.k ?? c.p.id] = L + 50 + i * col));
  const W = L + 50 + placed.length * col + 40, H = yy(oldest - 15) + 20;
  const parts = [];
  parts.push(`<g class="vz-grid">${yearGrid(oldest - 15, NOW, 25, (y) => `<line x1="${L}" x2="${W - 20}" y1="${yy(y)}" y2="${yy(y)}" class="${y % 100 ? 'g25' : 'g100'}"/><text x="${L - 8}" y="${yy(y) + 4}" text-anchor="end" class="vz-ax">${y}</text>`)}<line x1="${L}" x2="${W - 20}" y1="${yy(NOW)}" y2="${yy(NOW)}" class="vz-today"/><text x="${L - 8}" y="${yy(NOW) - 6}" text-anchor="end" class="vz-ax b">dnes</text></g>`);
  // uzly sňatků přímých předků (páry 2k, 2k+1)
  const node = {};
  for (const c of placed) {
    if (c.k == null) continue;
    const k = c.k, fa = t[2 * k], mo = t[2 * k + 1];
    const xs = [xOf[2 * k], xOf[2 * k + 1]].filter((v) => v != null);
    if (!xs.length) continue;
    const fam = (fa && mo && db.famOf(fa.id, mo.id)) || db.famOfChild[c.p.id];
    const m = fam?.mar ?? { y: c.p.b - 1, q: 'est' };
    const end = Math.min(...[fa, mo].filter((p) => p?.b != null).map((p) => endOf(p).y));
    node[k] = { x: xs.reduce((a, b) => a + b) / xs.length, y: m.y, m, end: Math.max(end, m.y), fa, mo };
  }
  const streams = [], nodes = [], labels = [];
  for (const c of placed) {
    const p = c.p, x = xOf[c.k ?? p.id], yb = yy(p.b);
    const parentNode = node[c.par];
    let d = '';
    // odbočení z pramene rodičů v roce narození
    if (parentNode) d += `M${r1(parentNode.x)},${yb + 8} C${r1(parentNode.x)},${yb - 4} ${x},${yb + 14} ${x},${yb - 8} `;
    else d += `M${x},${yb} `;
    // vlastní pramen nahoru: přímý předek do svého uzlu sňatku, ostatní do konce života
    const parentK = c.k != null && c.k > 1 ? c.k >> 1 : null;
    const own = parentK != null ? node[parentK] : null;
    const e = endOf(p);
    let tail = '';
    if (own) d += `L${x},${yy(own.y) + 26} C${x},${yy(own.y) + 8} ${r1(own.x)},${yy(own.y) + 12} ${r1(own.x)},${yy(own.y)}`;
    else tail = `<path d="M${x},${parentNode ? yb - 8 : yb} L${x},${yy(e.y)}" class="vz-life${e.sure ? '' : ' open'}"/>`;
    const strong = c.k != null;
    streams.push(`<g class="vz-st ${sexCls(p)}${strong ? '' : ' sib'}" data-id="${esc(p.id)}"><path d="${d}" class="vz-flow"/>${tail}</g>`);
    // další sňatky osoby: vlastní uzel vedle pramene
    const others = own ? (db.famsOf[p.id] ?? []).filter((fa) => fa.mar && !(fa.f === own.fa?.id && fa.m === own.mo?.id)) : [];
    others.forEach((fa, i) => {
      const sp = db.people[p.id === fa.f ? fa.m : fa.f];
      const yv = yy(fa.mar.y), ox = x + 22 + i * 8;
      nodes.push(`<g class="vz-mar2 q-${fa.mar.q}"><title>další sňatek ⚭ ${fa.mar.y}${MQ[fa.mar.q]}${sp ? ` – ${esc(sp.n)}` : ''}</title><path d="M${x},${yv + 18} C${x},${yv + 6} ${ox},${yv + 10} ${ox},${yv}" class="vz-fork"/><circle cx="${ox}" cy="${yv}" r="5" class="vz-node q-${fa.mar.q}" stroke-dasharray="${fa.mar.q === 'doc' ? '' : '3 2'}"/>${sp ? `<a href="/osoba/${esc(sp.id)}/"><text x="${ox + 8}" y="${yv + 4}" class="vz-s">⚭ ${fa.mar.y} ${esc(sp.n)}</text></a>` : ''}</g>`);
    });
    labels.push(link(p, `<circle cx="${x}" cy="${yb}" r="4.5" class="vz-dot${p.bq === 'doc' ? '' : ' est'}"/><text x="${x + 8}" y="${yb + 4}" class="vz-n${strong ? '' : ' sib'}">${esc(p.n.split(' ')[0])}</text><text x="${x + 8}" y="${yb + 17}" class="vz-s">${esc(p.n.split(' ').slice(1).join(' '))} ${p.b}${p.d && !own ? ` † ${p.d}` : ''}</text>`));
  }
  for (const [k, n] of Object.entries(node)) {
    const y = yy(n.y);
    nodes.push(`<g class="vz-mar q-${n.m.q}" data-rel="${esc([n.fa?.id, n.mo?.id, t[k]?.id].filter(Boolean).join(' '))}"><title>⚭ ${n.m.y}${MQ[n.m.q]}</title><path d="M${r1(n.x)},${y} L${r1(n.x)},${yy(n.end)}" class="vz-couple"/><circle cx="${r1(n.x)}" cy="${y}" r="7" class="vz-node" stroke-dasharray="${n.m.q === 'doc' ? '' : '3 2'}"/><text x="${r1(n.x) + 10}" y="${y - 6}" class="vz-m">⚭ ${n.m.y}${MQ[n.m.q]}</text></g>`);
  }
  parts.push(`<g>${streams.join('')}</g><g>${nodes.join('')}</g><g class="vz-people">${labels.join('')}</g>`);
  const cx = xOf[1] ?? W / 2;
  return { svg: svgWrap(W, H, parts.join(''), 'Řeka času'), start: { x: cx - 700, y: 0, w: 1400, h: H }, rowPx: col, count: new Set(placed.map((c) => c.p.id)).size, unplaced, total: all.length };
}

function svgWrap(w, h, inner, label, vb = `0 0 ${r1(w)} ${r1(h)}`) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label)}">${inner}</svg>`;
}

/** Zvýraznění vazeb: při najetí / klepnutí na osobu zvýrazní ji, její rodiče, dítě a sňatky, kde figuruje. */
export function bindHighlight(svg) {
  const on = (id) => {
    svg.classList.toggle('vz-hl', !!id);
    svg.querySelectorAll('.on').forEach((e) => e.classList.remove('on'));
    if (!id) return;
    svg.querySelectorAll('[data-id], [data-rel]').forEach((e) => {
      const rel = (e.getAttribute('data-rel') ?? '').split(' ');
      if (e.getAttribute('data-id') === id || (e.classList.contains('vz-mar') && rel.includes(id))) e.classList.add('on');
    });
    const me = svg.querySelector(`.vz-p[data-id="${CSS.escape(id)}"]`);
    for (const r of (me?.getAttribute('data-rel') ?? '').split(' ').filter(Boolean)) svg.querySelectorAll(`[data-id="${CSS.escape(r)}"]`).forEach((e) => e.classList.add('on'));
  };
  svg.addEventListener('pointerover', (e) => { const a = e.target.closest?.('.vz-p'); if (a) on(a.dataset.id); });
  svg.addEventListener('pointerout', (e) => { if (e.target.closest?.('.vz-p') && !e.relatedTarget?.closest?.('.vz-p')) on(null); });
}
