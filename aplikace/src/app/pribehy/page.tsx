import Link from "next/link";
import { getSite, getStory } from "@/lib/data";
import { Empty, isAll, MineToggle, PageHeader } from "@/components/bits";

export const metadata = { title: "Příběhy" };

// Moje příběhy: zmiňují někoho z mých pokrevních příbuzných (nebo manžela/ku); zajímavosti jsou pro všechny
export default async function StoriesPage({ searchParams }: PageProps<"/pribehy">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const all = isAll((await searchParams).vse);
  const mine = new Set([...site.mine.stories, "/zajimavosti/"]);
  const items = await Promise.all(
    [
      ...(site.config.maPribeh ? [{ href: "/pribeh-rodu/", slug: "pribeh", title: site.config.pribeh?.menu || "Příběh rodu" }] : []),
      ...(site.config.pribehDomuStranka ? [{ href: "/pribeh-domu/", slug: "pribeh-domu", title: "Příběh domu" }] : []),
      ...(site.config.pribehy ?? []).map((p) => ({ href: `/pribeh/${p.slug}/`, slug: p.slug, title: p.titulek })),
      { href: "/zajimavosti/", slug: "zajimavosti", title: "Zajímavosti" },
    ].map(async (i) => ({ ...i, story: await getStory(i.slug) })),
  );
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <PageHeader title="Příběhy" lead="Co se v matrikách a archivech podařilo poskládat do vyprávění." />
      <MineToggle
        path="/pribehy/"
        all={all}
        mine={items.filter((i) => i.story && mine.has(i.href)).length}
        total={items.filter((i) => i.story).length}
      />
      <div className="grid gap-4">
        {items
          .filter((i) => i.story && (all || mine.has(i.href)))
          .map((i) => (
            <Link key={i.href} href={i.href} className="group rounded-2xl border border-line bg-card p-7 transition hover:border-accent/50 hover:shadow-sm">
              <h2 className="font-serif text-3xl group-hover:text-accent">{i.story!.title || i.title}</h2>
              {i.story!.lead && <p className="mt-2 font-serif text-lg text-muted italic">{i.story!.lead}</p>}
              {i.story!.headings.length > 0 && <p className="mt-4 text-sm text-muted">{i.story!.headings.map((h) => h.text).join(" · ")}</p>}
            </Link>
          ))}
        <Link href="/denik/" className="rounded-2xl border border-dashed border-line p-6 text-muted transition hover:text-ink">
          Deník bádání – co se kde hledalo, otevřené otázky a hypotézy →
        </Link>
      </div>
    </div>
  );
}
