import Link from "next/link";
import { requireAdminViewer } from "@/lib/data";
import { listTasks, listTips } from "@/server/fronta";
import { listAccounts } from "@/server/uzivatele";
import { toggleDisabledAction } from "./actions";
import { PageHeader, Section } from "@/components/bits";
import { CreateAccounts, ResetPassword } from "@/components/GiftCards";

export const metadata = { title: "Správa" };

export default async function AdminPage() {
  const actor = await requireAdminViewer();
  const [rows, tips, tasks] = await Promise.all([listAccounts(actor), listTips(actor, { open: true }), listTasks({})]);
  const withAccount = rows.filter((r) => r.account);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="print:hidden">
        <PageHeader title="Správa" lead="Přístupy pro žijící členy rodiny, fronta vodítek a rozpracované úkoly." />
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/admin/voditka/" className="rounded-xl border border-line bg-card p-5 hover:border-accent/50">
            <p className="text-sm text-muted">Nezpracovaná vodítka</p>
            <p className="mt-1 font-serif text-4xl">{tips.length}</p>
          </Link>
          <div className="rounded-xl border border-line bg-card p-5">
            <p className="text-sm text-muted">Otevřené úkoly</p>
            <p className="mt-1 font-serif text-4xl">{tasks.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-card p-5">
            <p className="text-sm text-muted">Účty</p>
            <p className="mt-1 font-serif text-4xl">
              {withAccount.length}
              <span className="text-lg text-muted"> / {rows.length} žijících</span>
            </p>
          </div>
        </div>
      </div>

      <Section title="Nové přístupy (dárkové karty)">
        <p className="mb-4 text-sm text-muted print:hidden">
          Vyberte žijící příbuzné ze stromu. Každý dostane jméno a heslo; vytiskněte je jako kartu. Kdo tu chybí, není ve stromu vedený jako žijící.
        </p>
        <CreateAccounts rows={rows} />
      </Section>

      {withAccount.length > 0 && (
        <div className="print:hidden">
          <Section title="Účty">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-card text-left text-muted">
                  <tr>
                    <th className="px-4 py-2 font-normal">Osoba</th>
                    <th className="px-4 py-2 font-normal">Jméno</th>
                    <th className="px-4 py-2 font-normal">Naposledy</th>
                    <th className="px-4 py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {withAccount.map((r) => (
                    <tr key={r.personId} className="border-t border-line">
                      <td className="px-4 py-2">
                        <Link href={`/osoba/${r.personId}/`} className="hover:text-accent">
                          {r.name}
                        </Link>
                        <span className="block text-xs text-muted">{r.relation}</span>
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {r.account!.username}
                        {r.account!.role === "admin" && <span className="ml-2 text-xs text-accent">správce</span>}
                        {!r.account!.passwordChanged && <span className="block text-xs text-muted">heslo z karty</span>}
                      </td>
                      <td className="px-4 py-2 text-muted">{r.account!.lastSeen ? r.account!.lastSeen.toLocaleDateString("cs-CZ") : "ještě ne"}</td>
                      <td className="space-x-3 px-4 py-2 text-right whitespace-nowrap">
                        <ResetPassword userId={r.account!.id} />
                        <form action={toggleDisabledAction} className="inline">
                          <input type="hidden" name="userId" value={r.account!.id} />
                          <input type="hidden" name="disabled" value={r.account!.disabled ? "0" : "1"} />
                          <button className="text-xs text-muted hover:text-ink">{r.account!.disabled ? "povolit" : "zablokovat"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {tasks.length > 0 && (
            <Section title="Rozpracované úkoly">
              <ul className="space-y-2 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="rounded-lg border border-line bg-card px-4 py-3">
                    <span className="font-medium">{t.title}</span>
                    <span className="ml-2 text-xs text-muted">
                      {t.kind} · {t.status} · priorita {t.priority}
                    </span>
                    {t.body && <p className="mt-1 text-muted">{t.body}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
