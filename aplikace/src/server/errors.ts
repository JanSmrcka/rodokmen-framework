// Chyby doménové vrstvy; API je převádí na HTTP status a JSON {chyba}.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, `Nenalezeno: ${what}`);
export const badRequest = (msg: string, detail?: unknown) => new ApiError(400, msg, detail);
export const forbidden = (msg = "Nemáte oprávnění.") => new ApiError(403, msg);
export const conflict = (msg: string) => new ApiError(409, msg);

export function must<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) throw notFound(what);
  return v;
}
