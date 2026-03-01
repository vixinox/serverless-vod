/**
 * Lambda: vod-transcode
 *
 * 状态机第二步：
 * 1. 从 vod-raw 下载源视频 ({shortCode}/source.mp4)
 * 2. 调用 ffmpeg 转为 HLS（SHORT: 单码率；LONG: 双码率 source + 720p）
 * 3. 将切片和 manifest 上传至 vod-hls
 *
 * 输入与 extract-metadata 输出一致：
 *   { jobId, videoId, shortCode, inputBucket, inputKey,
 *     outputBucket, outputPrefix, videoType }
 */
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

// _shared/ 与 index.mjs 同级打包在 /var/task/ 下，使用相对路径 ./ 而非 ../
import { downloadObject, clearPrefix, uploadDirectory } from "./_shared/s3.mjs";

const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";

// ── ffmpeg 执行器 ──────────────────────────────────────────────────────────

function runCommand(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${bin} exited ${code}:\n${output.slice(-2000)}`));
    });
  });
}

// ── HLS 转码（SHORT 视频：单码率直出）──────────────────────────────────────

async function transcodeShort(inputPath, outputDir) {
  await runCommand(
    ffmpegBin,
    [
      "-y", "-i", inputPath,
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

// ── HLS 转码（LONG 视频：双码率 source + 720p）──────────────────────────────

async function transcodeLong(inputPath, outputDir) {
  await runCommand(
    ffmpegBin,
    [
      "-y", "-i", inputPath,
      "-filter_complex", "[0:v]split=2[vsrc][v720];[v720]scale=-2:720[v720out]",
      "-map", "[vsrc]",   "-map", "0:a?",
      "-c:v:0", "libx264", "-preset:v:0", "veryfast", "-g:v:0", "48", "-sc_threshold:v:0", "0",
      "-map", "[v720out]", "-map", "0:a?",
      "-c:v:1", "libx264", "-preset:v:1", "veryfast", "-g:v:1", "48", "-sc_threshold:v:1", "0",
      "-c:a", "aac", "-ar", "48000", "-b:a", "128k",
      "-f", "hls",
      "-hls_time", "3",
      "-hls_playlist_type", "vod",
      "-hls_flags", "independent_segments",
      "-hls_segment_filename", join(outputDir, "%v", "seg_%03d.ts"),
      "-master_pl_name", "master.m3u8",
      "-var_stream_map", "v:0,a:0,name:source v:1,a:1,name:720p",
      join(outputDir, "%v", "index.m3u8"),
    ],
    outputDir,
  );
}

// ── Lambda handler ─────────────────────────────────────────────────────────

export const handler = async (event) => {
  const { jobId, videoId, shortCode, inputBucket, inputKey, outputBucket, outputPrefix, videoType } = event;

  const workDir = await mkdtemp(join(tmpdir(), `vod-${shortCode}-`));
  const sourcePath = join(workDir, "source.mp4");
  const outputDir = join(workDir, "out");

  try {
    await mkdir(outputDir, { recursive: true });

    console.log(`[transcode] job=${jobId} downloading s3://${inputBucket}/${inputKey}`);
    await downloadObject(inputBucket, inputKey, sourcePath);

    console.log(`[transcode] job=${jobId} ffmpeg start type=${videoType}`);
    if (videoType === "LONG") {
      await transcodeLong(sourcePath, outputDir);
    } else {
      await transcodeShort(sourcePath, outputDir);
    }

    console.log(`[transcode] job=${jobId} uploading HLS to s3://${outputBucket}/${outputPrefix}`);
    await clearPrefix(outputBucket, outputPrefix);
    await uploadDirectory(outputBucket, outputPrefix, outputDir);

    console.log(`[transcode] job=${jobId} ✓ done`);
    return { jobId, videoId, shortCode, outputBucket, outputPrefix };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
};
