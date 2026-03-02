/**
 * deploy-lambdas.mjs
 *
 * 将 scripts/localstack/lambda/ 下的每个子目录打包成 ZIP，
 * 通过 LocalStack Lambda API 创建或更新函数。
 *
 * 执行后写出 .lambda-arns.json 供 deploy-sfn.mjs 使用。
 *
 * 函数环境变量说明：
 *   NODE_PATH 指向项目根目录的 node_modules，
 *   Lambda 代码无需自带依赖，复用宿主安装。
 */

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";
import { readdir, readFile, stat, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, resolve, relative } from "node:path";
import { tmpdir } from "node:os";

// ── 配置 ─────────────────────────────────────────────────────────────────

const region    = process.env.AWS_DEFAULT_REGION    ?? "us-east-1";
const endpoint  = process.env.LOCALSTACK_ENDPOINT   ?? "http://127.0.0.1:4566";
const accountId = process.env.AWS_ACCOUNT_ID        ?? "000000000000";

const lambdaSrcDir = resolve(import.meta.dirname, "lambda");
const arnOutputFile = resolve(import.meta.dirname, ".lambda-arns.json");
const projectRoot = resolve(import.meta.dirname, "../..");
const nodeModulesDir = resolve(projectRoot, "node_modules");

// Lambda 在 LocalStack 容器（Linux）内执行，node_modules 通过 volume 挂载到 /opt/node_modules。
// 新架构下 Lambda 为纯 HTTP Thin Client，不再直接访问数据库。
// NEXT_API_BASE_URL 使用 host.docker.internal 穿透 Docker 网络访问宿主机 Next.js 服务。
const nextApiBaseUrl = (process.env.NEXT_API_BASE_URL ?? "http://host.docker.internal:3000").replace(
  /\b(localhost|127\.0\.0\.1)\b/g,
  "host.docker.internal",
);

// Lambda 在独立容器中运行，localhost/127.0.0.1 会回环到 Lambda 自身。
// 因此传给 Lambda runtime 的 LocalStack endpoint 也必须改写为 host.docker.internal。
const lambdaLocalstackEndpoint = endpoint.replace(
  /\b(localhost|127\.0\.0\.1)\b/g,
  "host.docker.internal",
);

// Lambda 运行时环境变量（转注给函数用）
const lambdaEnv = {
  NODE_PATH:             "/opt/node_modules",
  // 新架构：Lambda 通过 HTTP 回调 Next.js，无需直连数据库
  NEXT_API_BASE_URL:     nextApiBaseUrl,
  INTERNAL_API_SECRET:   process.env.INTERNAL_API_SECRET   ?? "",
  AWS_ACCESS_KEY_ID:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  AWS_DEFAULT_REGION:    region,
  LOCALSTACK_ENDPOINT:   lambdaLocalstackEndpoint,
  VOD_RAW_BUCKET:        process.env.VOD_RAW_BUCKET        ?? "vod-raw",
  VOD_HLS_BUCKET:        process.env.VOD_HLS_BUCKET        ?? "vod-hls",
  VOD_IMAGE_BUCKET:      process.env.VOD_IMAGE_BUCKET      ?? "vod-image",
  // Lambda 容器通过 --volumes-from=localstack 访问 localstack_data 卷，
  // ready.d init hook 已将静态 ffmpeg 复制到该路径
  FFMPEG_BIN:            process.env.FFMPEG_BIN            ?? "/var/lib/localstack/bin/ffmpeg",
  // ffprobe 与 ffmpeg 通常在同一目录
  FFPROBE_BIN:           process.env.FFPROBE_BIN           ?? "/var/lib/localstack/bin/ffprobe",
  // 编码线程数限制，防止宿主机 CPU 被打满（默认 2）
  FFMPEG_THREADS:        process.env.FFMPEG_THREADS        ?? "2",
  // EventBridge 自定义事件总线名称
  VOD_EVENT_BUS:         process.env.VOD_EVENT_BUS         ?? "vod-events",
};

