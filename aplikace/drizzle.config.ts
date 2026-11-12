import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/db/env";

loadRootEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
});
