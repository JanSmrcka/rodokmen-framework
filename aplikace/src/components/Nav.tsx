"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavProps {
  title: string;
  loggedIn: boolean;
  admin: boolean;
  me: { id: string; name: string } | null;
  hasStories: boolean;
  hasHouses: boolean;
}

export function Nav({ title, loggedIn, admin, me, hasStories, hasHouses }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = loggedIn
    ? [
        { href: "/strom/", label: "Strom" },
        { href: "/osoby/", label: "Osoby" },
        { href: "/rody/", label: "Rody" },
        { href: "/mapa/", label: "Mapa" },
        ...(hasHouses ? [{ href: "/domy/", label: "Domy" }] : []),
        { href: "/zdroje/", label: "Prameny" },
        ...(hasStories ? [{ href: "/pribehy/", label: "Příběhy" }] : []),
        ...(admin ? [{ href: "/admin/", label: "Správa" }] : []),
      ]
    : [];
  const active = (href: string) => pathname.startsWith(href.replace(/\/$/, ""));
  return (
    <header className="sticky top-0 z-[1000] border-b print:hidden border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link
          href="/"
          title={title}
          aria-label={`${title} – úvod`}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${pathname === "/" ? "bg-accent-soft text-accent" : "text-ink hover:text-accent"}`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
          </svg>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`rounded-full px-3 py-1.5 text-sm transition ${active(i.href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-ink"}`}
            >
              {i.label}
            </Link>
          ))}
          {me && (
            <Link href="/ucet/" title="Můj účet" className="ml-2 rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
              {me.name.split(" ")[0]}
            </Link>
          )}
        </nav>
        {loggedIn && (
          <button className="ml-auto rounded-md p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <nav className="flex flex-col border-t border-line px-4 py-2 md:hidden">
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="py-2 text-sm">
              {i.label}
            </Link>
          ))}
          {me && (
            <Link href="/ucet/" onClick={() => setOpen(false)} className="py-2 text-sm">
              Můj účet ({me.name})
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
