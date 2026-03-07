/**
 * Lambda：`vod-transcode`
 *
 * 状态机第二步：
 * 1. 从 vod-raw 下载源视频 ({shortCode}/source.mp4)
 * 2. ffprobe 提取源视频元数据（时长、宽、高）
 * 3. 调用 ffmpeg 转为 HLS（长短视频统一单码率）
 *    - 速度优先：先尝试 stream copy（免转码），失败再回退到单路重编码
 *    - 通过 -threads 限制 CPU 占用（默认 2，由 FFMPEG_THREADS 控制）
 * 4. 将 HLS 切片和 manifest 上传至 vod-hls
 * 5. 用 ffmpeg 从源视频截取封面缩略图，上传至 vod-image
 * 6. 返回元数据（durationSeconds / width / height / thumbnailKey）供 Finalize 步骤存库
 *
 * 进度通知方式：阶段性里程碑事件（回调 /api/internal/vod/stage + EventBridge），
 * 不再使用 ffmpeg -progress pipe:1 逐帧百分比上报。
 *
 * 阶段 → 里程碑说明：
 *   downloading          下载源视频
 *   probing              ffprobe 探测元数据
 *   transcoding          ffmpeg 开始转码
 *   uploading_segments   上传 HLS 切片到 S3
 *   thumbnail_extracting ffmpeg 截取封面
 *   thumbnail_uploading  上传封面到 S3
 *
 * 输入与 extract-metadata 输出一致：
 *   { jobId, videoId, shortCode, inputBucket, inputKey,
 *     outputBucket, outputPrefix, videoType }
 *
 * 环境变量：
 *   FFMPEG_BIN       — ffmpeg 可执行路径（默认 "ffmpeg"）
 *   FFPROBE_BIN      — ffprobe 可执行路径（默认 "ffprobe"）
 *   FFMPEG_THREADS   — 编码线程数，用于限制 CPU 占用（默认 2）
 *   VOD_IMAGE_BUCKET — 缩略图存储桶（默认 "vod-image"）
 */
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

// _shared/ 与 index.mjs 同级打包在 /var/task/ 下，使用相对路径 ./ 而非 ../
import { downloadObject, clearPrefix, uploadDirectory, uploadFile } from "./_shared/s3.mjs";
import { emitEvent } from "./_shared/events.mjs";
import { callInternalApi } from "./_shared/api.mjs";

const ffmpegBin   = process.env.FFMPEG_BIN       ?? "ffmpeg";
const ffprobeBin  = process.env.FFPROBE_BIN      ?? "ffprobe";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
/** CPU 线程数限制：限制编码并发，防止宿主机 CPU 被打满 */
const threads     = Math.max(1, parseInt(process.env.FFMPEG_THREADS ?? "2", 10));
const stderrTailChars = resolveStderrTailChars();

// ── 阶段事件：EventBridge + API 回调（双路并行，互不阻塞主流程）─────────────

/**
 * 向 EventBridge 和 Next.js 内部 API 同时发布当前流水线阶段事件。
 * 任一失败仅记录警告，不中止主流程。
 *
 * @param {string} jobId
 * @param {string} videoId
 * @param {string} shortCode
 * @param {string} stage  阶段标识（与 /api/internal/vod/stage 的 VALID_STAGES 一致）
 */
async function emitStage(jobId, videoId, shortCode, stage) {
  console.log(`[transcode] job=${jobId} ▶ stage=${stage}`);
  await Promise.allSettled([
    emitEvent("pipeline.stage", { jobId, videoId, shortCode, stage }),
    callInternalApi("/api/internal/vod/stage", { jobId, stage })
      .catch((e) => console.warn(`[transcode] stage API 失败 (${stage}): ${e.message}`)),
  ]);
}

// ── ffprobe：提取视频流元数据 ──────────────────────────────────────────────

/**
 * 用 ffprobe 探测视频元数据（时长、宽、高）。
 * 失败时返回 null，不阻塞主流程。
 *
 * @param {string} inputPath
 * @returns {Promise<{ durationSeconds: number|null, width: number|null, height: number|null }|null>}
 */
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

