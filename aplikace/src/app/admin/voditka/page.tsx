import Link from "next/link";
import { requireAdminViewer } from "@/lib/data";
import { listTips } from "@/server/fronta";
import { tipStatusAction } from "../actions";
import { PageHeader } from "@/components/bits";

export const metadata = { title: "Vodítka" };

const STATUS: [string, string][] = [
  ["nezpracovano", "nezpracováno"],
  ["overuje_se", "ověřuje se"],
  ["potvrzeno", "potvrzeno"],
  ["vyvraceno", "vyvráceno"],
  ["nelze_overit", "nejde ověřit"],
  ["rozdeleno", "rozděleno"],
];
const KIND: Record<string, string> = { od_rodiny: "od rodiny", zvest: "zvěst", oprava: "oprava", napad: "nápad" };

// Fronta údajů od rodiny a zvěstí – podklad pro další hledání v matrikách.
export default async function TipsPage({ searchParams }: PageProps<"/admin/voditka">) {
  const actor = await requireAdminViewer();
  const { stav } = await searchParams;
  const all = typeof stav === "string" && stav === "vse";
  const tips = await listTips(actor, all ? { limit: 500 } : { open: true, limit: 500 });
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/admin/" className="hover:text-ink">
          Správa
        </Link>
      </nav>
      <PageHeader title="Vodítka" lead="Co rodina napsala nebo vyprávěla. Nejdřív ověřit v matrikách, pak zapsat do rodokmenu.">
        <p className="mt-4 text-sm">
          <Link href={all ? "/admin/voditka/" : "/admin/voditka/?stav=vse"} className="text-accent hover:underline">
            {all ? "jen nezpracovaná" : "zobrazit i vyřízená"}
          </Link>
        </p>
      </PageHeader>
      {tips.length === 0 && <p className="text-muted">Fronta je prázdná.</p>}
      <ul className="space-y-4">
        {tips.map((t) => (
          <li key={t.id} className="rounded-xl border border-line bg-card p-5">
            <p className="text-xs text-muted">
              #{t.id} · {t.receivedAt.toLocaleDateString("cs-CZ")} · {KIND[t.kind]}
              {t.sensitive && " · citlivé"}
              {t.channel && ` · ${t.channel}`}
              {(t.submittedBy || t.toldByName) && ` · ${t.submittedBy ?? t.toldByName}`}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{t.text}</p>
            {t.persons.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                {t.persons.map((p) => (
                  <Link key={p.personId} href={`/osoba/${p.personId}/`} className="text-accent hover:underline">
                    {p.name || p.personId}
                  </Link>
                ))}
              </p>
            )}
            {t.resolutionNote && <p className="mt-2 text-sm text-muted">→ {t.resolutionNote}</p>}
            <form action={tipStatusAction} className="mt-4 flex flex-wrap items-center gap-2">
              <input type="hidden" name="tipId" value={t.id} />
              <input name="note" placeholder="poznámka k vyřízení" className="min-w-48 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm" />
              {STATUS.filter(([s]) => s !== t.status).map(([s, label]) => (
                <button key={s} name="status" value={s} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-accent/50">
                  {label}
                </button>
              ))}
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
