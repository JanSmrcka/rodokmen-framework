"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_LABEL, statusColor } from "@/lib/ui";
import { H, W, bounds, layout, layoutWide, type TreePerson } from "@/lib/treeLayout";

export type { TreePerson };

const ctrl = "h-9 w-9 border-b border-line text-lg text-muted last:border-0 hover:bg-accent-soft hover:text-ink";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function Tree({ people, initialFocus, root }: { people: Record<string, TreePerson>; initialFocus: string; root: string }) {
  const [focus, setFocus] = useState(initialFocus);
  const [selected, setSelected] = useState<string>(initialFocus);
  const [up, setUp] = useState(5);
  const [down, setDown] = useState(1);
  const [wide, setWide] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  const { nodes, edges } = useMemo(
    () => (wide ? layoutWide : layout)(people, focus, up, down),
    [people, focus, up, down, wide],
  );

  const fit = useCallback(() => {
    const el = box.current;
    if (!el || !nodes.length) return;
    const b = bounds(nodes);
    const pad = 40;
    const k = Math.min(1, (el.clientWidth - pad * 2) / (b.x1 - b.x0), (el.clientHeight - pad * 2) / (b.y1 - b.y0));
    setView({
      k,
      x: (el.clientWidth - (b.x1 - b.x0) * k) / 2 - b.x0 * k,
      y: (el.clientHeight - (b.y1 - b.y0) * k) / 2 - b.y0 * k,
    });
  }, [nodes]);

  useEffect(fit, [fit]);

  useEffect(() => {
    window.history.replaceState(null, "", focus === root ? "/strom/" : `/strom/?id=${focus}`);
  }, [focus, root]);

  // Wheel zoom must be a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.1, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoom = (f: number) => {
    const el = box.current;
    if (!el) return;
    const mx = el.clientWidth / 2,
      my = el.clientHeight / 2;
    setView((v) => {
      const k = Math.min(2.5, Math.max(0.1, v.k * f));
      return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
    });
  };

  const refocus = (id: string) => {
    setFocus(id);
    setSelected(id);
  };

  const matches = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return Object.values(people)
      .filter((p) => norm(p.name).includes(q))
      .slice(0, 8);
  }, [query, people]);

  const sel = people[selected];

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col md:flex-row">
      <div
        ref={box}
        className="relative flex-1 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
        style={{ backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x,
            dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
          if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
      >
        <svg className="absolute inset-0 h-full w-full">
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {edges.map((e) => {
              const fromRight = e.to.x > e.from.x;
              const x1 = fromRight ? e.from.x + W : e.from.x;
              const x2 = fromRight ? e.to.x : e.to.x + W;
              const y1 = e.from.y + H / 2,
                y2 = e.to.y + H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={e.key}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--muted)"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              );
            })}
            {nodes.map((n) => {
              const p = people[n.id];
              const isSel = n.id === selected;
              const isFocus = n.id === focus && n.x === 0;
              return (
                <g
                  key={n.key}
                  transform={`translate(${n.x},${n.y})`}
                  className="cursor-pointer"
                  onClick={() => !drag.current?.moved && setSelected(n.id)}
                  onDoubleClick={() => refocus(n.id)}
                >
                  <rect
                    width={W}
                    height={H}
                    rx={10}
                    fill="var(--card)"
                    stroke={isSel ? "var(--accent)" : "var(--line)"}
                    strokeWidth={isSel ? 2 : 1}
                    style={{ filter: isFocus ? "drop-shadow(0 4px 10px rgb(0 0 0 / .12))" : undefined }}
                  />
                  <rect x={0} y={0} width={5} height={H} rx={2.5} fill={p.color ?? (p.sex === "F" ? "var(--female)" : "var(--male)")} opacity={p.color ? 1 : 0.45} />
                  <foreignObject x={14} y={7} width={W - 34} height={H - 12}>
                    <div className="leading-tight">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{p.name}</div>
                      <div className="truncate text-[11.5px] text-muted" title={p.born ?? undefined}>{p.born ? `* ${p.born}` : p.years || " "}</div>
                      <div className="truncate text-[10.5px] text-muted/80">{p.rel}</div>
                    </div>
                  </foreignObject>
                  <circle cx={W - 12} cy={12} r={4} fill={statusColor(p.st)}>
                    <title>{STATUS_LABEL[p.st]}</title>
                  </circle>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="absolute top-3 left-3 flex w-[min(22rem,calc(100%-1.5rem))] flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Najít osobu…"
              className="w-full rounded-xl border border-line bg-card/95 px-4 py-2.5 text-sm shadow-sm outline-none backdrop-blur focus:border-accent/60"
            />
            {matches.length > 0 && (
              <ul className="absolute mt-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-lg">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      className="flex w-full justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-accent-soft"
                      onClick={() => {
                        refocus(m.id);
                        setQuery("");
                      }}
                    >
                      <span className="truncate">{m.name}</span>
                      <span className="shrink-0 text-muted">{m.years}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card/95 px-3 py-2 text-xs text-muted shadow-sm backdrop-blur">
            <label className="flex items-center gap-1.5">
              předci
              <input type="range" min={1} max={14} value={up} onChange={(e) => setUp(+e.target.value)} className="w-20 accent-[var(--accent)]" />
              <span className="w-4 tabular-nums text-ink">{up}</span>
            </label>
            <label className="flex items-center gap-1.5">
              potomci
              <input type="range" min={0} max={4} value={down} onChange={(e) => setDown(+e.target.value)} className="w-14 accent-[var(--accent)]" />
              <span className="w-3 tabular-nums text-ink">{down}</span>
            </label>
            <label className="flex items-center gap-1.5" title="U každého předka ukáže i jeho sourozence a jejich potomky">
              <input type="checkbox" checked={wide} onChange={(e) => setWide(e.target.checked)} className="accent-[var(--accent)]" />
              sourozenci a boční větve
            </label>
          </div>
        </div>

        <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-xl border border-line bg-card/95 shadow-sm" onPointerDown={(e) => e.stopPropagation()}>
          <button title="Přiblížit" onClick={() => zoom(1.25)} className={ctrl}>
            +
          </button>
          <button title="Oddálit" onClick={() => zoom(0.8)} className={ctrl}>
            −
          </button>
          <button title="Zobrazit vše" onClick={() => fit()} className={ctrl}>
            ⤢
          </button>
          {focus !== root && (
            <button title="Zpět na kořen" onClick={() => refocus(root)} className={ctrl}>
              ⌂
            </button>
          )}
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 hidden text-xs text-muted md:block">
          Klik = detail · dvojklik = střed stromu · kolečko = zoom · tažení = posun
        </p>
      </div>

      {sel && (
        <aside className="max-h-[45dvh] w-full shrink-0 overflow-y-auto border-t border-line bg-card p-6 md:max-h-none md:w-96 md:border-t-0 md:border-l">
          <p className="text-xs uppercase tracking-[0.15em] text-accent">{sel.rel || "příbuzný"}</p>
          <h2 className="mt-1 font-serif text-3xl leading-tight">{sel.name}</h2>
          <p className="mt-1 text-muted">{sel.years}</p>
          {(sel.born || sel.died) && (
            <p className="mt-1 text-sm text-muted">
              {sel.born && <span className="block">* {sel.born}</span>}
              {sel.died && <span className="block">† {sel.died}</span>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: statusColor(sel.st) }} />
              {STATUS_LABEL[sel.st]}
            </span>
            {sel.line && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: sel.color ?? undefined }} />
                {sel.line}
              </span>
            )}
          </div>
          {sel.facts.length > 0 && (
            <ul className="mt-5 space-y-1.5 text-sm">
              {sel.facts.map((f, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  {f}
                </li>
              ))}
            </ul>
          )}
          {(
            [
              ["Rodiče", [sel.father, sel.mother].filter((x): x is string => !!x)],
              ["Manželé", sel.spouses],
              ["Děti", sel.children],
            ] as const
          ).map(([label, ids]) =>
            ids.length ? (
              <div key={label} className="mt-5">
                <h3 className="mb-1.5 text-xs uppercase tracking-wider text-muted">{label}</h3>
                <div className="flex flex-col gap-1">
                  {ids.map((id) => (
                    <button key={id} onClick={() => setSelected(id)} onDoubleClick={() => refocus(id)} className="flex justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent-soft">
                      <span className="truncate">{people[id].name}</span>
                      <span className="shrink-0 text-muted">{people[id].years}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <div className="mt-6 flex gap-2">
            <Link href={`/osoba/${sel.id}/`} className="flex-1 rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-paper hover:opacity-90">
              Detail osoby
            </Link>
            {sel.id !== focus && (
              <button onClick={() => refocus(sel.id)} className="flex-1 rounded-full border border-line px-4 py-2 text-sm hover:border-accent/50">
                Do středu
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
