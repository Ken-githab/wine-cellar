import { readFile } from "fs/promises";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile("neon/schema.sql", "utf8");

for (const statement of schema.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean)) {
  await sql.query(`${statement};`);
}

console.log("Neon schema applied");
