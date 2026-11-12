import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { marked } from "marked";
import type { Actor } from "@/server/actor";
import { actorFromSession, SESSION_COOKIE } from "@/server/auth";
import { getSiteFor, getStoryRow } from "@/server/web";
import type { Site } from "./types";

// Přihlášený člen rodiny (jednou za požadavek). Bez přihlášení → přihlašovací stránka.
export const getViewer = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return actorFromSession(token);
});

export async function requireViewer(): Promise<Actor> {
  const a = await getViewer();
  if (!a) redirect("/prihlaseni/");
  return a;
}

// správa: ostatním se stránka „neexistuje“
export async function requireAdminViewer(): Promise<Actor> {
  const a = await requireViewer();
  if (a.role !== "admin") notFound();
  return a;
}

// Data webu z pohledu přihlášeného: kořen stromu, Kekulé a příbuznost se počítají od jeho osoby.
export const getSite = cache(async (): Promise<Site | null> => {
  const a = await requireViewer();
  const site = await getSiteFor(a);
  return Object.keys(site.people).length ? site : null;
});

export interface Story {
  title: string;
  lead: string;
  html: string;
  headings: { id: string; text: string }[];
}

// příběh z DB (markdown) → HTML s kotvami u nadpisů
export async function getStory(slug: string): Promise<Story | null> {
  await requireViewer();
  const s = await getStoryRow(slug);
  if (!s) return null;
  const headings: Story["headings"] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map((t) => ("text" in t ? t.text : t.raw)).join("");
    const id = slugifyHeading(text);
    if (depth === 2) headings.push({ id, text });
    return `<h${depth} id="${id}">${marked.parseInline(text)}</h${depth}>`;
  };
  const html = marked.parse(s.bodyMd, { renderer, async: false }) as string;
  if (!html.trim()) return null;
  return { title: s.title, lead: s.lead ?? "", html, headings };
}

// kotvy ve stylu GitHubu: malá písmena, mezery → pomlčky, diakritika zůstává
function slugifyHeading(text: string) {
  return text
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .replace(/\s/g, "-");
}
