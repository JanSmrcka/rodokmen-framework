import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/data";
import { Empty, NotFoundMsg, PageHeader, PersonChip } from "@/components/bits";

export async function generateMetadata({ params }: PageProps<"/rod/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getSite())?.lines[slug]?.name ?? "Rod" };
}

export default async function LinePage({ params }: PageProps<"/rod/[slug]">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const { slug } = await params;
  const l = site.lines[slug];
  if (!l) return <NotFoundMsg what="Rod" />;
  const byGen = new Map<number, string[]>();
  for (const id of l.people) {
    const g = site.people[id]?.gen ?? 99;
    byGen.set(g, [...(byGen.get(g) ?? []), id]);
  }
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/rody/" className="hover:text-ink">
          Rody
        </Link>
      </nav>
      <div className="mb-2 h-1.5 w-16 rounded-full" style={{ background: l.color }} />
      <PageHeader title={l.name} lead={l.desc}>
        <Link href={`/strom/?id=${l.root}`} className="mt-5 inline-block rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:border-accent/50">
          Strom rodu →
        </Link>
      </PageHeader>
      {[...byGen]
        .sort(([a], [b]) => a - b)
        .map(([g, ids]) => (
          <section key={g} className="mt-8">
            <h2 className="mb-3 text-sm uppercase tracking-wider text-muted">{g === 99 ? "Bez generace" : `${g}. generace`}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ids.map((id) => (
                <PersonChip key={id} site={site} id={id} sub={site.people[id]?.rel} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
