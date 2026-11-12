// API token pro AI / skripty: npm run token -- <nazev> [agent|admin]
// Token se ukáže jen jednou; ulož ho do .env jako RODOKMEN_API_TOKEN. Stejný název = nový token (starý přestane platit).
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const [name, role = "agent"] = process.argv.slice(2);
if (!name || !["agent", "admin"].includes(role)) {
  console.error("Použití: npm run token -- <nazev> [agent|admin]");
  process.exit(1);
}
const { createApiToken } = await import("../src/server/auth");
const { db } = await import("../src/db");
const token = await createApiToken(name, role as "agent" | "admin");
console.log(`Token „${name}“ (${role}):\n${token}\n\nDo .env: RODOKMEN_API_TOKEN=${token}`);
await db().$client.end();
