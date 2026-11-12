import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import { getViewer } from "@/lib/data";
import { getSiteFor } from "@/server/web";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const dynamic = "force-dynamic";

const display = Newsreader({ variable: "--font-display", subsets: ["latin", "latin-ext"], style: ["normal", "italic"] });
const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  // obecný název: web vidí obě (všechny) větve rodiny
  return {
    title: { default: "Rodokmen", template: "%s · Rodokmen" },
    description: "Rodinný rodokmen z českých matrik",
    robots: { index: false, follow: false },
  };
}

// layout se vykreslí i na přihlašovací stránce – bez přihlášení jen název
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  const site = viewer ? await getSiteFor(viewer) : null;
  const nazev = "Rodokmen";
  const stories = site ? (site.config.maPribeh ? 1 : 0) + (site.config.pribehy?.length ?? 0) : 0;
  const me = viewer && site ? site.people[site.root] : null;
  return (
    <html lang="cs" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Nav
          title={nazev}
          loggedIn={!!viewer}
          admin={viewer?.role === "admin"}
          me={me ? { id: me.slug, name: me.name } : null}
          hasStories={stories > 0}
          hasHouses={!!site && Object.keys(site.houses).length > 0}
        />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-line py-6 print:hidden text-center text-sm text-muted">{site?.config.zapati || "Rodokmen z českých matrik"}</footer>
      </body>
    </html>
  );
}
