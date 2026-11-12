import Link from "next/link";
import type { Person, Site } from "@/lib/types";
import { STATUS_LABEL, lifeLabel, lineColor, personHref, statusColor } from "@/lib/ui";

export function StatusBadge({ st }: { st: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: statusColor(st) }} />
      {STATUS_LABEL[st] ?? st}
    </span>
  );
}

export function PersonChip({ site, id, sub }: { site: Site; id: string; sub?: string }) {
  const p: Person | undefined = site.people[id];
  if (!p) return null;
  return (
    <Link
      href={personHref(id)}
      className="group flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 transition hover:border-accent/50 hover:shadow-sm"
    >
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: lineColor(site, p) }} />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:text-accent">{p.name}</span>
        <span className="block truncate text-xs text-muted">
          {[sub, lifeLabel(p)].filter(Boolean).join(" · ") || " "}
        </span>
      </span>
      <span className="ml-auto h-2 w-2 shrink-0 rounded-full" title={STATUS_LABEL[p.st]} style={{ background: statusColor(p.st) }} />
    </Link>
  );
}

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-4xl font-medium tracking-tight md:text-5xl">{title}</h1>
      {lead && <p className="mt-3 max-w-2xl text-lg text-muted">{lead}</p>}
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-serif text-2xl font-medium">{title}</h2>
      {children}
    </section>
  );
}

// Přepínač „Moje / Vše“ (?vse=1) – výchozí je to, co se týká přihlášeného
export function MineToggle({ path, all, mine, total, extra = "" }: { path: string; all: boolean; mine: number; total: number; extra?: string }) {
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-sm transition ${active ? "bg-accent text-paper" : "border border-line text-muted hover:text-ink"}`;
  const q = (v: boolean) => {
    const p = new URLSearchParams(extra);
    if (v) p.set("vse", "1");
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Link href={q(false)} className={pill(!all)}>
        Moje ({mine})
      </Link>
      <Link href={q(true)} className={pill(all)}>
        Vše ({total})
      </Link>
    </div>
  );
}

export const isAll = (v: string | string[] | undefined) => v === "1";

export function Empty() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-4xl">Rodokmen je zatím prázdný</h1>
      <p className="mt-4 text-muted">V databázi zatím nejsou žádné osoby. Data se zapisují přes API (nástroj <code>tools/rdb.py</code>).</p>
    </div>
  );
}

export function NotFoundMsg({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">{what} nenalezen(a)</h1>
      <Link href="/" className="mt-4 inline-block text-accent underline">
        Zpět na úvod
      </Link>
    </div>
  );
}
