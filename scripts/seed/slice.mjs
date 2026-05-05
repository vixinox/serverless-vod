import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";
const threads = Math.max(1, Number.parseInt(process.env.FFMPEG_THREADS ?? "2", 10));
const stderrTailChars = resolveStderrTailChars();

const projectRoot = process.cwd();
const seedRoot = join(projectRoot, "seed");
const sourceRoot = join(seedRoot, "videos_1080p");
const hlsRoot = join(seedRoot, "hls-videos");
const imageRoot = join(seedRoot, "images", "thumbnails");
const manifestPath = join(seedRoot, "manifests", "stage1-slices.json");

const shortCodePattern = /^[A-Za-z0-9]{11}$/;

function resolveStderrTailChars() {
  const raw = process.env.FFMPEG_STDERR_TAIL_CHARS ?? "12000";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1000) return 12000;
  return Math.min(parsed, 100000);
}

function appendTail(current, chunk, maxChars = stderrTailChars) {
  const next = current + chunk.toString();
  if (next.length <= maxChars) return next;
  return next.slice(-maxChars);
}

function parseArgs(argv) {
  const args = {
    force: false,
    dryRun: false,
    from: 0,
    limit: null,
    codes: null,
  };

  for (const token of argv) {
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith("--from=")) {
      const parsed = Number.parseInt(token.slice("--from=".length), 10);
      args.from = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      continue;
    }
    if (token.startsWith("--limit=")) {
      const parsed = Number.parseInt(token.slice("--limit=".length), 10);
      args.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      continue;
    }
    if (token.startsWith("--codes=")) {
      const raw = token.slice("--codes=".length);
      const values = raw
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      args.codes = values.length > 0 ? new Set(values) : null;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function listSourceShortCodes() {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function findSourceFiles(shortCode) {
  const dir = join(sourceRoot, shortCode);
  const entries = await readdir(dir, { withFileTypes: true });

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const mp4Candidates = files.filter((name) => name.toLowerCase().endsWith(".mp4"));
  const jpgCandidates = files.filter((name) => {
    const lower = name.toLowerCase();
    return lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  });

  const mp4 = selectPreferredFile(mp4Candidates, shortCode);
  const jpg = selectPreferredFile(jpgCandidates, shortCode);

  return {
    mp4Path: mp4 ? join(dir, mp4) : null,
    jpgPath: jpg ? join(dir, jpg) : null,
  };
}

function selectPreferredFile(candidates, shortCode) {
  if (candidates.length === 0) return null;
  const exact = candidates.find((name) => name.toLowerCase() === `${shortCode.toLowerCase()}.mp4`);
  if (exact) return exact;
  const exactJpg = candidates.find((name) => {
    const lower = name.toLowerCase();
    return lower === `${shortCode.toLowerCase()}.jpg` || lower === `${shortCode.toLowerCase()}.jpeg`;
  });
  if (exactJpg) return exactJpg;
  return candidates[0];
}

async function checkHlsReady(shortCode) {
  const dir = join(hlsRoot, shortCode);
  const master = join(dir, "master.m3u8");

  try {
    await stat(master);
  } catch {
    return false;
  }

  const files = await readdir(dir, { withFileTypes: true });
  return files.some((file) => file.isFile() && file.name.toLowerCase().endsWith(".ts"));
}

function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderrBuf = "";
    child.stderr.on("data", (chunk) => {
      stderrBuf = appendTail(stderrBuf, chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stderrBuf);
      else reject(new Error(`ffmpeg exited ${code}:\n${stderrBuf.slice(-2000)}`));
    });
  });
}

async function transcodeCopy(inputPath, outputDir) {
  await runFfmpeg(
    [
      "-y", "-v", "warning", "-i", inputPath,
      "-c:v", "copy",
      "-c:a", "copy",
      "-f", "hls",
      "-hls_time", "4",
      "-hls_playlist_type", "vod",
      "-hls_flags", "independent_segments",
      "-hls_segment_filename", join(outputDir, "seg_%03d.ts"),
      join(outputDir, "master.m3u8"),
    ],
    outputDir,
  );
}

