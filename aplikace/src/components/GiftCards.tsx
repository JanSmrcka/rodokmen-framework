"use client";

import { useActionState } from "react";
import { createAccountsAction, resetPasswordAction, type Card, type CardsState } from "@/app/admin/actions";

// Tisk: A4 na výšku, 2 × 3 karty, ořezové linky; přihlašovací údaje jsou vidět jen hned po vygenerování.
export function CardSheet({ state }: { state: CardsState }) {
  if (state.error) return <p className="rounded-xl border border-line bg-card p-4 text-sm text-[var(--st-mh)]">{state.error}</p>;
  if (!state.cards?.length) return null;
  return (
    <section className="print-area mt-8">
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <p className="text-sm text-muted">
          Hesla se ukazují <strong className="text-ink">jen teď</strong>. Vytiskněte karty (nebo uložte jako PDF) dřív, než stránku zavřete.
        </p>
        <button onClick={() => window.print()} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-paper">
          Tisknout karty
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
        {state.cards.map((c) => (
          <GiftCard key={c.userId} c={c} title={state.title ?? "Rodokmen"} />
        ))}
      </div>
    </section>
  );
}

function GiftCard({ c, title }: { c: Card; title: string }) {
  return (
    <article className="gift-card relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-card p-6 print:h-[93mm] print:rounded-none print:border-dashed">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-accent-soft" />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Veselé Vánoce</p>
        <h2 className="mt-1 font-serif text-2xl leading-tight font-medium">{title}</h2>
        <p className="mt-3 text-sm text-muted">
          pro <strong className="text-ink">{c.name}</strong>
          {c.relation && c.relation !== "já" && <> · {c.relation}</>}
        </p>
        <p className="mt-2 text-sm leading-snug text-muted">Rodinný strom z matrik – předci, jejich domy a příběhy. Celý strom uvidíte od sebe.</p>
      </div>
      <div className="relative mt-4 flex items-end gap-4">
        <div className="h-24 w-24 shrink-0" dangerouslySetInnerHTML={{ __html: c.qr }} />
        <dl className="min-w-0 text-sm">
          <dt className="text-xs text-muted">adresa</dt>
          <dd className="truncate font-medium">{c.url.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</dd>
          <dt className="mt-1 text-xs text-muted">jméno</dt>
          <dd className="font-mono font-medium">{c.username}</dd>
          <dt className="mt-1 text-xs text-muted">heslo</dt>
          <dd className="font-mono font-medium">{c.password}</dd>
        </dl>
      </div>
    </article>
  );
}

export interface LivingRow {
  personId: string;
  name: string;
  birthYear: number | null;
  relation: string;
  account: { id: number; username: string; role: string; disabled: boolean; lastSeen: Date | null; passwordChanged: boolean } | null;
}

export function CreateAccounts({ rows }: { rows: LivingRow[] }) {
  const [state, action, pending] = useActionState(createAccountsAction, {});
  const free = rows.filter((r) => !r.account);
  return (
    <>
      <form action={action} className="print:hidden">
        {free.length === 0 ? (
          <p className="text-sm text-muted">Všichni žijící ve stromu už účet mají.</p>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2">
              {free.map((r) => (
                <li key={r.personId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-card px-3 py-2 hover:border-accent/50">
                    <input type="checkbox" name="personId" value={r.personId} />
                    <span>
                      <span className="block font-medium">{r.name}</span>
                      <span className="block text-xs text-muted">{[r.relation, r.birthYear && `* ${r.birthYear}`].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button disabled={pending} className="mt-4 rounded-full bg-accent px-6 py-3 font-medium text-paper disabled:opacity-50">
              {pending ? "Vytvářím…" : "Vytvořit přístupy a karty"}
            </button>
          </>
        )}
      </form>
      <CardSheet state={state} />
    </>
  );
}

export function ResetPassword({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return (
    <>
      <form action={action} className="inline print:hidden">
        <input type="hidden" name="userId" value={userId} />
        <button disabled={pending} className="text-xs text-accent hover:underline">
          nové heslo + karta
        </button>
      </form>
      {state.cards && (
        <div className="col-span-full">
          <CardSheet state={state} />
        </div>
      )}
    </>
  );
}
