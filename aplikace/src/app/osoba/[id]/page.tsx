import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/data";
import { Empty, NotFoundMsg, PersonChip, Section, StatusBadge } from "@/components/bits";
import { RecordCard } from "@/components/RecordCard";
import { TipForm } from "@/components/Forms";
import { lifeLabel } from "@/lib/ui";

export async function generateMetadata({ params }: PageProps<"/osoba/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getSite())?.people[id]?.name ?? "Osoba" };
}

export default async function PersonPage({ params }: PageProps<"/osoba/[id]">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const { id } = await params;
  const p = site.people[id];
  if (!p) return <NotFoundMsg what="Osoba" />;
  const line = p.lineSlug ? site.lines[p.lineSlug] : null;
  const records = site.records.filter((r) => p.records.includes(r.key) || r.people.includes(id));
  const has = (x: string | null | undefined): x is string => !!x && !!site.people[x];

  const family: [string, string[]][] = [
    ["Rodiče", [p.father, p.mother].filter(has)],
    ["Manželé", p.spouses.filter(has)],
    ["Děti", p.children.filter(has)],
    ["Sourozenci", p.siblings.filter(has)],
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/osoby/" className="hover:text-ink">
          Osoby
        </Link>
        {line && (
          <>
            {" / "}
            <Link href={`/rod/${line.slug}/`} className="hover:text-ink">
              {line.name}
            </Link>
          </>
        )}
      </nav>

      <header className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          {p.rel && <p className="text-sm uppercase tracking-[0.15em] text-accent">{p.rel}</p>}
          <h1 className="mt-1 font-serif text-5xl font-medium tracking-tight md:text-6xl">{p.name}</h1>
          <p className="mt-2 text-xl text-muted">{lifeLabel(p)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge st={p.st} />
            {line && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
                {line.name}
              </span>
            )}
            {p.k && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">předek č. {p.k}</span>}
          </div>
        </div>
        <Link href={`/strom/?id=${id}`} className="self-start rounded-full border border-line px-5 py-2.5 text-sm font-medium transition hover:border-accent/50 md:self-auto">
          Ukázat ve stromu →
        </Link>
      </header>

      <div className="grid gap-x-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          {p.facts.length > 0 && (
            <Section title="Životopis">
              <ol className="relative space-y-4 border-l border-line pl-6">
                {p.facts.map((f, i) => (
                  <li key={i} className="relative">
                    <span className="absolute top-2 -left-[27.5px] h-2 w-2 rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {p.note && (
            <Section title="Poznámka">
              <p className="rounded-xl bg-accent-soft/60 p-4 text-sm leading-relaxed">{p.note}</p>
            </Section>
          )}
          {!!p.homes?.length && (
            <Section title="Bydliště">
              <ul className="space-y-2">
                {p.homes.map((h, i) => (
                  <li key={i} className="flex justify-between gap-4 rounded-lg border border-line bg-card px-4 py-3 text-sm">
                    <span>
                      {h.house ? (
                        <Link href={`/dum/${h.house}/`} className="font-medium hover:text-accent">
                          {h.obec} čp. {h.cp}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {h.obec} čp. {h.cp}
                        </span>
                      )}
                      {h.role && <span className="text-muted"> · {h.role}</span>}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">{[h.since, h.until].filter(Boolean).join("–")}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {records.length > 0 && (
            <Section title="Zápisy z pramenů">
              <div className="grid gap-3">
                {records.map((r) => (
                  <RecordCard key={r.key} r={r} />
                ))}
              </div>
            </Section>
          )}
          <Section title="Víte něco?">
            <TipForm personId={id} name={p.name} />
          </Section>
          {!!p.mentions?.length && (
            <Section title="Zmínky">
              <ul className="space-y-1 text-sm">
                {p.mentions.map((m) => (
                  <li key={`${m.href}|${m.section}`}>
                    <Link href={m.href} className="text-accent underline-offset-2 hover:underline">
                      {m.page} – {m.section}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        <aside>
          {family.map(([label, ids]) =>
            ids.length ? (
              <Section key={label} title={label}>
                <div className="grid gap-2">
                  {ids.map((x) => (
                    <PersonChip key={x} site={site} id={x} sub={label === "Manželé" ? p.spouseEnds?.[x] : undefined} />
                  ))}
                </div>
              </Section>
            ) : null,
          )}
          {p.side.length > 0 && (
            <Section title="Další příbuzní">
              <ul className="space-y-3 text-sm">
                {p.side.map((s, i) => (
                  <li key={i} className="rounded-lg border border-line bg-card px-4 py-3">
                    <span className="font-medium">{s.name}</span>
                    <p className="mt-0.5 text-muted">{s.text}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
