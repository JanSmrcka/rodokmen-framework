import { dispatch } from "@/server/api";

// Celé API v jednom směrovači (src/server/api.ts); tady jen předání cesty.
type Ctx = { params: Promise<{ path?: string[] }> };
const handle = async (req: Request, ctx: Ctx) => dispatch(req, (await ctx.params).path ?? []);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