function probeVideo(inputPath) {
  return new Promise((resolve) => {
    const child = spawn(
      ffprobeBin,
      [
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",           // 额外获取 format.duration，作为 stream.duration 缺失时的回退
        "-select_streams", "v:0",
        inputPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      stderr = appendTail(stderr, d);
    });
    child.on("error", (err) => {
      console.warn(`[transcode] ffprobe 启动失败: ${err.message}`);
      resolve(null);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        console.warn(`[transcode] ffprobe 退出码 ${code}: ${stderr.slice(-400)}`);
        return resolve(null);
      }
      try {
        const info = JSON.parse(stdout);
        const vs = info.streams?.[0];

        // ── 诊断日志：打印 ffprobe 返回的关键字段 ──
        console.log(
          `[transcode] ffprobe raw: ` +
          `stream.duration=${JSON.stringify(vs?.duration)} ` +
          `format.duration=${JSON.stringify(info.format?.duration)} ` +
          `coded_width=${vs?.coded_width} width=${vs?.width} ` +
          `coded_height=${vs?.coded_height} height=${vs?.height}`
        );

        if (!vs) return resolve(null);

        // 优先取视频流自身的 duration；部分 MP4 容器流级别无此字段，
        // 回退到 format.duration（几乎所有封装格式都有此值）
        const rawDuration =
          parseFloat(vs.duration ?? "0") ||
          parseFloat(info.format?.duration ?? "0");

        const result = {
          durationSeconds: (isFinite(rawDuration) && rawDuration > 0)
            ? Math.round(rawDuration)
            : null,
          width:  vs.coded_width  ?? vs.width  ?? null,
          height: vs.coded_height ?? vs.height ?? null,
        };
        console.log(`[transcode] ffprobe parsed: rawDuration=${rawDuration} → durationSeconds=${result.durationSeconds}`);
        resolve(result);
      } catch (e) {
        console.warn(`[transcode] ffprobe JSON parse error: ${e.message}`);
        resolve(null);
      }
    });
  });
}

// ── ffmpeg 执行器（无进度流，仅 stderr 错误捕获）────────────────────────────

/**
 * 执行 ffmpeg 命令，等待完成后返回 stderr 字符串。
 * 不再使用 -progress pipe:1，减少不必要的进度解析开销。
 *
 * @param {string[]} args
 * @param {string}   cwd
 * @returns {Promise<string>} stderr 输出（用于日志/调试）
 */
function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderrBuf = "";
    child.stderr.on("data", (d) => {
      stderrBuf = appendTail(stderrBuf, d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stderrBuf);
      else reject(new Error(`ffmpeg exited ${code}:\n${stderrBuf.slice(-2000)}`));
    });
  });
}

// ── 封面缩略图提取 ────────────────────────────────────────────────────────

/**
 * 从视频中截取一帧作为封面缩略图（JPEG）。
 * 抓帧位置：视频时长的 5%（最少 1 秒，最多 30 秒），兼顾片头黑场问题。
 * 输出宽度缩放到最大 1280px，高度等比缩放。
 *
 * @param {string}      inputPath   源视频路径
 * @param {string}      outputPath  输出 JPEG 路径
 * @param {number|null} durationSec 视频时长（秒），用于计算抓帧时间点
 * @returns {Promise<void>}
 */
