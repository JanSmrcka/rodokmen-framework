// Kopie produkční DB do lokálního Dockeru (po přechodu na DB je zdrojem pravdy produkce):
//   npm run db:z-produkce            – PROD_DATABASE_URL → DATABASE_URL (jen localhost), lokální data se přepíšou
// pg_dump a pg_restore běží v Dockeru (stejná verze Postgresu jako lokálně).
import { spawn } from "node:child_process";
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const from = process.env.PROD_DATABASE_URL;
const to = process.env.DATABASE_URL ?? "";
if (!from) throw new Error("Chybí PROD_DATABASE_URL v .env.");
if (!/localhost|127\.0\.0\.1/.test(to)) throw new Error("Cíl (DATABASE_URL) musí být lokální DB.");
const local = to.replace(/@(localhost|127\.0\.0\.1)([:/])/, "@host.docker.internal$2");

const fromDocker = from.replace(/@(localhost|127\.0\.0\.1)([:/])/, "@host.docker.internal$2"); // jen pro test s lokální „produkcí“
const dump = spawn("docker", ["run", "--rm", "postgres:18-alpine", "pg_dump", "--format=custom", "--no-owner", "--no-acl", fromDocker], {
  stdio: ["ignore", "pipe", "inherit"],
});
const restore = spawn(
  "docker",
  ["run", "--rm", "-i", "postgres:18-alpine", "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl", "--single-transaction", "-d", local],
  { stdio: ["pipe", "inherit", "inherit"] },
);
dump.stdout.pipe(restore.stdin);
const done = (p: ReturnType<typeof spawn>) => new Promise<number>((r) => p.on("close", (c) => r(c ?? 1)));
const [a, b] = await Promise.all([done(dump), done(restore)]);
if (a || b) {
  console.error(`Kopie se nepovedla (pg_dump ${a}, pg_restore ${b}).`);
  process.exit(1);
}
console.log("Lokální DB je teď kopie produkce.");
