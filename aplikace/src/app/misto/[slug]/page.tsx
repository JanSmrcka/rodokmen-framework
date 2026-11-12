import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/data";
import { Empty, isAll, MineToggle, NotFoundMsg, PageHeader, PersonChip } from "@/components/bits";

export async function generateMetadata({ params }: PageProps<"/misto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: (await getSite())?.places.find((p) => p.slug === slug)?.name ?? "Místo" };
}

export default async function PlacePage({ params, searchParams }: PageProps<"/misto/[slug]">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const { slug } = await params;
  const place = site.places.find((p) => p.slug === slug);
  if (!place) return <NotFoundMsg what="Místo" />;
  const all = isAll((await searchParams).vse);
  const mineP = new Set(site.mine.people);
  const every = [...new Set(place.lines.flatMap((l) => l.people))].filter((id) => site.people[id]);
  const ids = every.filter((id) => all || mineP.has(id));
  ids.sort((a, b) => (site.people[a].birth?.y ?? 9999) - (site.people[b].birth?.y ?? 9999));
  const houses = Object.values(site.houses).filter((h) => h.obecSlug === slug);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/mapa/" className="hover:text-ink">
          Mapa
        </Link>
      </nav>
      <PageHeader title={place.name} lead={`${ids.length} osob z rodokmenu${place.years?.length === 2 ? `, ${place.years[0]}–${place.years[1]}` : ""}.`} />
      <MineToggle path={`/misto/${slug}/`} all={all} mine={every.filter((id) => mineP.has(id)).length} total={every.length} />
      {houses.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {houses.map((h) => (
            <Link key={h.slug} href={`/dum/${h.slug}/`} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-accent/50">
              čp. {h.cp} {h.name && `· ${h.name}`}
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ids.map((id) => (
          <PersonChip key={id} site={site} id={id} sub={site.people[id].rel} />
        ))}
      </div>
    </div>
  );
}
