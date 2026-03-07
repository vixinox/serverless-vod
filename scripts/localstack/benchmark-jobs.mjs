/**
 * 已完成转码任务的本地基准统计脚本。
 *
 * 脚本会从数据库读取最新的 SUCCEEDED 任务，并输出 SHORT/LONG
 * 两类视频的基线耗时指标（也支持通过 shortCode 指定具体视频）。
 *
 * 用法：
 *   node scripts/localstack/benchmark-jobs.mjs
 *   node scripts/localstack/benchmark-jobs.mjs --short-code-short=abc123 --short-code-long=xyz789
 *   node scripts/localstack/benchmark-jobs.mjs --json
 */
import pg from "pg";
import "dotenv/config";

function parseArgs(argv) {
  const out = {
    shortCodeShort: undefined,
    shortCodeLong: undefined,
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      out.json = true;
      continue;
    }
    if (arg.startsWith("--short-code-short=")) {
      out.shortCodeShort = arg.slice("--short-code-short=".length);
      continue;
    }
    if (arg.startsWith("--short-code-long=")) {
      out.shortCodeLong = arg.slice("--short-code-long=".length);
      continue;
    }
  }

  return out;
}

function secondsBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Number((ms / 1000).toFixed(2));
}

function summarize(row) {
  return {
    type: row.type,
    shortCode: row.shortCode,
    jobId: row.id,
    queuedAt: row.queuedAt?.toISOString?.() ?? null,
    startedAt: row.startedAt?.toISOString?.() ?? null,
    finishedAt: row.finishedAt?.toISOString?.() ?? null,
    queueSeconds: secondsBetween(row.queuedAt, row.startedAt),
    processingSeconds: secondsBetween(row.startedAt, row.finishedAt),
    wallSeconds: secondsBetween(row.queuedAt, row.finishedAt),
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const hasCustomCodes = Boolean(args.shortCodeShort || args.shortCodeLong);
    const params = [];
    const whereSegments = [`j.status = 'SUCCEEDED'`];

    if (hasCustomCodes) {
      const shortCodes = [args.shortCodeShort, args.shortCodeLong].filter(Boolean);
      params.push(shortCodes);
      whereSegments.push(`v."shortCode" = ANY($${params.length})`);
    }

    const query = `
      SELECT
        j.id,
        j.status,
        j."queuedAt",
        j."startedAt",
        j."finishedAt",
        j."videoId",
        v."shortCode",
        v.type,
        v."processingStatus"
      FROM "TranscodeJob" j
      INNER JOIN "Video" v ON v.id = j."videoId"
      WHERE ${whereSegments.join(" AND ")}
      ORDER BY j."finishedAt" DESC NULLS LAST
      LIMIT 300
    `;

    const { rows } = await pool.query(query, params);
    const latestByType = new Map();

    for (const row of rows) {
      if (!latestByType.has(row.type)) {
        latestByType.set(row.type, row);
      }
    }

    const shortRow = args.shortCodeShort
      ? rows.find((row) => row.shortCode === args.shortCodeShort)
      : latestByType.get("SHORT");
    const longRow = args.shortCodeLong
      ? rows.find((row) => row.shortCode === args.shortCodeLong)
      : latestByType.get("LONG");

    const result = {
      generatedAt: new Date().toISOString(),
      source: hasCustomCodes
        ? "latest succeeded jobs for provided short codes"
        : "latest succeeded jobs by video type",
      short: shortRow ? summarize(shortRow) : null,
      long: longRow ? summarize(longRow) : null,
      notes: [
        "processingSeconds = startedAt -> finishedAt",
        "queueSeconds = queuedAt -> startedAt",
        "wallSeconds = queuedAt -> finishedAt",
      ],
    };

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log("LocalStack VOD benchmark baseline");
    console.log(`generatedAt: ${result.generatedAt}`);
    console.log(`source: ${result.source}`);
    console.log("");

    for (const [label, item] of [
      ["SHORT", result.short],
      ["LONG", result.long],
    ]) {
      if (!item) {
        console.log(`${label}: no succeeded job found`);
        continue;
      }
      console.log(
        `${label}: shortCode=${item.shortCode} jobId=${item.jobId} ` +
        `queue=${item.queueSeconds ?? "n/a"}s ` +
        `processing=${item.processingSeconds ?? "n/a"}s ` +
        `wall=${item.wallSeconds ?? "n/a"}s`,
      );
    }

    if (!result.short || !result.long) {
      process.exitCode = 2;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[benchmark-jobs] failed", error);
  process.exit(1);
});
