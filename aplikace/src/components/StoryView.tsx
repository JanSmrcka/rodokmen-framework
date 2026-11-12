import Link from "next/link";
import type { Story } from "@/lib/data";

export function StoryView({ story, fallbackTitle, back }: { story: Story; fallbackTitle: string; back?: { href: string; label: string } }) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 md:py-16">
      {back && (
        <nav className="mb-6 text-sm text-muted">
          <Link href={back.href} className="hover:text-ink">
            {back.label}
          </Link>
        </nav>
      )}
      <h1 className="font-serif text-5xl font-medium tracking-tight md:text-6xl">{story.title || fallbackTitle}</h1>
      {story.lead && <p className="mt-4 font-serif text-xl text-muted italic">{story.lead}</p>}
      {story.headings.length > 2 && (
        <nav className="mt-8 rounded-xl border border-line bg-card p-5 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            {story.headings.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="hover:text-accent">
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="prose-story mt-10" dangerouslySetInnerHTML={{ __html: story.html }} />
    </article>
  );
}