async function transcodeReencode(inputPath, outputDir) {
  await runFfmpeg(
    [
      "-y", "-v", "warning", "-i", inputPath,
      "-threads", String(threads),
      "-c:v", "libx264", "-preset", "veryfast",
      "-g", "48", "-sc_threshold", "0",
      "-c:a", "aac", "-ar", "48000", "-b:a", "128k",
      "-hls_time", "4",
      "-hls_playlist_type", "vod",
      "-hls_segment_filename", join(outputDir, "seg_%03d.ts"),
      join(outputDir, "master.m3u8"),
    ],
    outputDir,
  );
}

async function transcodeFast(inputPath, outputDir) {
  try {
    await transcodeCopy(inputPath, outputDir);
    return "copy";
  } catch (copyErr) {
    console.warn(`[stage1] copy failed, fallback to re-encode: ${copyErr.message}`);
    await transcodeReencode(inputPath, outputDir);
    return "reencode";
  }
}

async function ensureThumbnail(shortCode, sourceJpgPath, force) {
  const targetPath = join(imageRoot, shortCode, "thumbnail.jpg");
  if (!force) {
    try {
      await stat(targetPath);
      return { targetPath, reused: true };
    } catch {
      // continue
    }
  }

  await mkdir(join(imageRoot, shortCode), { recursive: true });
  await cp(sourceJpgPath, targetPath, { force: true });
  return { targetPath, reused: false };
}