const lambda = new LambdaClient({
  region,
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

// ── 最小 ZIP 构建（纯 Node.js，无外部依赖）─────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function u16le(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}
function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * 将 { name, data } 数组打成内存中的 ZIP（Stored，无压缩）
 * @param {{ name: string; data: Buffer }[]} entries
 * @returns {Buffer}
 */
function buildZip(entries) {
  const localHeaders  = [];
  const centralDirs   = [];
  let offset = 0;

  // DOS time: 2000-01-01 00:00:00
  const dosDate = Buffer.from([0x21, 0x00]); // 2000-01-01
  const dosTime = Buffer.from([0x00, 0x00]);

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, "utf8");
    const crc       = crc32(data);
    const size      = data.length;

    // Local file header
    const localHeader = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      u16le(20),          // version needed
      u16le(0),           // flags
      u16le(0),           // compression (stored)
      dosTime,            // mod time
      dosDate,            // mod date
      u32le(crc),         // CRC-32
      u32le(size),        // compressed size
      u32le(size),        // uncompressed size
      u16le(nameBytes.length),
      u16le(0),           // extra length
      nameBytes,
      data,
    ]);

    // Central dir entry
    const centralDir = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      u16le(20),          // version made by
      u16le(20),          // version needed
      u16le(0),           // flags
      u16le(0),           // compression
      dosTime,
      dosDate,
      u32le(crc),
      u32le(size),
      u32le(size),
      u16le(nameBytes.length),
      u16le(0),           // extra length
      u16le(0),           // comment length
      u16le(0),           // disk number start
      u16le(0),           // internal attrs
      u32le(0),           // external attrs
      u32le(offset),      // local header offset
      nameBytes,
    ]);

    localHeaders.push(localHeader);
    centralDirs.push(centralDir);
    offset += localHeader.length;
  }

  const cdOffset = offset;
  const cdData   = Buffer.concat(centralDirs);
  const eocd     = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // EOCD signature
    u16le(0),                               // disk number
    u16le(0),                               // disk with CD
    u16le(entries.length),                  // entries on disk
    u16le(entries.length),                  // total entries
    u32le(cdData.length),                   // CD size
    u32le(cdOffset),                        // CD offset
    u16le(0),                               // comment length
  ]);

  return Buffer.concat([...localHeaders, cdData, eocd]);
}

// ── 递归收集目录下所有文件为 ZIP entries ────────────────────────────────────

async function collectEntries(dir, base) {
  const root = base ?? dir;
  const entries = [];
  const items = await readdir(dir);

  for (const item of items) {
    const full = join(dir, item);
    const info = await stat(full);

    if (info.isDirectory()) {
      const sub = await collectEntries(full, root);
      entries.push(...sub);
    } else {
      const relPath = relative(root, full).replace(/\\/g, "/");
      const data = await readFile(full);
      entries.push({ name: relPath, data });
    }
  }

  return entries;
}

function packageDirByName(packageName) {
  return join(nodeModulesDir, ...packageName.split("/"));
}

async function collectPackageClosure(entryPackages) {
  const visited = new Set();
  const queue = [...entryPackages];

  while (queue.length > 0) {
    const pkgName = queue.shift();
    if (!pkgName || visited.has(pkgName)) continue;

    const pkgDir = packageDirByName(pkgName);
    const pkgJsonPath = join(pkgDir, "package.json");

    let pkgJson;
    try {
      pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf8"));
    } catch {
      throw new Error(`node_modules 中缺少依赖包: ${pkgName}（路径: ${pkgJsonPath}）`);
    }

    visited.add(pkgName);

    const deps = {
      ...(pkgJson.dependencies ?? {}),
      ...(pkgJson.optionalDependencies ?? {}),
    };
    for (const depName of Object.keys(deps)) {
      if (!visited.has(depName)) queue.push(depName);
    }
  }

  return visited;
}

