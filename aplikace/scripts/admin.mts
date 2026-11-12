// První správce webu: npm run admin -- <id osoby ve stromu>
// Osoba musí v DB existovat a být žijící. Vypíše přihlašovací jméno a heslo (jen jednou).
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const [personId] = process.argv.slice(2);
if (!personId) {
  console.error("Použití: npm run admin -- <id osoby>");
  process.exit(1);
}
const { withTx } = await import("../src/server/tx");
const { createAccounts, resetPassword } = await import("../src/server/uzivatele");
const { SYSTEM } = await import("../src/server/actor");
const { db } = await import("../src/db");
const { userAccount } = await import("../src/db/schema");
const { eq } = await import("drizzle-orm");

const [existing] = await db().select().from(userAccount).where(eq(userAccount.personId, personId));
const creds = await withTx(async (tx) => {
  if (existing) {
    await tx.update(userAccount).set({ role: "admin" }).where(eq(userAccount.id, existing.id));
    return resetPassword(tx, SYSTEM, existing.id);
  }
  return (await createAccounts(tx, SYSTEM, [personId], "admin"))[0];
});
console.log(`Správce: ${creds.name}\njméno: ${creds.username}\nheslo: ${creds.password}`);
await db().$client.end();
