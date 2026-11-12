"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data";
import { changePassword, deleteSession, login, SESSION_COOKIE, SESSION_DAYS } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { addTip } from "@/server/fronta";
import { withTx } from "@/server/tx";

export interface FormState {
  error?: string;
  ok?: string;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  try {
    const { token, expires } = await login(username, password, ip);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
      maxAge: SESSION_DAYS * 86400,
    });
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Přihlášení se nepovedlo." };
  }
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/prihlaseni/");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer?.userId) redirect("/prihlaseni/");
  const pw1 = String(form.get("new") ?? "");
  if (pw1 !== String(form.get("new2") ?? "")) return { error: "Nová hesla se neshodují." };
  try {
    await changePassword(viewer.userId, String(form.get("old") ?? ""), pw1);
    return { ok: "Heslo je změněné." };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Změna hesla se nepovedla." };
  }
}

// „Víte něco?“ u osoby: údaj od rodiny nebo zvěst → fronta nezpracovaných vodítek
export async function tipAction(_: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/prihlaseni/");
  const text = String(form.get("text") ?? "").trim();
  if (text.length < 3) return { error: "Napište prosím, co víte." };
  const kind = form.get("kind") === "zvest" ? "zvest" : "od_rodiny";
  const personId = String(form.get("personId") ?? "");
  try {
    await withTx((tx) =>
      addTip(tx, viewer, {
        kind,
        text,
        personIds: personId ? [personId] : [],
        channel: String(form.get("channel") ?? "") || null,
        sensitive: form.get("sensitive") === "on",
      }),
    );
    return { ok: "Děkujeme! Zapsali jsme to do fronty k ověření v matrikách." };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Uložení se nepovedlo." };
  }
}
