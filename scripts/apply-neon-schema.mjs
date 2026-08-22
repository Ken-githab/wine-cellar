import { readFile } from "fs/promises";
import { neon } from "@neondatabase/serverless";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const schemaPath = args.find((arg) => !arg.startsWith("--")) ?? "neon/schema.sql";
const schema = await readFile(schemaPath, "utf8");

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "-" && next === "-") {
      current += `${char}${next}`;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "/" && next === "*") {
      current += `${char}${next}`;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "$") {
      const match = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (!doubleQuoted && char === "'") {
      current += char;
      if (singleQuoted && next === "'") {
        current += next;
        index += 1;
      } else {
        singleQuoted = !singleQuoted;
      }
      continue;
    }

    if (!singleQuoted && char === '"') {
      current += char;
      if (doubleQuoted && next === '"') {
        current += next;
        index += 1;
      } else {
        doubleQuoted = !doubleQuoted;
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

const statements = splitSqlStatements(schema);
if (dryRun) {
  console.log(`Neon SQL parsed: ${schemaPath} (${statements.length} statements)`);
  process.exit(0);
}

for (const statement of statements) {
  await sql.query(`${statement};`);
}

console.log(`Neon SQL applied: ${schemaPath}`);
