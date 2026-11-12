// Záloha DB (i produkční): npm run db:zaloha [-- <DATABASE_URL>]
// pg_dump běží v Dockeru (stejná verze Postgresu), výstup: ../zalohy/rodokmen-<datum>.dump (formát pro pg_restore).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL");
// z kontejneru je lokální DB na host.docker.internal
const inDocker = url.replace(/@(localhost|127\.0\.0\.1)([:/])/, "@host.docker.internal$2");
const dir = path.resolve(process.cwd(), "..", "zalohy");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `rodokmen-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.dump`);
const out = fs.createWriteStream(file);
const p = spawn("docker", ["run", "--rm", "postgres:17-alpine", "pg_dump", "--format=custom", "--no-owner", inDocker], { stdio: ["ignore", "pipe", "inherit"] });
p.stdout.pipe(out);
p.on("close", (code) => {
  if (code !== 0) {
    fs.rmSync(file, { force: true });
    console.error("Záloha se nepovedla.");
    process.exit(code ?? 1);
  }
  console.log(`Záloha: ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} kB)\nObnova: docker run --rm -i postgres:17-alpine pg_restore --clean --no-owner -d <URL> < ${path.basename(file)}`);
});
