import Link from "next/link";
import type { RecordItem } from "@/lib/types";

const KIND_ICON: Record<string, string> = { N: "✦", O: "⚭", Z: "✝", S: "⌂", G: "▤", K: "▦", M: "◇", I: "☰" };

export function RecordCard({ r }: { r: RecordItem }) {
  return (
    <Link href={`/zdroj/${r.key}/`} className="group flex overflow-hidden rounded-xl border border-line bg-card transition hover:border-accent/50 hover:shadow-sm">
      {r.imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.imgSrc} alt="" className="h-auto w-28 shrink-0 object-cover sepia-[.15]" loading="lazy" />
      ) : (
        <span className="flex w-16 shrink-0 items-center justify-center bg-accent-soft font-serif text-2xl text-accent">{KIND_ICON[r.kind] ?? "§"}</span>
      )}
      <span className="min-w-0 p-4">
        <span className="block text-xs uppercase tracking-wider text-muted">
          {r.kindName} · {r.date}
        </span>
        <span className="mt-0.5 block font-medium group-hover:text-accent">{r.title}</span>
        {r.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted">{r.summary}</span>}
      </span>
    </Link>
  );
}
