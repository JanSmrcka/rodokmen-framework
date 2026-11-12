import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAccount } from "@/db/schema";
import { getSite, requireViewer } from "@/lib/data";
import { logoutAction } from "@/app/actions";
import { listTips } from "@/server/fronta";
import { PageHeader, Section } from "@/components/bits";
import { PasswordForm } from "@/components/Forms";

export const metadata = { title: "Můj účet" };

const TIP_STATUS: Record<string, string> = {
  nezpracovano: "čeká na zpracování",
  overuje_se: "ověřuje se",
  potvrzeno: "potvrzeno",
  vyvraceno: "vyvráceno",
  nelze_overit: "nejde ověřit",
  rozdeleno: "rozděleno na menší",
};

export default async function AccountPage() {
  const viewer = await requireViewer();
  const site = await getSite();
  const [u] = viewer.userId ? await db().select().from(userAccount).where(eq(userAccount.id, viewer.userId)) : [];
  const tips = await listTips(viewer, { limit: 100 });
  const me = site?.people[site.root];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <PageHeader title="Můj účet" lead={me ? `Přihlášen(a) jako ${me.name} (${u?.username}). Strom, čísla předků i příbuzenství vidíte od sebe.` : undefined}>
        <div className="mt-5 flex flex-wrap gap-3">
          {me && (
            <Link href={`/osoba/${me.slug}/`} className="rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:border-accent/50">
              Moje stránka →
            </Link>
          )}
          <form action={logoutAction}>
            <button className="rounded-full border border-line px-5 py-2.5 text-sm text-muted hover:text-ink">Odhlásit se</button>
          </form>
        </div>
      </PageHeader>
      <Section title="Změna hesla">
        <p className="mb-4 text-sm text-muted">
          {u?.passwordChangedAt ? "Heslo jste už změnili." : "Používáte heslo z karty. Změnit ho můžete, ale nemusíte."}
        </p>
        <PasswordForm />
      </Section>
      {tips.length > 0 && (
        <Section title="Co jsem poslal(a)">
          <ul className="space-y-3">
            {tips.map((t) => (
              <li key={t.id} className="rounded-xl border border-line bg-card p-4 text-sm">
                <p className="text-xs text-muted">
                  {t.receivedAt.toLocaleDateString("cs-CZ")} · {TIP_STATUS[t.status]}
                  {t.persons.length > 0 && ` · ${t.persons.map((p) => p.name).join(", ")}`}
                </p>
                <p className="mt-1">{t.text}</p>
                {t.resolutionNote && <p className="mt-2 text-muted">→ {t.resolutionNote}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
