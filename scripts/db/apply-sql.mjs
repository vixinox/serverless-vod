/**
 * apply-sql.mjs
 *
 * 通用 SQL 文件执行工具，读取 DATABASE_URL 并依次应用指定的 SQL 文件。
 *
 * 用法：
 *   bun run scripts/db/apply-sql.mjs <file1.sql> [file2.sql ...]
 *
 * 示例：
 *   npm run db:apply-triggers
 *   npm run db:apply-rollup
 *   npm run db:apply-pg-extras
 */

import pg from "pg";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2);

if (!files.length) {
  console.error("Usage: apply-sql.mjs <file1.sql> [file2.sql ...]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

for (const rel of files) {
  const abs = resolve(__dirname, "../../", rel);
  console.log(`Applying ${rel} ...`);
  const sql = readFileSync(abs, "utf-8");
  await client.query(sql);
  console.log(`  ✓ done`);
}

await client.end();
console.log("\nAll SQL files applied successfully.");