async function collectNodeModulesEntries(packageNames) {
  const entries = [];
  const closure = await collectPackageClosure(packageNames);

  for (const pkgName of closure) {
    const pkgDir = packageDirByName(pkgName);
    const pkgEntries = await collectEntries(pkgDir);
    entries.push(
      ...pkgEntries.map((e) => ({
        ...e,
        name: `node_modules/${pkgName}/${e.name}`,
      })),
    );
  }

  return entries;
}

// ── Lambda 创建 / 更新 ───────────────────────────────────────────────────

async function functionExists(name) {
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: name }));
    return true;
  } catch {
    return false;
  }
}

async function deployFunction(name, zipBuffer, handlerPath) {
  const ZipFile = zipBuffer;

  if (await functionExists(name)) {
    console.log(`[update] ${name}`);
    await lambda.send(
      new UpdateFunctionCodeCommand({ FunctionName: name, ZipFile }),
    );
    await waitUntilFunctionUpdated(
      { client: lambda, maxWaitTime: 60 },
      { FunctionName: name },
    );
    // 同步更新环境变量（UpdateFunctionCodeCommand 不会更新 env）
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: name,
        Environment: { Variables: lambdaEnv },
      }),
    );
    await waitUntilFunctionUpdated(
      { client: lambda, maxWaitTime: 60 },
      { FunctionName: name },
    );
  } else {
    console.log(`[create] ${name}`);
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: name,
        Runtime:      "nodejs22.x",
        Role:         `arn:aws:iam::${accountId}:role/lambda-role`,
        Handler:      handlerPath,          // e.g. "index.handler"
        Code:         { ZipFile },
        Timeout:      900,                  // 15 min（转码需要足够时间）
        MemorySize:   1024,
        Environment:  { Variables: lambdaEnv },
      }),
    );
  }
}

// ── 主流程 ──────────────────────────────────────────────────────────────

async function main() {
  // 读取 lambda/ 下的所有函数目录（排除 _shared）
  const dirs = (await readdir(lambdaSrcDir)).filter((d) => !d.startsWith("_"));
  const arns = {};

  for (const dir of dirs) {
    const funcDir = join(lambdaSrcDir, dir);
    const info = await stat(funcDir);
    if (!info.isDirectory()) continue;

    // 收集该函数目录 + _shared 目录的文件
    const funcEntries   = await collectEntries(funcDir);
    const sharedEntries = await collectEntries(join(lambdaSrcDir, "_shared")).then(
      (es) => es.map((e) => ({ ...e, name: `_shared/${e.name}` })),
    );

    // transcode Lambda 依赖 @aws-sdk/client-s3 与 @aws-sdk/client-eventbridge；
    // extract-metadata Lambda 依赖 @aws-sdk/client-eventbridge（发布阶段事件）；
    // 在 Lambda 容器中无法复用宿主 node_modules，因此把依赖闭包打进 ZIP。
    const runtimeDeps =
      dir === "transcode"
        ? await collectNodeModulesEntries(["@aws-sdk/client-s3", "@aws-sdk/client-eventbridge"])
        : dir === "extract-metadata"
          ? await collectNodeModulesEntries(["@aws-sdk/client-eventbridge"])
          : [];

    const allEntries = [...funcEntries, ...sharedEntries, ...runtimeDeps];
    const zipBuffer  = buildZip(allEntries);

    const funcName   = `vod-${dir}`;   // e.g. vod-transcode
    const handlerKey = "index.handler";

    await deployFunction(funcName, zipBuffer, handlerKey);
    arns[dir] = `arn:aws:lambda:${region}:${accountId}:function:${funcName}`;
    console.log(`[ok] ${funcName} → ${arns[dir]}`);
  }

  await writeFile(arnOutputFile, JSON.stringify(arns, null, 2));
  console.log(`\n[ok] ARNs written to ${arnOutputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
