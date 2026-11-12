export interface TreePerson {
  id: string;
  name: string;
  years: string;
  born: string | null;
  died: string | null;
  sex: "M" | "F";
  st: string;
  rel: string;
  color: string | null;
  line: string | null;
  facts: string[];
  father: string | null;
  mother: string | null;
  children: string[];
  spouses: string[];
}

export interface Node {
  key: string;
  id: string;
  x: number;
  y: number;
}
export interface Edge {
  key: string;
  from: Node;
  to: Node;
}

export const W = 220; // card width
export const H = 54; // card height
export const COL = 270; // horizontal step between generations
export const ROW = 66; // vertical step between leaves

// Ancestors grow to the right (x > 0), descendants to the left (x < 0); each half is a tidy tree
// where leaves get consecutive rows and inner nodes sit in the middle of their subtrees.
export function layout(people: Record<string, TreePerson>, focus: string, up: number, down: number) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let cursor = 0;
  const anc = (id: string, g: number, path: string): Node => {
    const p = people[id];
    const parents = g < up ? [p.father, p.mother].filter((x): x is string => !!x) : [];
    let y: number;
    const kids = parents.map((pp) => anc(pp, g + 1, `${path}/${pp}`));
    if (kids.length) y = (kids[0].y + kids[kids.length - 1].y) / 2;
    else {
      y = cursor;
      cursor += ROW;
    }
    const n = { key: `a:${path}`, id, x: g * COL, y };
    nodes.push(n);
    kids.forEach((k) => edges.push({ key: `${n.key}>${k.key}`, from: n, to: k }));
    return n;
  };
  const top = anc(focus, 0, focus);

  const descNodes: Node[] = [];
  const descEdges: Edge[] = [];
  cursor = 0;
  const desc = (id: string, g: number, path: string): Node => {
    const kids = g < down ? people[id].children.map((c) => desc(c, g + 1, `${path}/${c}`)) : [];
    let y: number;
    if (kids.length) y = (kids[0].y + kids[kids.length - 1].y) / 2;
    else {
      y = cursor;
      cursor += ROW;
    }
    const n = { key: `d:${path}`, id, x: -g * COL, y };
    descNodes.push(n);
    kids.forEach((k) => descEdges.push({ key: `${n.key}>${k.key}`, from: n, to: k }));
    return n;
  };
  if (down > 0 && people[focus].children.length) {
    const droot = desc(focus, 0, focus);
    const shift = top.y - droot.y;
    for (const n of descNodes) {
      n.y += shift;
      if (n !== droot) nodes.push(n);
    }
    for (const e of descEdges) edges.push(e.from === droot ? { ...e, from: top } : e);
  }
  return { nodes, edges };
}

// Wide variant: each ancestor also shows its siblings with their descendants (down to generation -down).
// Every main-line ancestor gets its own row between its father's and mother's subtree, so side branches
// (allocated from the same row cursor) never overlap; only pure descendant blocks use tidy midpoints.
export function layoutWide(people: Record<string, TreePerson>, focus: string, up: number, down: number) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const link = (a: Node, b: Node) => edges.push({ key: `${a.key}>${b.key}`, from: a, to: b });
  let cursor = 0;

  const desc = (id: string, g: number, path: string): Node => {
    const kids = g > -down ? people[id].children.map((c) => desc(c, g - 1, `${path}.${c}`)) : [];
    let y: number;
    if (kids.length) y = (kids[0].y + kids[kids.length - 1].y) / 2;
    else {
      y = cursor;
      cursor += ROW;
    }
    const n = { key: `w:${path}`, id, x: g * COL, y };
    nodes.push(n);
    kids.forEach((k) => link(n, k));
    return n;
  };

  const anc = (id: string, g: number, path: string): Node => {
    const p = people[id];
    const parents = g < up ? [p.father, p.mother].filter((x): x is string => !!x) : [];
    const sibs = [...new Set(parents.flatMap((pp) => people[pp].children))];
    const i = sibs.indexOf(id);
    const first = parents[0] ? anc(parents[0], g + 1, `${path}/${parents[0]}`) : null;
    // Elder siblings above, younger below (order of the parents' children lists).
    const sibNodes = sibs.slice(0, Math.max(i, 0)).map((s) => desc(s, g, `${path}~${s}`));
    let n: Node;
    if (g === 0) n = desc(id, 0, path);
    else {
      n = { key: `w:${path}`, id, x: g * COL, y: cursor };
      cursor += ROW;
      nodes.push(n);
    }
    sibNodes.push(...sibs.slice(i + 1).filter((s) => s !== id).map((s) => desc(s, g, `${path}~${s}`)));
    const second = parents[1] ? anc(parents[1], g + 1, `${path}/${parents[1]}`) : null;
    for (const pn of [first, second]) {
      if (!pn) continue;
      link(n, pn);
      for (const s of sibNodes) if (people[s.id].father === pn.id || people[s.id].mother === pn.id) link(s, pn);
    }
    return n;
  };
  anc(focus, 0, focus);
  return { nodes, edges };
}

export function bounds(nodes: Node[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + W);
    y1 = Math.max(y1, n.y + H);
  }
  return { x0, y0, x1, y1 };
}
