"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STATUS_LABEL, statusColor } from "@/lib/ui";

export interface ListPerson {
  id: string;
  name: string;
  years: string;
  birth: number | null;
  st: string;
  rel: string;
  gen: number | null;
  line: string | null;
  place: string | null;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

type Sort = "gen" | "name" | "birth";

export function PeopleList({ people, lines }: { people: ListPerson[]; lines: { slug: string; name: string; color: string }[] }) {
  const [q, setQ] = useState("");
  const [line, setLine] = useState("");
  const [st, setSt] = useState("");
  const [sort, setSort] = useState<Sort>("gen");
  const color = Object.fromEntries(lines.map((l) => [l.slug, l.color]));

  const shown = useMemo(() => {
    const nq = norm(q.trim());
    const out = people.filter(
      (p) => (!nq || norm(`${p.name} ${p.place ?? ""} ${p.rel}`).includes(nq)) && (!line || p.line === line) && (!st || p.st === st),
    );
    const cmp: Record<Sort, (a: ListPerson, b: ListPerson) => number> = {
      gen: (a, b) => (a.gen ?? 99) - (b.gen ?? 99) || (a.birth ?? 9999) - (b.birth ?? 9999),
      name: (a, b) => a.name.localeCompare(b.name, "cs"),
      birth: (a, b) => (a.birth ?? 9999) - (b.birth ?? 9999),
    };
    return out.sort(cmp[sort]);
  }, [people, q, line, st, sort]);

  const select = "rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent/60";
  return (
    <>
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex flex-wrap gap-2 bg-paper/90 px-4 py-3 backdrop-blur">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat jméno, místo…" className={`${select} min-w-56 flex-1`} />
        <select value={line} onChange={(e) => setLine(e.target.value)} className={select}>
          <option value="">Všechny rody</option>
          {lines.map((l) => (
            <option key={l.slug} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
        <select value={st} onChange={(e) => setSt(e.target.value)} className={select}>
          <option value="">Jakákoli jistota</option>
          {Object.entries(STATUS_LABEL)
            .filter(([k]) => k !== "lit")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={select}>
          <option value="gen">Podle generace</option>
          <option value="birth">Podle narození</option>
          <option value="name">Podle jména</option>
        </select>
      </div>
      <p className="mb-3 text-sm text-muted">{shown.length} výsledků</p>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {shown.map((p) => (
          <Link key={p.id} href={`/osoba/${p.id}/`} className="group flex items-center gap-4 border-b border-line px-4 py-3 last:border-0 hover:bg-accent-soft/50">
            <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: (p.line && color[p.line]) || "var(--line)" }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium group-hover:text-accent">{p.name}</span>
              <span className="block truncate text-sm text-muted">{[p.rel, p.place].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="hidden shrink-0 text-sm text-muted tabular-nums sm:block">{p.years}</span>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" title={STATUS_LABEL[p.st]} style={{ background: statusColor(p.st) }} />
          </Link>
        ))}
      </div>
    </>
  );
}
