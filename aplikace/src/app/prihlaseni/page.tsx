import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { getSettings } from "@/server/vyklad";
import { LoginForm } from "@/components/Forms";

export const metadata = { title: "Přihlášení" };

// ?u=<jméno> předvyplní jméno (QR kód z dárkové karty), ?next=<cesta> návrat po přihlášení
export default async function LoginPage({ searchParams }: PageProps<"/prihlaseni">) {
  const { u, next } = await searchParams;
  if (await getViewer()) redirect(typeof next === "string" ? next : "/");
  const s = await getSettings();
  const kontakt = s.kontakt as { jmeno?: string; email?: string } | undefined;
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-16 md:py-24">
      <p className="mb-3 text-sm uppercase tracking-[0.2em] text-accent">Jen pro rodinu</p>
      <h1 className="font-serif text-4xl font-medium tracking-tight">Rodokmen</h1>
      <p className="mt-3 mb-8 text-muted">Přihlaste se jménem a heslem z karty, kterou jste dostali.</p>
      <LoginForm next={typeof next === "string" ? next : "/"} username={typeof u === "string" ? u : undefined} />
      {kontakt?.email && (
        <p className="mt-8 text-sm text-muted">
          Ztracená karta? Napište {kontakt.jmeno ?? "správci"} na{" "}
          <a href={`mailto:${kontakt.email}`} className="text-accent underline">
            {kontakt.email}
          </a>
          .
        </p>
      )}
    </div>
  );
}
