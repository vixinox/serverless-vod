/**
 * Lambda：`vod-transcode`
 *
 * 1. 从 vod-raw 下载源视频。
 * 2. 用 ffprobe 读取时长、宽高和内嵌封面等元数据。
 * 3. 用 ffmpeg 生成 HLS 清单和切片；能直接封装就先走 copy，失败再重编码。
 * 4. 把 HLS 资源上传到 vod-hls，并清理同一前缀下的旧结果。
 * 5. 优先复用视频内嵌封面；没有封面时再从视频帧里截取缩略图。
 * 6. 把播放资源位置和元数据返回给 Finalize，由 Finalize 统一写数据库。
 *
 * 阶段通知采用双路并行：一边发 EventBridge 事件，用于后续扩展异步订阅；
 * 一边回调 /api/internal/vod/stage，立即更新数据库给前端轮询展示。
 * 两条路都不阻塞主流程，避免“进度通知失败”反过来导致视频处理失败。
 *
 *   downloading          下载源视频
 *   probing              读取元数据
 *   transcoding          生成 HLS 资源
 *   uploading_segments   上传 HLS 切片和清单
 *   thumbnail_extracting 提取封面
 *   thumbnail_uploading  上传封面
 *
 * 输入与 extract-metadata 输出一致：
 *   { jobId, videoId, shortCode, inputBucket, inputKey,
 *     outputBucket, outputPrefix, videoType }
 *
 *   FFMPEG_BIN       ffmpeg 可执行路径，默认 "ffmpeg"
 *   FFPROBE_BIN      ffprobe 可执行路径，默认 "ffprobe"
 *   FFMPEG_THREADS   编码线程数，默认 2，用来限制本地开发环境的 CPU 占用
 *   VOD_IMAGE_BUCKET 缩略图存储桶，默认 "vod-image"
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

// ── 阶段事件：事件总线 + 数据库回调双路并行 ───────────────────────────────

/**
 * 发布当前处理阶段。
 * EventBridge 更适合扩展通知、日志订阅等旁路能力；
 * 内部 API 直接写库，保证创作者端能及时看到“正在下载/正在转码”等状态。
 * 两边任一失败都只记警告，因为阶段提示不是视频处理成功的必要条件。
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

// ── ffprobe：读取视频元数据 ───────────────────────────────────────────────

/**
 * 读取时长、分辨率和可能存在的内嵌封面。
 * 元数据缺失不会阻塞转码，最多影响展示时长、分辨率或封面。
 *
 * @param {string} inputPath
 * @returns {Promise<{
 *   durationSeconds: number|null,
 *   width: number|null,
 *   height: number|null,
 *   coverArt: {
 *     streamIndex: number,
 *     codecName: string,
 *     extension: string,
 *     contentType: string,
 *   }|null,
 * }|null>}
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
        "-show_format",
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
        const streams = Array.isArray(info.streams) ? info.streams : [];
        const mainVideoStream = streams.find(
          (stream) =>
            stream?.codec_type === "video" &&
            Number(stream?.disposition?.attached_pic ?? 0) !== 1,
        );
        const coverStream = streams.find(
          (stream) =>
            stream?.codec_type === "video" &&
            Number(stream?.disposition?.attached_pic ?? 0) === 1,
        );

        const coverCodec = String(coverStream?.codec_name ?? "").toLowerCase();
        const coverFormat =
          coverCodec === "png"
            ? { extension: "png", contentType: "image/png" }
            : coverCodec === "webp"
              ? { extension: "webp", contentType: "image/webp" }
              : { extension: "jpg", contentType: "image/jpeg" };
        const coverArt = Number.isInteger(coverStream?.index)
          ? {
              streamIndex: coverStream.index,
              codecName: coverCodec || "mjpeg",
              extension: coverFormat.extension,
              contentType: coverFormat.contentType,
            }
          : null;

        // 保留关键字段日志，用于本地排查元数据来源。
        console.log(
          `[transcode] ffprobe raw: ` +
          `stream.duration=${JSON.stringify(mainVideoStream?.duration)} ` +
          `format.duration=${JSON.stringify(info.format?.duration)} ` +
          `coded_width=${mainVideoStream?.coded_width} width=${mainVideoStream?.width} ` +
          `coded_height=${mainVideoStream?.coded_height} height=${mainVideoStream?.height} ` +
          `cover.streamIndex=${coverArt?.streamIndex ?? "none"} cover.codec=${coverArt?.codecName ?? "none"}`
        );

        if (!mainVideoStream) return resolve(null);

        // 优先取视频流自身的 duration；部分 MP4 容器流级别无此字段，
        // 回退到 format.duration（几乎所有封装格式都有此值）
        const rawDuration =
          parseFloat(mainVideoStream.duration ?? "0") ||
          parseFloat(info.format?.duration ?? "0");

        const result = {
          durationSeconds: (isFinite(rawDuration) && rawDuration > 0)
            ? Math.round(rawDuration)
            : null,
          width:  mainVideoStream.coded_width  ?? mainVideoStream.width  ?? null,
          height: mainVideoStream.coded_height ?? mainVideoStream.height ?? null,
          coverArt,
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

// ── ffmpeg 执行器：只关心成功失败和尾部错误信息 ───────────────────────────

/**
 * 执行 ffmpeg 命令，等待完成后返回 stderr 尾部内容。
 * 本系统只展示阶段里程碑，不解析逐帧百分比。
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
 * 从视频中提取封面缩略图（JPEG）。
 * 策略：优先在 5s-15s 的局部窗口内用 thumbnail 选代表帧，
 * 避免全片逐帧分析带来的 CPU/IO 开销。
 * 若窗口采样失败，回退到单点抓帧。
 *
 * @param {string}      inputPath   源视频路径
 * @param {string}      outputPath  输出 JPEG 路径
 * @param {number|null} durationSec 视频时长（秒），用于计算抓帧时间点
 * @returns {Promise<void>}
 */
