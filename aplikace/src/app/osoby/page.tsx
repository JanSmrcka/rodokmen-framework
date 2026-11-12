import { getSite } from "@/lib/data";
import { Empty, isAll, MineToggle, PageHeader } from "@/components/bits";
import { PeopleList, type ListPerson } from "@/components/PeopleList";
import { lifeLabel } from "@/lib/ui";

export const metadata = { title: "Osoby" };

// Výchozí: já, pokrevní příbuzní a manžel(ka); ?vse=1 celý rodokmen.
export default async function PeoplePage({ searchParams }: PageProps<"/osoby">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const all = isAll((await searchParams).vse);
  const mine = new Set(site.mine.people);
  const people: ListPerson[] = Object.values(site.people).filter((p) => all || mine.has(p.slug)).map((p) => ({
    id: p.slug,
    name: p.name,
    years: lifeLabel(p),
    birth: p.birth?.y ?? p.birth?.lo ?? null,
    st: p.st,
    rel: p.rel,
    gen: p.gen,
    line: p.lineSlug,
    place: p.place ?? null,
  }));
  const lines = Object.values(site.lines).map((l) => ({ slug: l.slug, name: l.name, color: l.color }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <PageHeader title="Osoby" lead={all ? `${people.length} lidí v rodokmenu – předci, sourozenci, manželé i kmotři, které se podařilo ztotožnit.` : `${people.length} lidí – vy, vaši pokrevní příbuzní a manžel(ka). Ostatní větve rodiny najdete pod „Vše“.`} />
      <MineToggle path="/osoby/" all={all} mine={mine.size} total={Object.keys(site.people).length} />
      <PeopleList people={people} lines={lines} />
    </div>
  );
}
