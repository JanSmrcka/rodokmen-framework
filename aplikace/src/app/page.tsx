import Link from "next/link";
import { getSite } from "@/lib/data";
import { Empty, PersonChip } from "@/components/bits";
import { cz } from "@/lib/ui";

// Úvod pro přihlášeného: jeho předci, jeho rody, příběhy, které se ho týkají.
export default async function Home() {
  const site = await getSite();
  if (!site || !site.people[site.root]) return <Empty />;
  const { config, mine } = site;
  const me = site.people[site.root];
  const anc = mine.ancestors.map((id) => site.people[id]).filter(Boolean);
  const born = (p: (typeof anc)[number]) => (p.birth?.q === "calc" ? undefined : (p.birth?.y ?? p.birth?.lo ?? undefined));
  const oldest = anc
    .filter((p) => p.st === "doc" && born(p))
    .sort((a, b) => born(a)! - born(b)!)[0];
  const gens = Math.max(0, ...anc.map((p) => p.gen ?? 0));
  const tiles = [
    { n: anc.length, l: cz(anc.length, "známý předek", "známí předci", "známých předků") },
    { n: anc.filter((p) => p.st === "doc").length, l: "doloženo matrikou" },
    { n: gens, l: cz(gens, "generace", "generace", "generací") + " nazpět" },
    ...(oldest ? [{ n: born(oldest)!, l: "nejstarší doložené narození" }] : []),
    { n: site.stats.people ?? 0, l: "osob v celém rodokmenu" },
  ];
  const lines = mine.lines.map((s) => site.lines[s]).filter(Boolean);
  const storyTitle: Record<string, string> = {
    "/pribeh-rodu/": config.pribeh?.menu || "Příběh rodu",
    "/zajimavosti/": "Zajímavosti",
    "/pribeh-domu/": "Příběh domu",
    ...Object.fromEntries((config.pribehy ?? []).map((p) => [`/pribeh/${p.slug}/`, p.titulek])),
  };
  const stories = mine.stories.filter((h) => storyTitle[h] && h !== "/zajimavosti/");
  const parents = [me.father, me.mother].filter((id): id is string => !!id && !!site.people[id]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 md:py-20">
      <section className="grid gap-12 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-accent">Váš rodokmen</p>
          <h1 className="font-serif text-5xl leading-[1.05] font-medium tracking-tight md:text-7xl">{me.name}</h1>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted">
            <p>
              Strom začíná u vás. Čísla předků, označení jako „prababička“ nebo „strýc“ i mapa se počítají od vaší osoby.
              {oldest && (
                <>
                  {" "}
                  Nejstarší doložený předek je{" "}
                  <Link href={`/osoba/${oldest.slug}/`} className="text-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                    {oldest.name}
                  </Link>{" "}
                  ({oldest.rel}, * {born(oldest)}).
                </>
              )}
            </p>
            <p>Všechno pochází z digitalizovaných matrik a archivů. Celý rodokmen vidíte i s ostatními větvemi rodiny.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/strom/" className="rounded-full bg-accent px-6 py-3 font-medium text-paper transition hover:opacity-90">
              Můj strom
            </Link>
            <Link href="/mapa/" className="rounded-full border border-line px-6 py-3 font-medium transition hover:border-accent/50">
              Odkud jsou moji předci
            </Link>
            {stories[0] && (
              <Link href={stories[0]} className="rounded-full border border-line px-6 py-3 font-medium transition hover:border-accent/50">
                {storyTitle[stories[0]]} →
              </Link>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {tiles.map((t) => (
            <div key={t.l} className="bg-card p-5 odd:last:col-span-2">
              <dt className="text-sm text-muted">{t.l}</dt>
              <dd className="mt-1 font-serif text-4xl tabular-nums">{t.n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {lines.length > 0 && (
        <section className="mt-20">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-3xl font-medium">Moje rody</h2>
            <Link href="/rody/" className="text-sm text-accent">
              všechny rody →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {lines.map((l) => (
              <Link key={l.slug} href={`/rod/${l.slug}/`} className="group overflow-hidden rounded-xl border border-line bg-card transition hover:shadow-sm">
                <div className="h-1.5" style={{ background: l.color }} />
                <div className="p-5">
                  <h3 className="font-serif text-xl group-hover:text-accent">{l.name}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {l.people.length} {cz(l.people.length, "osoba", "osoby", "osob")}
                    {site.people[l.root] && ` · ${site.people[l.root].rel}`}
                  </p>
                  {!l.auto && <p className="mt-3 line-clamp-3 text-sm text-muted">{l.desc}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stories.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-serif text-3xl font-medium">Příběhy mé rodiny</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stories.map((h) => (
              <Link key={h} href={h} className="rounded-xl border border-line bg-card p-5 font-serif text-xl transition hover:border-accent/50 hover:shadow-sm">
                {storyTitle[h]} →
              </Link>
            ))}
          </div>
        </section>
      )}

      {!!config.zajimavosti_na_uvodu?.length && (
        <section className="mt-20">
          <h2 className="mb-6 font-serif text-3xl font-medium">Zajímavosti</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {config.zajimavosti_na_uvodu.map((z) => (
              <Link key={z.nadpis} href={z.href} className="rounded-xl border border-line bg-card p-5 transition hover:border-accent/50 hover:shadow-sm">
                <h3 className="font-serif text-xl leading-snug">{z.nadpis}</h3>
                <p className="mt-2 text-sm text-muted">{z.text}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-20">
        <h2 className="mb-6 font-serif text-3xl font-medium">Začátek stromu</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PersonChip site={site} id={site.root} sub="já" />
          {parents.map((id) => (
            <PersonChip key={id} site={site} id={id} sub={site.people[id]?.rel} />
          ))}
          {me.spouses
            .filter((id) => site.people[id])
            .map((id) => (
              <PersonChip key={id} site={site} id={id} sub={site.people[id]?.rel} />
            ))}
        </div>
      </section>
    </div>
  );
}