function extractThumbnail(inputPath, outputPath, durationSec) {
  return new Promise((resolve, reject) => {
    const total = Number.isFinite(durationSec) ? Math.max(1, Number(durationSec)) : null;
    const preferredStart = 5;
    const preferredEnd = 15;
    const windowStart = total
      ? (total <= preferredStart ? 0 : Math.min(preferredStart, Math.max(0, total - 1)))
      : preferredStart;
    const windowEnd = total
      ? (total <= preferredStart ? total : Math.min(preferredEnd, total))
      : preferredEnd;
    const windowLength = Math.max(1, windowEnd - windowStart);
    const thumbnailN = 240;
    const fallbackSeek = total
      ? Math.max(
          windowStart,
          Math.min(windowEnd, windowStart + windowLength / 2),
        )
      : (preferredStart + preferredEnd) / 2;
    console.log(
      `[transcode] thumbnail window start=${windowStart}s length=${windowLength}s n=${thumbnailN} fallbackSeek=${fallbackSeek}s`,
    );

    const child = spawn(
      ffmpegBin,
      [
        "-y",
        "-v", "warning",
        "-ss", String(windowStart),
        "-t", String(windowLength),
        "-i", inputPath,
        "-vf", `thumbnail=${thumbnailN}`,
        "-frames:v", "1",
        "-q:v", "1",
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
    child.on("close", async (code) => {
      if (code === 0) return resolve();

      console.warn(
        `[transcode] thumbnail window strategy failed (${code}), fallback to single seek=${fallbackSeek}s`,
      );
      try {
        await runFfmpeg(
          [
            "-y",
            "-v", "warning",
            "-ss", String(fallbackSeek),
            "-i", inputPath,
            "-vframes", "1",
            "-q:v", "1",
            outputPath,
          ],
          process.cwd(),
        );
        resolve();
      } catch (fallbackErr) {
        reject(new Error(`ffmpeg thumbnail failed (${code}): ${stderr.slice(-500)}; fallback failed: ${fallbackErr.message}`));
      }
    });
  });
}

function extractEmbeddedCoverArt(inputPath, outputPath, streamIndex) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegBin,
      [
        "-y",
        "-v", "warning",
        "-i", inputPath,
        "-map", `0:${streamIndex}`,
        "-frames:v", "1",
        "-c", "copy",
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
      else reject(new Error(`ffmpeg cover copy failed (${code}): ${stderr.slice(-500)}`));
    });
  });
}

// ── HLS 转码：先尝试快速封装，失败再重编码 ───────────────────────────────

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

