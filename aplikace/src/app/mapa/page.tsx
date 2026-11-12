import Link from "next/link";
import { getSite } from "@/lib/data";
import { Empty } from "@/components/bits";
import { MapView, type MapPlace } from "@/components/MapView";

export const metadata = { title: "Mapa" };

// Výchozí: místa předků přihlášeného (barva = jeho rod). ?vse=1: celá rodina, cizí linie tlumeně.
export default async function MapPage({ searchParams }: PageProps<"/mapa">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const all = (await searchParams).vse === "1";
  const lineByK = new Map(Object.values(site.lines).map((l) => [l.k, l]));
  const places: MapPlace[] = site.places
    .filter((p) => typeof p.lat === "number" && typeof p.lon === "number")
    .map((p) => {
      const mineIds = p.mine ?? [];
      const ids = all ? p.lines.flatMap((l) => l.people) : mineIds;
      // barva: rod, ke kterému patří nejvíc osob z místa
      const counts = new Map<string, number>();
      for (const id of ids) {
        const slug = site.people[id]?.lineSlug;
        if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
      const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      const line = top ? site.lines[top] : p.lines.map((l) => lineByK.get(l.k)).find(Boolean);
      return {
        slug: p.slug,
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        count: ids.length,
        color: line?.color || "#7a3b2e",
        years: p.years?.length === 2 ? `${p.years[0]}–${p.years[1]}` : "",
        hypothesis: p.hypothesis,
        dim: all && mineIds.length === 0,
      };
    })
    .filter((p) => p.count > 0);
  const me = site.people[site.root];
  const pill = (active: boolean) =>
    `pointer-events-auto rounded-full px-3 py-1 text-sm transition ${active ? "bg-accent text-paper" : "border border-line bg-card text-muted hover:text-ink"}`;
  return (
    <div className="relative h-[calc(100dvh-3.5rem)]">
      <MapView places={places} />
      <div className="pointer-events-none absolute top-4 left-14 z-[500] max-w-[calc(100%-4.5rem)] rounded-xl border border-line bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
        <h1 className="font-serif text-2xl">{all ? "Odkud jsme" : "Odkud jsou moji předci"}</h1>
        <p className="text-sm text-muted">
          {places.length} míst · velikost = počet osob, barva = rod{all && " · tlumeně = mimo vaši linii"}
        </p>
        <div className="mt-2 flex gap-2">
          <Link href="/mapa/" className={pill(!all)}>
            Moje linie{me ? ` (${me.name.split(" ")[0]})` : ""}
          </Link>
          <Link href="/mapa/?vse=1" className={pill(all)}>
            Celá rodina
          </Link>
        </div>
      </div>
    </div>
  );
}
