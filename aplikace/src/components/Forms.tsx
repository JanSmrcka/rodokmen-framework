"use client";

import { useActionState } from "react";
import { changePasswordAction, loginAction, tipAction, type FormState } from "@/app/actions";

const input = "w-full rounded-lg border border-line bg-card px-3 py-2.5 outline-none focus:border-accent/60";
const button = "rounded-full bg-accent px-6 py-3 font-medium text-paper transition hover:opacity-90 disabled:opacity-50";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p className="text-sm text-[var(--st-mh)]" aria-live="polite">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-accent" aria-live="polite">{state.ok}</p>;
  return null;
}

export function LoginForm({ next, username }: { next: string; username?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Přihlašovací jméno</span>
        <input name="username" defaultValue={username} autoComplete="username" autoCapitalize="none" required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Heslo</span>
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>
      <Message state={state} />
      <button disabled={pending} className={`${button} w-full`}>
        {pending ? "Přihlašuji…" : "Přihlásit se"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, {});
  return (
    <form action={action} className="max-w-sm space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Současné heslo (z karty)</span>
        <input name="old" type="password" autoComplete="current-password" required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Nové heslo (aspoň 8 znaků)</span>
        <input name="new" type="password" autoComplete="new-password" minLength={8} required className={input} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-muted">Nové heslo znovu</span>
        <input name="new2" type="password" autoComplete="new-password" minLength={8} required className={input} />
      </label>
      <Message state={state} />
      <button disabled={pending} className={button}>
        Změnit heslo
      </button>
    </form>
  );
}

export function TipForm({ personId, name }: { personId: string; name: string }) {
  const [state, action, pending] = useActionState(tipAction, {});
  if (state.ok) return <p className="rounded-xl bg-accent-soft/60 p-4 text-sm">{state.ok}</p>;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-card p-4">
      <input type="hidden" name="personId" value={personId} />
      <p className="text-sm text-muted">
        Pamatujete si něco o osobě <strong className="text-ink">{name}</strong>, máte doma dokument, nebo jste slyšeli nějakou zvěst? Napište to – nejdřív to
        ověříme v matrikách a pak doplníme do rodokmenu.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="od_rodiny" defaultChecked /> vím to / mám doklad
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" value="zvest" /> zvěst, vyprávění
        </label>
      </div>
      <textarea name="text" rows={4} required className={input} placeholder="Např. Děda vyprávěl, že se narodil ve mlýně u…" />
      <input name="channel" className={input} placeholder="Odkud to víte? (z paměti, od babičky, rodný list…)" />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="sensitive" /> citlivé – ať to vidí jen správce rodokmenu
      </label>
      <Message state={state} />
      <button disabled={pending} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-paper disabled:opacity-50">
        Odeslat
      </button>
    </form>
  );
}
