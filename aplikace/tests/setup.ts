// Aplikace v testech mluví s testovací DB.
import { loadRootEnv } from "../src/db/env";

loadRootEnv();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
