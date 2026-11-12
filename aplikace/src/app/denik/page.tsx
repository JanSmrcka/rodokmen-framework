import Link from "next/link";
import { marked } from "marked";
import { getSite } from "@/lib/data";
import { listLog } from "@/server/fronta";
import { Empty, PageHeader, Section } from "@/components/bits";

export const metadata = { title: "Deník bádání" };

const RESULT: Record<string, string> = { nalezeno: "nalezeno", nenalezeno: "nenalezeno", castecne: "částečně", jine: "" };

export default async function LogPage() {
  const site = await getSite();
  if (!site) return <Empty />;
  const log = await listLog({ limit: 300 });
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <PageHeader title="Deník bádání" lead="Co se kde hledalo – i neúspěšná hledání, otevřené otázky a hypotézy." />
      {site.issues.length > 0 && (
        <Section title="Otevřené otázky">
          <div className="grid gap-3 md:grid-cols-2">
            {site.issues.map((i) => (
              <div key={i.title} className="rounded-xl border border-line bg-card p-5">
                <h3 className="font-serif text-lg">{i.title}</h3>
                <p className="mt-1 text-sm text-muted">{i.text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {site.hypotheses.length > 0 && (
        <Section title="Hypotézy">
          <div className="grid gap-3 md:grid-cols-2">
            {site.hypotheses.map((h) => (
              <div key={h.title} className="rounded-xl border border-dashed border-line bg-card p-5">
                <h3 className="font-serif text-lg">{h.title}</h3>
                <p className="mt-1 text-sm text-muted">{h.text}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {log.length > 0 && (
        <Section title="Záznam hledání">
          <ol className="space-y-4">
            {log.map((l) => (
              <li key={l.id} className="rounded-xl border border-line bg-card p-5">
                <p className="text-xs text-muted">
                  {l.at.toLocaleDateString("cs-CZ")}
                  {l.pages && ` · ${l.pages}`}
                  {RESULT[l.result] && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 ${l.result === "nalezeno" ? "bg-accent-soft text-accent" : "border border-line"}`}>
                      {RESULT[l.result]}
                    </span>
                  )}
                </p>
                <h3 className="mt-1 font-serif text-lg">{l.title}</h3>
                {l.textMd && <div className="prose-story mt-2 !text-base" dangerouslySetInnerHTML={{ __html: marked.parse(l.textMd, { async: false }) as string }} />}
                {(l.recordKeys.length > 0 || l.personIds.length > 0) && (
                  <p className="mt-2 flex flex-wrap gap-2 text-sm">
                    {l.recordKeys.map((k) => (
                      <Link key={k} href={`/zdroj/${k}/`} className="text-accent hover:underline">
                        {site.records.find((r) => r.key === k)?.title ?? k}
                      </Link>
                    ))}
                    {l.personIds
                      .filter((id) => site.people[id])
                      .map((id) => (
                        <Link key={id} href={`/osoba/${id}/`} className="text-muted hover:text-ink">
                          {site.people[id].name}
                        </Link>
                      ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}
