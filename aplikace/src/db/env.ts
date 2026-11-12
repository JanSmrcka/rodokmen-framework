// Společný .env je v kořeni repa (čtou ho i Python nástroje). Na Vercelu se proměnné nastavují v projektu.
import fs from "node:fs";
import path from "node:path";

export function loadRootEnv() {
  if (process.env.DATABASE_URL) return;
  for (const dir of [process.cwd(), path.join(process.cwd(), "..")]) {
    const file = path.join(dir, ".env");
    if (fs.existsSync(file)) {
      process.loadEnvFile(file); // nepřepisuje už nastavené proměnné
      return;
    }
  }
}
