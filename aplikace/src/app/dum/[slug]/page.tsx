import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/data";
import type { HouseEntry } from "@/lib/types";
import { Empty, NotFoundMsg, Section } from "@/components/bits";
import { STATUS_LABEL, statusColor } from "@/lib/ui";

export async function generateMetadata({ params }: PageProps<"/dum/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const h = (await getSite())?.houses[slug];
  return { title: h ? `${h.obec} čp. ${h.cp}` : "Dům" };
}

function Rows({ items, render }: { items: HouseEntry[]; render: (e: HouseEntry) => [string, React.ReactNode, string?] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {items.map((e, i) => {
        const [when, what, sub] = render(e);
        return (
          <li key={i} className="relative">
            <span className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full" title={STATUS_LABEL[e.st]} style={{ background: statusColor(e.st) }} />
            <p className="text-sm text-muted tabular-nums">{when}</p>
            <p>{what}</p>
            {sub && <p className="text-sm text-muted">{sub}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export default async function HousePage({ params }: PageProps<"/dum/[slug]">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const { slug } = await params;
  const h = site.houses[slug];
  if (!h) return <NotFoundMsg what="Dům" />;
  const who = (e: HouseEntry) =>
    e.person && site.people[e.person] ? (
      <Link href={`/osoba/${e.person}/`} className="font-medium text-accent hover:underline">
        {e.name || site.people[e.person].name}
      </Link>
    ) : (
      <span className="font-medium">{e.name}</span>
    );
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/domy/" className="hover:text-ink">
          Domy
        </Link>{" "}
        /{" "}
        <Link href={`/misto/${h.obecSlug}/`} className="hover:text-ink">
          {h.obec}
        </Link>
      </nav>
      <p className="text-sm uppercase tracking-[0.15em] text-accent">
        {h.obec} čp. {h.cp}
        {h.kind && ` · ${h.kind}`}
      </p>
      <h1 className="mt-1 font-serif text-5xl font-medium tracking-tight">{h.name || `${h.obec} ${h.cp}`}</h1>
      {h.desc && <p className="mt-4 text-lg text-muted">{h.desc}</p>}
      {h.note && <p className="mt-4 rounded-xl bg-accent-soft/60 p-4 text-sm">{h.note}</p>}
      {h.owners.length > 0 && (
        <Section title="Držitelé">
          <Rows items={h.owners} render={(e) => [[e.since, e.until].filter(Boolean).join("–"), who(e), [e.how, e.note].filter(Boolean).join(" · ")]} />
        </Section>
      )}
      {h.people.length > 0 && (
        <Section title="Obyvatelé">
          <Rows items={h.people} render={(e) => [e.years ?? "", who(e), e.role]} />
        </Section>
      )}
      {h.events.length > 0 && (
        <Section title="Události">
          <Rows items={h.events} render={(e) => [e.year ?? "", e.text, e.source]} />
        </Section>
      )}
      {h.records.length > 0 && (
        <Section title="Prameny">
          <ul className="space-y-1 text-sm">
            {h.records.map((k) => {
              const r = site.records.find((x) => x.key === k);
              return (
                <li key={k}>
                  <Link href={`/zdroj/${k}/`} className="text-accent hover:underline">
                    {r?.title ?? k}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
