import Link from "next/link";
import { getSite } from "@/lib/data";
import { Empty, isAll, MineToggle, PageHeader, StatusBadge } from "@/components/bits";

export const metadata = { title: "Domy" };

// Moje domy: žil v nich nebo je držel někdo z mých pokrevních příbuzných (nebo manžel/ka)
export default async function HousesPage({ searchParams }: PageProps<"/domy">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const all = isAll((await searchParams).vse);
  const mineP = new Set(site.mine.people);
  const lived = new Set(Object.values(site.people).flatMap((p) => (mineP.has(p.slug) ? (p.homes ?? []).map((h) => h.house) : [])));
  const isMine = (h: (typeof site.houses)[string]) =>
    lived.has(h.slug) || [...h.owners, ...h.people].some((e) => e.person && mineP.has(e.person));
  const every = Object.values(site.houses);
  const houses = every.filter((h) => all || isMine(h)).sort((a, b) => a.obec.localeCompare(b.obec, "cs") || +a.cp - +b.cp);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <PageHeader title="Domy" lead="Domy, ve kterých rodina žila – držitelé, obyvatelé a události v čase." />
      <MineToggle path="/domy/" all={all} mine={every.filter(isMine).length} total={every.length} />
      {houses.length === 0 && <p className="text-muted">U vašich předků zatím žádný dům zpracovaný není – podívejte se na „Vše“.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {houses.map((h) => (
          <Link key={h.slug} href={`/dum/${h.slug}/`} className="group rounded-xl border border-line bg-card p-6 transition hover:border-accent/50 hover:shadow-sm">
            <p className="text-sm text-muted">
              {h.obec} čp. {h.cp}
              {h.kind && ` · ${h.kind}`}
            </p>
            <h2 className="mt-1 font-serif text-2xl group-hover:text-accent">{h.name || `${h.obec} ${h.cp}`}</h2>
            {h.desc && <p className="mt-2 line-clamp-3 text-sm text-muted">{h.desc}</p>}
            <div className="mt-4">
              <StatusBadge st={h.st} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
