import { forbidden } from "./errors";

// Kdo volá: přihlášený člen rodiny (cookie) nebo API token (AI, skripty).
export type Role = "admin" | "agent" | "member";

export interface Actor {
  name: string; // pro audit: user:<jmeno> / token:<nazev>
  role: Role;
  userId?: number;
  personId?: string; // osoba ve stromu, od které se počítá kořen
}

export const SYSTEM: Actor = { name: "system", role: "admin" };

// member: čte (s ořezem žijících) a posílá vodítka; agent: zapisuje data; admin: vše
export function canEdit(a: Actor) {
  return a.role === "admin" || a.role === "agent";
}
export function isAdmin(a: Actor) {
  return a.role === "admin";
}
export function seesPrivate(a: Actor) {
  return a.role === "admin" || a.role === "agent";
}

export function requireEdit(a: Actor) {
  if (!canEdit(a)) throw forbidden();
}
export function requireAdmin(a: Actor) {
  if (!isAdmin(a)) throw forbidden("Jen pro správce.");
}
