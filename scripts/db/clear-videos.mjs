/**
 * clear-videos.mjs
 *
 * 级联删除 Video 表中的所有记录，供开发环境快速清库使用。
 *
 * 用法：
 *   bun run scripts/db/clear-videos.mjs
 *   bun run db:clear-videos
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  allowExitOnIdle: true,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

try {
  const deleted = await prisma.video.deleteMany();
  console.log(`[db:clear-videos] deleted ${deleted.count} video records with DB-level cascade.`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
