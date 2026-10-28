import { readFile } from "node:fs/promises";
import { pool } from "../lib/db.mjs";
try {
  await pool.query(
    await readFile(new URL("../sql/001_schema.sql", import.meta.url), "utf8"),
  );
  console.log("Schema created. Run npm run db:seed.");
} finally {
  await pool.end();
}