async function readExistingManifest() {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Map();
    if (!Array.isArray(parsed.items)) return new Map();

    const map = new Map();
    for (const item of parsed.items) {
      if (item && typeof item === "object" && typeof item.shortCode === "string") {
        map.set(item.shortCode, item);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const existingByShortCode = await readExistingManifest();

  await mkdir(hlsRoot, { recursive: true });
  await mkdir(imageRoot, { recursive: true });
  await mkdir(join(seedRoot, "manifests"), { recursive: true });

  const allCodes = await listSourceShortCodes();

  const filteredCodes = allCodes
    .filter((shortCode) => (args.codes ? args.codes.has(shortCode) : true))
    .slice(args.from, args.limit ? args.from + args.limit : undefined);

  const summary = {
    total: filteredCodes.length,
    sliced: 0,
    reusedSlice: 0,
    reusedThumbnail: 0,
    skippedInvalid: 0,
    failed: 0,
    readyForStage2: 0,
    missingUploaderHint: 0,
  };

  const items = [];

  for (const shortCode of filteredCodes) {
    const now = new Date();
    const baseItem = existingByShortCode.get(shortCode);
    const uploaderHint = baseItem?.hints?.uploaderHint ?? null;
    const titleHint = baseItem?.hints?.titleHint ?? null;
    const videoTypeHint = baseItem?.hints?.videoTypeHint ?? null;

    if (!shortCodePattern.test(shortCode)) {
      summary.skippedInvalid += 1;
      items.push({
        shortCode,
        sourceFingerprint: null,
        source: null,
        outputs: null,
        hints: { uploaderHint, titleHint, videoTypeHint },
        stage1: {
          status: "invalid_short_code",
          reused: false,
          ffmpegPath: null,
          error: "shortCode format invalid",
          startedAt: now.toISOString(),
          finishedAt: new Date().toISOString(),
        },
      });
      continue;
    }

    let sourceInfo;
    try {
      sourceInfo = await findSourceFiles(shortCode);
    } catch (error) {
      summary.failed += 1;
      items.push({
        shortCode,
        sourceFingerprint: null,
        source: null,
        outputs: null,
        hints: { uploaderHint, titleHint, videoTypeHint },
        stage1: {
          status: "failed",
          reused: false,
          ffmpegPath: null,
          error: error instanceof Error ? error.message : String(error),
          startedAt: now.toISOString(),
          finishedAt: new Date().toISOString(),
        },
      });
      continue;
    }

    if (!sourceInfo.mp4Path || !sourceInfo.jpgPath) {
      summary.skippedInvalid += 1;
      items.push({
        shortCode,
        sourceFingerprint: null,
        source: {
          mp4RelativePath: sourceInfo.mp4Path ? relative(seedRoot, sourceInfo.mp4Path).replace(/\\/g, "/") : null,
          thumbnailSourceRelativePath: sourceInfo.jpgPath ? relative(seedRoot, sourceInfo.jpgPath).replace(/\\/g, "/") : null,
          sizeBytes: null,
          mtimeMs: null,
        },
        outputs: null,
        hints: { uploaderHint, titleHint, videoTypeHint },
        stage1: {
          status: "missing_source_files",
          reused: false,
          ffmpegPath: null,
          error: "mp4 or jpg missing",
          startedAt: now.toISOString(),
          finishedAt: new Date().toISOString(),
        },
      });
      continue;
    }

    const sourceStats = await stat(sourceInfo.mp4Path);
    const sourceFingerprint = `${sourceStats.size}:${Math.floor(sourceStats.mtimeMs)}`;

    const hlsDir = join(hlsRoot, shortCode);
    const hlsMaster = join(hlsDir, "master.m3u8");

    const startedAt = new Date();
    let ffmpegPath = null;
    let sliceReused = false;
    let thumbReused = false;
    let status = "ready";
    let error = null;

    try {
      const ready = await checkHlsReady(shortCode);
      if (ready && !args.force) {
        sliceReused = true;
        summary.reusedSlice += 1;
      } else if (args.dryRun) {
        status = "dry_run";
      } else {
        if (args.force) {
          await rm(hlsDir, { recursive: true, force: true });
        }
        await mkdir(hlsDir, { recursive: true });
        ffmpegPath = await transcodeFast(sourceInfo.mp4Path, hlsDir);
        summary.sliced += 1;
      }

      if (status !== "dry_run") {
        const thumbResult = await ensureThumbnail(shortCode, sourceInfo.jpgPath, args.force);
        thumbReused = thumbResult.reused;
        if (thumbReused) {
          summary.reusedThumbnail += 1;
        }
      }
    } catch (err) {
      summary.failed += 1;
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }

    const finishedAt = new Date();
    const item = {
      shortCode,
      sourceFingerprint,
      source: {
        mp4RelativePath: relative(seedRoot, sourceInfo.mp4Path).replace(/\\/g, "/"),
        thumbnailSourceRelativePath: relative(seedRoot, sourceInfo.jpgPath).replace(/\\/g, "/"),
        sizeBytes: sourceStats.size,
        mtimeMs: Math.floor(sourceStats.mtimeMs),
      },
      outputs: {
        hlsDirRelativePath: relative(seedRoot, hlsDir).replace(/\\/g, "/"),
        hlsMasterRelativePath: relative(seedRoot, hlsMaster).replace(/\\/g, "/"),
        thumbnailRelativePath: `images/thumbnails/${shortCode}/thumbnail.jpg`,
        s3Preview: {
          hlsMasterKey: `${shortCode}/master.m3u8`,
          thumbnailKey: `thumbnails/${shortCode}/thumbnail.jpg`,
        },
      },
      hints: {
        uploaderHint,
        titleHint,
        videoTypeHint,
      },
      stage1: {
        status,
        reused: sliceReused,
        thumbnailReused: thumbReused,
        ffmpegPath,
        error,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        elapsedMs: finishedAt.getTime() - startedAt.getTime(),
      },
    };

    if (status !== "failed" && status !== "missing_source_files" && status !== "invalid_short_code") {
      summary.readyForStage2 += 1;
    }
    if (!uploaderHint) {
      summary.missingUploaderHint += 1;
    }

    items.push(item);
    console.log(`[stage1] ${shortCode} status=${status} reused=${sliceReused} ffmpeg=${ffmpegPath ?? "n/a"}`);
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceRoot: "seed/videos_1080p",
    dryRun: args.dryRun,
    options: {
      force: args.force,
      from: args.from,
      limit: args.limit,
      codes: args.codes ? Array.from(args.codes).sort() : null,
    },
    summary,
    items,
  };

  await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`[stage1] done total=${summary.total} sliced=${summary.sliced} reusedSlice=${summary.reusedSlice} failed=${summary.failed}`);
  console.log(`[stage1] manifest=${relative(projectRoot, manifestPath).replace(/\\/g, "/")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
