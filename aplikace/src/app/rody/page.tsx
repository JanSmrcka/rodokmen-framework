import Link from "next/link";
import { getSite } from "@/lib/data";
import { Empty, isAll, MineToggle, PageHeader } from "@/components/bits";
import { cz } from "@/lib/ui";

export const metadata = { title: "Rody" };

// Výchozí: rody předků přihlášeného (seřazené od nejbližších); ?vse=1 všechny rody rodokmenu.
export default async function LinesPage({ searchParams }: PageProps<"/rody">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const all = isAll((await searchParams).vse);
  const mine = new Set(site.mine.lines);
  const lines = Object.values(site.lines)
    .filter((l) => all || mine.has(l.slug))
    .sort((a, b) => Number(!mine.has(a.slug)) - Number(!mine.has(b.slug)) || (a.k || 1e9) - (b.k || 1e9) || a.name.localeCompare(b.name, "cs"));
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <PageHeader title="Rody" lead="Rody vašich pradědečků a prababiček – každý s vlastní barvou, která se táhne celým stromem." />
      <MineToggle path="/rody/" all={all} mine={mine.size} total={Object.keys(site.lines).length} />
      {lines.length === 0 && <p className="text-muted">Rody se objeví, až budou známí pradědečkové a prababičky.</p>}
      <div className="grid gap-4">
        {lines.map((l) => {
          const people = l.people.map((id) => site.people[id]).filter(Boolean);
          const years = people.map((p) => p.birth?.y ?? p.birth?.lo).filter((y): y is number => typeof y === "number");
          const founder = site.people[l.root];
          return (
            <Link key={l.slug} href={`/rod/${l.slug}/`} className={`group flex overflow-hidden rounded-xl border border-line bg-card transition hover:shadow-sm ${mine.has(l.slug) ? "" : "opacity-75"}`}>
              <span className="w-2 shrink-0" style={{ background: l.color }} />
              <span className="flex-1 p-6">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-serif text-2xl group-hover:text-accent">{l.name}</span>
                  <span className="text-sm text-muted">
                    {people.length} {cz(people.length, "osoba", "osoby", "osob")}
                    {years.length > 0 && ` · od ${Math.min(...years)}`}
                  </span>
                </span>
                {founder?.rel && <span className="mt-1 block text-sm text-accent">{founder.name} – {founder.rel}</span>}
                {!l.auto && <span className="mt-2 block text-muted">{l.desc}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
