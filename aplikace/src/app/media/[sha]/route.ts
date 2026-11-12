import { actorFromRequest } from "@/server/api";
import { getMedia } from "@/server/prameny";

// Obrázek z DB podle otisku obsahu: adresa se nikdy nemění, takže se cachuje napořád –
// ale jen v prohlížeči přihlášeného (private), ne na CDN.
export async function GET(req: Request, ctx: RouteContext<"/media/[sha]">) {
  if (!(await actorFromRequest(req))) return new Response("Nepřihlášeno", { status: 401 });
  const { sha } = await ctx.params;
  const m = await getMedia(sha);
  if (!m) return new Response("Nenalezeno", { status: 404 });
  return new Response(new Uint8Array(m.bytes), {
    headers: {
      "Content-Type": m.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: `"${sha}"`,
    },
  });
}
