import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const planPath = join(rootDir, "tests", "jmeter", "video-list-load-test.jmx");
const outputDir = join(rootDir, "reports", "jmeter");
const threadCounts = [50, 100, 200];
const rampUp = 10;
const duration = 60;

function resolveJMeterBinary() {
  const envBin = process.env.JMETER_BIN;
  if (envBin) {
    return envBin;
  }

  return "jmeter";
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ].filter(Boolean).join("\n\n"),
    );
  }

  return result;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))];
}

function parseJtl(jtlPath) {
  const raw = readFileSync(jtlPath, "utf8").trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error(`No samples found in ${jtlPath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  const samples = rows.length;
  const elapsedValues = rows.map((row) => Number(row.elapsed));
  const successCount = rows.filter((row) => row.success === "true" && row.responseCode === "200").length;
  const errorCount = samples - successCount;
  const timestamps = rows.map((row) => Number(row.timeStamp));
  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const wallSeconds = Math.max((maxTimestamp - minTimestamp) / 1000, 1);
  const throughput = samples / wallSeconds;
  const average = elapsedValues.reduce((sum, value) => sum + value, 0) / samples;
  const p99 = percentile(elapsedValues, 99);

  return {
    samples,
    throughput,
    average,
    p99,
    errorRate: (errorCount / samples) * 100,
  };
}

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function buildMarkdownTable(results) {
  const lines = [
    "| Threads | Samples | Throughput (QPS) | Average (ms) | P99 (ms) | Error Rate (%) |",
    "| :--- | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.threads} | ${result.samples} | ${formatNumber(result.throughput)} | ` +
      `${formatNumber(result.average)} | ${formatNumber(result.p99)} | ${formatNumber(result.errorRate)} |`,
    );
  }

  return lines.join("\n");
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function removePathIfExists(pathname) {
  if (existsSync(pathname)) {
    rmSync(pathname, { recursive: true, force: true });
  }
}

function main() {
  ensureOutputDir();

  const jmeterBin = resolveJMeterBinary();
  const results = [];

  for (const threads of threadCounts) {
    const jtlPath = join(outputDir, `video-list-${threads}.jtl`);
    const htmlDir = join(outputDir, `video-list-${threads}-html`);
    const logPath = join(outputDir, `video-list-${threads}.log`);

    removePathIfExists(jtlPath);
    removePathIfExists(htmlDir);

    const args = [
      "-n",
      "-t",
      planPath,
      "-l",
      jtlPath,
      "-j",
      logPath,
      "-e",
      "-o",
      htmlDir,
      `-Jthreads=${threads}`,
      `-Jrampup=${rampUp}`,
      `-Jduration=${duration}`,
      "-Jjmeter.save.saveservice.output_format=csv",
      "-Jjmeter.save.saveservice.print_field_names=true",
      "-Jjmeter.save.saveservice.timestamp_format=ms",
    ];

    console.log(`Running JMeter for ${threads} threads...`);
    runCommand(jmeterBin, args);

    const stats = parseJtl(jtlPath);
    results.push({
      threads,
      ...stats,
    });
  }

  const summary = {
    endpoint: "GET /api/videos?limit=12&type=LONG",
    rampUp,
    duration,
    generatedAt: new Date().toISOString(),
    results,
  };

  writeFileSync(join(outputDir, "video-list-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outputDir, "video-list-summary.md"), buildMarkdownTable(results));

  console.log("\nLoad test complete.\n");
  console.log(buildMarkdownTable(results));
}

main();