function extractThumbnail(inputPath, outputPath, durationSec) {
  return new Promise((resolve, reject) => {
    const seekSec = Math.max(1, Math.min(30, Math.round((durationSec ?? 20) * 0.05)));
    console.log(`[transcode] thumbnail seek=${seekSec}s`);
    const child = spawn(
      ffmpegBin,
      [
        "-y",
        "-v", "warning",
        "-ss", String(seekSec),
        "-i", inputPath,
        "-vframes", "1",
        "-vf", "scale='min(1280,iw)':-2",   // 最大宽 1280px，等比缩放
        "-q:v", "2",                          // JPEG 质量（1=最优，31=最差）
        outputPath,
      ],
      {
        shell: process.platform === "win32",
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr = appendTail(stderr, d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thumbnail failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

// ── HLS 转码（统一单码率，速度优先）──────────────────────────────────────

async function transcodeSingleRenditionReencode(inputPath, outputDir) {
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

async function transcodeSingleRenditionCopy(inputPath, outputDir) {
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

async function transcodeSingleRenditionFast(inputPath, outputDir) {
  try {
    await transcodeSingleRenditionCopy(inputPath, outputDir);
    console.log("[transcode] ffmpeg path=copy (fast-path)");
  } catch (copyErr) {
    console.warn(`[transcode] copy path failed, fallback to re-encode: ${copyErr.message}`);
    await transcodeSingleRenditionReencode(inputPath, outputDir);
    console.log("[transcode] ffmpeg path=reencode (fallback)");
  }
}

// ── Lambda handler ─────────────────────────────────────────────────────────

export const handler = async (event) => {
  const {
    jobId, videoId, shortCode,
    inputBucket, inputKey,
    outputBucket, outputPrefix,
    videoType,
  } = event;

  const workDir    = await mkdtemp(join(tmpdir(), `vod-${shortCode}-`));
  const sourcePath = join(workDir, "source.mp4");
  const outputDir  = join(workDir, "out");

  try {
    await mkdir(outputDir, { recursive: true });

    // ── 1. 下载源文件 ───────────────────────────────────────────────────
    await emitStage(jobId, videoId, shortCode, "downloading");
    console.log(`[transcode] job=${jobId} downloading s3://${inputBucket}/${inputKey}`);
    await downloadObject(inputBucket, inputKey, sourcePath);
    console.log(`[transcode] job=${jobId} download complete`);

    // ── 2. 提取视频元数据（ffprobe）────────────────────────────────────
    await emitStage(jobId, videoId, shortCode, "probing");
    const meta = await probeVideo(sourcePath);
    console.log(
      `[transcode] job=${jobId} meta: duration=${meta?.durationSeconds ?? "unknown"}s ` +
      `resolution=${meta?.width ?? "?"}x${meta?.height ?? "?"}`,
    );

    // ── 3. 转码 ────────────────────────────────────────────────────────
    await emitStage(jobId, videoId, shortCode, "transcoding");
    console.log(
      `[transcode] job=${jobId} ffmpeg start type=${videoType} mode=single-rendition threads=${threads}`,
    );
    await transcodeSingleRenditionFast(sourcePath, outputDir);
    console.log(`[transcode] job=${jobId} ffmpeg done`);

    // ── 4. 上传 HLS 切片 ───────────────────────────────────────────────
    await emitStage(jobId, videoId, shortCode, "uploading_segments");
    console.log(
      `[transcode] job=${jobId} uploading HLS to s3://${outputBucket}/${outputPrefix}`,
    );
    await clearPrefix(outputBucket, outputPrefix);
    await uploadDirectory(outputBucket, outputPrefix, outputDir);
    console.log(`[transcode] job=${jobId} HLS upload done`);

    // ── 5. 截取封面缩略图 ───────────────────────────────────────────────
    await emitStage(jobId, videoId, shortCode, "thumbnail_extracting");
    const thumbnailLocalPath = join(workDir, "thumbnail.jpg");
    let thumbnailKey = null;

    try {
      await extractThumbnail(sourcePath, thumbnailLocalPath, meta?.durationSeconds ?? null);
      console.log(`[transcode] job=${jobId} thumbnail extracted`);

      // ── 6. 上传缩略图 ─────────────────────────────────────────────────
      await emitStage(jobId, videoId, shortCode, "thumbnail_uploading");
      thumbnailKey = `thumbnails/${shortCode}/thumbnail.jpg`;
      await uploadFile(imageBucket, thumbnailKey, thumbnailLocalPath, "image/jpeg");
      console.log(
        `[transcode] job=${jobId} thumbnail uploaded → s3://${imageBucket}/${thumbnailKey}`,
      );
    } catch (thumbErr) {
      // 缩略图失败不阻断主流程，仅记录警告
      console.warn(`[transcode] job=${jobId} ⚠ thumbnail failed (non-fatal): ${thumbErr.message}`);
    }

    console.log(`[transcode] job=${jobId} ✓ all done`);

    // 将元数据透传给 Finalize 步骤写库
    return {
      jobId, videoId, shortCode,
      outputBucket, outputPrefix,
      durationSeconds:  meta?.durationSeconds ?? null,
      width:            meta?.width           ?? null,
      height:           meta?.height          ?? null,
      thumbnailBucket:  thumbnailKey ? imageBucket : null,
      thumbnailKey,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