// ── Lambda 主流程：下载、探测、转码、上传、封面、返回结果 ──────────────────

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

    // 1. 下载源文件：应用服务器不经手大文件，Lambda 从对象存储读取。
    await emitStage(jobId, videoId, shortCode, "downloading");
    console.log(`[transcode] job=${jobId} downloading s3://${inputBucket}/${inputKey}`);
    await downloadObject(inputBucket, inputKey, sourcePath);
    console.log(`[transcode] job=${jobId} download complete`);

    // 2. 提取视频元数据：给播放页展示时长、分辨率，也给封面策略提供依据。
    await emitStage(jobId, videoId, shortCode, "probing");
    const meta = await probeVideo(sourcePath);
    console.log(
      `[transcode] job=${jobId} meta: duration=${meta?.durationSeconds ?? "unknown"}s ` +
      `resolution=${meta?.width ?? "?"}x${meta?.height ?? "?"}`,
    );

    // 3. 转码：生成 HLS 清单和切片，让播放器可以按需加载、支持拖动。
    await emitStage(jobId, videoId, shortCode, "transcoding");
    console.log(
      `[transcode] job=${jobId} ffmpeg start type=${videoType} mode=single-rendition threads=${threads}`,
    );
    await transcodeSingleRenditionFast(sourcePath, outputDir);
    console.log(`[transcode] job=${jobId} ffmpeg done`);

    // 4. 上传 HLS 资源：重试前先清理旧前缀，避免新旧切片混在一起。
    await emitStage(jobId, videoId, shortCode, "uploading_segments");
    console.log(
      `[transcode] job=${jobId} uploading HLS to s3://${outputBucket}/${outputPrefix}`,
    );
    await clearPrefix(outputBucket, outputPrefix);
    await uploadDirectory(outputBucket, outputPrefix, outputDir);
    console.log(`[transcode] job=${jobId} HLS upload done`);

    // 5. 提取封面：有内嵌封面就复用，没有再从视频内容中选代表帧。
    await emitStage(jobId, videoId, shortCode, "thumbnail_extracting");
    const coverArt = meta?.coverArt ?? null;
    const thumbnailExt = coverArt?.extension ?? "jpg";
    const thumbnailContentType = coverArt?.contentType ?? "image/jpeg";
    const thumbnailLocalPath = join(workDir, `thumbnail.${thumbnailExt}`);
    let thumbnailKey = null;

    try {
      if (coverArt) {
        console.log(
          `[transcode] job=${jobId} embedded cover found: stream=${coverArt.streamIndex} codec=${coverArt.codecName}`,
        );
        await extractEmbeddedCoverArt(sourcePath, thumbnailLocalPath, coverArt.streamIndex);
        console.log(`[transcode] job=${jobId} thumbnail reused from embedded cover`);
      } else {
        await extractThumbnail(sourcePath, thumbnailLocalPath, meta?.durationSeconds ?? null);
        console.log(`[transcode] job=${jobId} thumbnail extracted from video frame`);
      }

      // 6. 上传缩略图：Finalize 使用该 key 生成封面 URL。
      await emitStage(jobId, videoId, shortCode, "thumbnail_uploading");
      thumbnailKey = `thumbnails/${shortCode}/thumbnail.${thumbnailExt}`;
      await uploadFile(imageBucket, thumbnailKey, thumbnailLocalPath, thumbnailContentType);
      console.log(
        `[transcode] job=${jobId} thumbnail uploaded → s3://${imageBucket}/${thumbnailKey}`,
      );
    } catch (thumbErr) {
      if (coverArt) {
        console.warn(
          `[transcode] job=${jobId} embedded cover reuse failed, fallback to frame capture: ${thumbErr.message}`,
        );
        try {
          const fallbackPath = join(workDir, "thumbnail.jpg");
          await extractThumbnail(sourcePath, fallbackPath, meta?.durationSeconds ?? null);
          await emitStage(jobId, videoId, shortCode, "thumbnail_uploading");
          thumbnailKey = `thumbnails/${shortCode}/thumbnail.jpg`;
          await uploadFile(imageBucket, thumbnailKey, fallbackPath, "image/jpeg");
          console.log(
            `[transcode] job=${jobId} thumbnail uploaded from fallback frame → s3://${imageBucket}/${thumbnailKey}`,
          );
        } catch (fallbackErr) {
          console.warn(
            `[transcode] job=${jobId} ⚠ thumbnail fallback failed (non-fatal): ${fallbackErr.message}`,
          );
        }
      } else {
        // 缩略图失败不阻断主流程，仅记录警告
        console.warn(`[transcode] job=${jobId} ⚠ thumbnail failed (non-fatal): ${thumbErr.message}`);
      }
    }

    console.log(`[transcode] job=${jobId} ✓ all done`);

    // 只返回结果，不直接写业务表；数据库更新交给 Finalize。
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
