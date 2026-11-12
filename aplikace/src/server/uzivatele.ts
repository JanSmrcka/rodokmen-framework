// Účty pro žijící členy rodiny: admin vygeneruje jméno a heslo (dárková karta), heslo se ukáže jen jednou.
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { userAccount } from "@/db/schema";
import { requireAdmin, type Actor } from "./actor";
import { audit } from "./audit";
import { generatePassword, hashPassword } from "./auth";
import { badRequest, conflict, must } from "./errors";
import { loadGraf } from "./graf";
import { pribuznost } from "./pribuznost";
import { slugify } from "./text";
import type { Tx } from "./tx";

export interface Credentials {
  userId: number;
  personId: string;
  name: string;
  username: string;
  password: string;
  relation: string; // jak je příbuzný se správcem, který kartu tiskne
}

async function uniqueUsername(tx: Tx, given: string, surname: string) {
  const base = slugify(`${given} ${surname}`).replace(/-/g, ".") || "clen";
  let name = base;
  for (let i = 2; ; i++) {
    const [hit] = await tx.select({ id: userAccount.id }).from(userAccount).where(eq(userAccount.username, name));
    if (!hit) return name;
    name = `${base}${i}`;
  }
}

export async function createAccounts(tx: Tx, actor: Actor, personIds: string[], role: "admin" | "member" = "member"): Promise<Credentials[]> {
  requireAdmin(actor);
  const graf = await loadGraf();
  const out: Credentials[] = [];
  for (const pid of personIds) {
    const node = graf.nodes.get(pid);
    if (!node) throw badRequest(`Osoba ${pid} není ve stromu.`);
    if (!node.living) throw badRequest(`${node.name} není vedená jako žijící – účet jde jen žijícím (nastavte living: true).`);
    const [has] = await tx.select({ id: userAccount.id }).from(userAccount).where(eq(userAccount.personId, pid));
    if (has) throw conflict(`${node.name} už účet má – použijte „nové heslo“.`);
    const username = await uniqueUsername(tx, node.given, node.surname);
    const password = generatePassword();
    const [u] = await tx
      .insert(userAccount)
      .values({ personId: pid, username, passwordHash: await hashPassword(password), role, createdBy: actor.name })
      .returning();
    await audit(tx, actor, "user_account", u.id, "create", null, u);
    out.push({
      userId: u.id,
      personId: pid,
      name: node.name,
      username,
      password,
      relation: actor.personId ? pribuznost(graf, actor.personId, pid).label : "",
    });
  }
  return out;
}

export async function resetPassword(tx: Tx, actor: Actor, userId: number): Promise<Credentials> {
  requireAdmin(actor);
  const [u] = await tx.select().from(userAccount).where(eq(userAccount.id, userId));
  must(u, `účet ${userId}`);
  const password = generatePassword();
  await tx.update(userAccount).set({ passwordHash: await hashPassword(password), passwordChangedAt: null }).where(eq(userAccount.id, userId));
  await audit(tx, actor, "user_account", userId, "update", { passwordReset: false }, { passwordReset: true });
  const graf = await loadGraf();
  const node = graf.nodes.get(u.personId);
  return {
    userId,
    personId: u.personId,
    name: node?.name ?? u.personId,
    username: u.username,
    password,
    relation: actor.personId ? pribuznost(graf, actor.personId, u.personId).label : "",
  };
}

export async function setDisabled(tx: Tx, actor: Actor, userId: number, disabled: boolean) {
  requireAdmin(actor);
  const [before] = await tx.select().from(userAccount).where(eq(userAccount.id, userId));
  must(before, `účet ${userId}`);
  const [after] = await tx.update(userAccount).set({ disabled }).where(eq(userAccount.id, userId)).returning();
  await audit(tx, actor, "user_account", userId, "update", before, after);
  return after;
}

// žijící osoby ve stromu a jejich účty (pro administraci)
export async function listAccounts(actor: Actor) {
  requireAdmin(actor);
  const graf = await loadGraf();
  const users = await db().select().from(userAccount).orderBy(asc(userAccount.username));
  const byPerson = new Map(users.map((u) => [u.personId, u]));
  const living = [...graf.nodes.values()].filter((n) => n.living && !n.placeholder && !n.sameAsId);
  return living
    .map((n) => {
      const u = byPerson.get(n.id);
      return {
        personId: n.id,
        name: n.name,
        birthYear: n.birthYear,
        relation: actor.personId ? pribuznost(graf, actor.personId, n.id).label : "",
        account: u
          ? { id: u.id, username: u.username, role: u.role, disabled: u.disabled, lastSeen: u.lastSeen, passwordChanged: !!u.passwordChangedAt }
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "cs"));
}
