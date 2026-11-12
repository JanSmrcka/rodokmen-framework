import Link from "next/link";
import type { Metadata } from "next";
import { getSite } from "@/lib/data";
import { Empty, NotFoundMsg, PersonChip, Section } from "@/components/bits";

export async function generateMetadata({ params }: PageProps<"/zdroj/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: (await getSite())?.records.find((r) => r.key === key)?.title ?? "Zápis" };
}

export default async function RecordPage({ params }: PageProps<"/zdroj/[key]">) {
  const site = await getSite();
  if (!site) return <Empty />;
  const { key } = await params;
  const r = site.records.find((x) => x.key === key);
  if (!r) return <NotFoundMsg what="Zápis" />;
  const meta = [
    ["Archiv", r.archive],
    ["Svazek", r.volume],
    ["Popis svazku", r.vdesc],
    ["Snímek", r.scan],
    ["Portál", r.portal],
  ].filter(([, v]) => v);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/zdroje/" className="hover:text-ink">
          Prameny
        </Link>{" "}
        / {r.kindName}
      </nav>
      <p className="text-sm uppercase tracking-[0.15em] text-accent">
        {r.kindName} · {r.date}
      </p>
      <h1 className="mt-1 font-serif text-4xl font-medium tracking-tight md:text-5xl">{r.title}</h1>
      {r.summary && <p className="mt-3 max-w-3xl text-lg text-muted">{r.summary}</p>}

      {r.imgSrc && (
        <figure className="mt-8 overflow-hidden rounded-2xl border border-line bg-card">
          <a href={r.fullSrc ?? r.imgSrc} target="_blank" className="relative block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imgSrc} alt={r.title} className="w-full" />
            {r.boxes.map(([x0, y0, x1, y1], i) => (
              <span
                key={i}
                className="absolute rounded-sm ring-2 ring-accent/80"
                style={{ left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%` }}
              />
            ))}
          </a>
          {r.full && <figcaption className="px-4 py-2 text-xs text-muted">Kliknutím otevřete snímek v plném rozlišení.</figcaption>}
        </figure>
      )}

      <div className="grid gap-x-12 md:grid-cols-[1.4fr_1fr]">
        <div>
          {r.orig && (
            <Section title="Přepis">
              <pre className="rounded-xl border border-line bg-card p-5 font-serif text-base leading-relaxed whitespace-pre-wrap">{r.orig}</pre>
            </Section>
          )}
          {r.cs && (
            <Section title="Překlad">
              <p className="font-serif text-lg leading-relaxed">{r.cs}</p>
            </Section>
          )}
        </div>
        <aside>
          <Section title="Pramen">
            <dl className="space-y-2 text-sm">
              {meta.map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent underline-offset-2 hover:underline">
                Otevřít v archivu ↗
              </a>
            )}
          </Section>
          {r.people.length > 0 && (
            <Section title="Osoby v zápisu">
              <div className="grid gap-2">
                {r.people.map((id) => (
                  <PersonChip key={id} site={site} id={id} />
                ))}
              </div>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
}
