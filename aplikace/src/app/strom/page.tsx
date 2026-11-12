import { getSite } from "@/lib/data";
import { Empty } from "@/components/bits";
import { Tree, type TreePerson } from "@/components/Tree";
import { lifeLabel, vitalFacts } from "@/lib/ui";

export const metadata = { title: "Strom" };

export default async function TreePage({ searchParams }: PageProps<"/strom">) {
  const site = await getSite();
  if (!site || !site.people[site.root]) return <Empty />;
  const { id } = await searchParams;
  const people: Record<string, TreePerson> = {};
  for (const [k, p] of Object.entries(site.people)) {
    people[k] = {
      id: k,
      name: p.name,
      years: lifeLabel(p),
      ...vitalFacts(p.facts),
      sex: p.sex,
      st: p.st,
      rel: p.rel,
      color: (p.lineSlug && site.lines[p.lineSlug]?.color) || null,
      line: p.lineSlug ? site.lines[p.lineSlug]?.name ?? null : null,
      facts: p.facts,
      father: p.father && site.people[p.father] ? p.father : null,
      mother: p.mother && site.people[p.mother] ? p.mother : null,
      children: p.children.filter((c) => site.people[c]),
      spouses: p.spouses.filter((s) => site.people[s]),
    };
  }
  const focus = typeof id === "string" && people[id] ? id : site.root;
  return <Tree people={people} initialFocus={focus} root={site.root} />;
}
