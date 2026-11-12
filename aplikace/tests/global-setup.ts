// Testovací DB (TEST_DATABASE_URL, z docker-compose) se před během smaže a znovu zmigruje.
import { makeDb, migrateDb } from "../src/db/client";
import { loadRootEnv } from "../src/db/env";

export default async function setup() {
  loadRootEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Chybí TEST_DATABASE_URL v .env (spusťte npm run db:up).");
  const d = makeDb(url);
  await migrateDb(d, { reset: true });
  await d.$client.end();
}
