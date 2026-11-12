"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireAdminViewer } from "@/lib/data";
import { ApiError } from "@/server/errors";
import { updateTip } from "@/server/fronta";
import { withTx } from "@/server/tx";
import { createAccounts, resetPassword, setDisabled, type Credentials } from "@/server/uzivatele";

export interface Card extends Credentials {
  url: string;
  qr: string; // SVG
}
export interface CardsState {
  cards?: Card[];
  title?: string;
  error?: string;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function toCards(creds: Credentials[]): Promise<CardsState> {
  const base = await origin();
  const cards = await Promise.all(
    creds.map(async (c) => {
      const url = `${base}/prihlaseni/?u=${encodeURIComponent(c.username)}`;
      const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#3b2a20", light: "#0000" } });
      return { ...c, url, qr };
    }),
  );
  return { cards, title: "Rodokmen naší rodiny" };
}

// vytvoří účty a rovnou vrátí karty – hesla se ukážou jen teď
export async function createAccountsAction(_: CardsState, form: FormData): Promise<CardsState> {
  const actor = await requireAdminViewer();
  const ids = form.getAll("personId").map(String);
  if (!ids.length) return { error: "Vyberte aspoň jednu osobu." };
  try {
    const creds = await withTx((tx) => createAccounts(tx, actor, ids));
    revalidatePath("/admin/");
    return toCards(creds);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Vytvoření účtů se nepovedlo." };
  }
}

export async function resetPasswordAction(_: CardsState, form: FormData): Promise<CardsState> {
  const actor = await requireAdminViewer();
  const userId = Number(form.get("userId"));
  try {
    const c = await withTx((tx) => resetPassword(tx, actor, userId));
    return toCards([c]);
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Nové heslo se nepovedlo." };
  }
}

export async function toggleDisabledAction(form: FormData) {
  const actor = await requireAdminViewer();
  await withTx((tx) => setDisabled(tx, actor, Number(form.get("userId")), form.get("disabled") === "1"));
  revalidatePath("/admin/");
}

const STATUSES = ["nezpracovano", "overuje_se", "potvrzeno", "vyvraceno", "nelze_overit", "rozdeleno"] as const;

export async function tipStatusAction(form: FormData) {
  const actor = await requireAdminViewer();
  const status = String(form.get("status")) as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) return;
  const note = String(form.get("note") ?? "").trim();
  await withTx((tx) => updateTip(tx, actor, Number(form.get("tipId")), { status, ...(note ? { resolutionNote: note } : {}) }));
  revalidatePath("/admin/voditka/");
}
