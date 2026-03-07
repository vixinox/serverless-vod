/**
 * 通过 Next.js 内部 API 执行转码任务的陈旧状态对账。
 *
 * 用法：
 *   node scripts/localstack/reconcile-stale.mjs
 *   node scripts/localstack/reconcile-stale.mjs --dry-run --stale-minutes=30 --limit=100
 */

const baseUrl = (process.env.RECONCILE_STALE_API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.INTERNAL_API_SECRET ?? "";

if (!secret) {
  console.error("Missing INTERNAL_API_SECRET");
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    staleMinutes: undefined,
    limit: undefined,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (arg.startsWith("--stale-minutes=")) {
      const value = Number.parseInt(arg.slice("--stale-minutes=".length), 10);
      if (Number.isFinite(value) && value >= 1) out.staleMinutes = value;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value >= 1) out.limit = value;
      continue;
    }
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = `${baseUrl}/api/internal/vod/reconcile-stale`;
  const payload = {
    dryRun: args.dryRun,
    ...(args.staleMinutes ? { staleMinutes: args.staleMinutes } : {}),
    ...(args.limit ? { limit: args.limit } : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    console.error(`[reconcile-stale] HTTP ${response.status}`, json);
    process.exit(1);
  }

  console.log("[reconcile-stale] success");
  console.log(JSON.stringify(json, null, 2));
}

main().catch((error) => {
  console.error("[reconcile-stale] failed", error);
  process.exit(1);
});
