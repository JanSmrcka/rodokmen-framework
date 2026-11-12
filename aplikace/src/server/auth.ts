// Přihlášení: jméno + heslo z dárkové karty → session v DB (cookie). API: Bearer token.
import { createHash, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiToken, loginAttempt, session, userAccount } from "@/db/schema";
import type { Actor } from "./actor";
import { ApiError } from "./errors";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const SESSION_COOKIE = "rodokmen_session";
export const SESSION_DAYS = 365;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const want = Buffer.from(k, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), want.length, SCRYPT);
  return timingSafeEqual(want, got);
}

// Čitelné heslo na kartu: tři česká slova bez diakritiky a číslo (bez l/1/O/0 záměn).
const WORDS = [
  "jablon", "kovar", "mlyn", "statek", "louka", "potok", "kostel", "zvon", "chalupa", "pole",
  "seno", "vcela", "hrnec", "kolac", "studna", "humno", "stodola", "kamna", "lipa", "dub",
  "brana", "pekar", "tesar", "rybnik", "kapr", "husa", "kohout", "obili", "mak", "len",
  "vuz", "sanky", "kniha", "matrika", "farar", "kmotr", "svatba", "krtiny", "pamet", "vnuk",
  "babicka", "deda", "strycek", "teta", "bratr", "sestra", "domov", "rodina", "strom", "koren",
  "hvezda", "mesic", "slunce", "duha", "vitr", "snih", "jaro", "leto", "podzim", "zima",
];
export function generatePassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${w()}-${randomInt(2, 99)}`;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ----- sessions -----
export async function createSession(userId: number): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db().insert(session).values({ idHash: sha(token), userId, expiresAt: expires });
  return { token, expires };
}

export async function deleteSession(token: string) {
  await db().delete(session).where(eq(session.idHash, sha(token)));
}

export async function actorFromSession(token: string | undefined): Promise<Actor | null> {
  if (!token) return null;
  const rows = await db()
    .select({ u: userAccount })
    .from(session)
    .innerJoin(userAccount, eq(session.userId, userAccount.id))
    .where(and(eq(session.idHash, sha(token)), gt(session.expiresAt, new Date())))
    .limit(1);
  const u = rows[0]?.u;
  if (!u || u.disabled) return null;
  // last_seen stačí obnovit jednou za hodinu
  if (!u.lastSeen || Date.now() - u.lastSeen.getTime() > 36e5) {
    await db().update(userAccount).set({ lastSeen: new Date() }).where(eq(userAccount.id, u.id));
  }
  return { name: `user:${u.username}`, role: u.role, userId: u.id, personId: u.personId };
}

// ----- přihlášení -----
const WINDOW_MIN = 15;
const MAX_FAILS = 5;

export async function login(username: string, password: string, ip: string | null) {
  const name = username.trim().toLowerCase();
  const since = new Date(Date.now() - WINDOW_MIN * 6e4);
  const [fails] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempt)
    .where(and(eq(loginAttempt.username, name), eq(loginAttempt.ok, false), gt(loginAttempt.at, since)));
  if (fails.n >= MAX_FAILS) {
    throw new ApiError(429, `Příliš mnoho pokusů. Zkuste to znovu za ${WINDOW_MIN} minut.`);
  }
  const [u] = await db().select().from(userAccount).where(eq(userAccount.username, name)).limit(1);
  const ok = !!u && !u.disabled && (await verifyPassword(password, u.passwordHash));
  await db().insert(loginAttempt).values({ username: name, ip, ok });
  if (!ok) throw new ApiError(401, "Špatné jméno nebo heslo.");
  return createSession(u.id);
}

export async function changePassword(userId: number, oldPw: string, newPw: string) {
  if (newPw.length < 8) throw new ApiError(400, "Nové heslo musí mít aspoň 8 znaků.");
  const [u] = await db().select().from(userAccount).where(eq(userAccount.id, userId)).limit(1);
  if (!u || !(await verifyPassword(oldPw, u.passwordHash))) throw new ApiError(400, "Současné heslo nesouhlasí.");
  await db()
    .update(userAccount)
    .set({ passwordHash: await hashPassword(newPw), passwordChangedAt: new Date() })
    .where(eq(userAccount.id, userId));
}

// ----- API tokeny -----
export async function createApiToken(name: string, role: "admin" | "agent"): Promise<string> {
  const token = `rdk_${randomBytes(24).toString("base64url")}`;
  await db()
    .insert(apiToken)
    .values({ name, role, tokenHash: sha(token) })
    .onConflictDoUpdate({ target: apiToken.name, set: { tokenHash: sha(token), role, disabled: false } });
  return token;
}

export async function actorFromToken(token: string): Promise<Actor | null> {
  const [t] = await db().select().from(apiToken).where(eq(apiToken.tokenHash, sha(token))).limit(1);
  if (!t || t.disabled) return null;
  if (!t.lastUsed || Date.now() - t.lastUsed.getTime() > 6e4) {
    await db().update(apiToken).set({ lastUsed: new Date() }).where(eq(apiToken.id, t.id));
  }
  return { name: `token:${t.name}`, role: t.role };
}
