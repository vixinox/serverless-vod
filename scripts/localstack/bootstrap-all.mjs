/**
 * bootstrap-all.mjs
 *
 * 一键初始化本地开发环境：
 *   1. 创建 S3 桶、配置 CORS/策略（bootstrap.mjs）
 *   2. 部署四个 Lambda 函数（deploy-lambdas.mjs）
 *   3. 创建/更新 Step Functions 状态机（deploy-sfn.mjs）
 *
 * 用法：npm run localstack:setup
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const here = import.meta.dirname;

function run(script) {
  return new Promise((resolve_, reject) => {
    const child = spawn(
      process.execPath, // node 可执行文件路径
      [script],
      {
        stdio: "inherit",
        env:   process.env,
        shell: false,
      },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve_(undefined);
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function main() {
  const steps = [
    ["bootstrap (S3 + IAM)", resolve(here, "bootstrap.mjs")],
    ["deploy-lambdas",        resolve(here, "deploy-lambdas.mjs")],
    ["deploy-sfn",            resolve(here, "deploy-sfn.mjs")],
  ];

  for (const [label, script] of steps) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`▶  ${label}`);
    console.log("─".repeat(60));
    await run(script);
  }

  console.log("\n✓ localstack:setup 完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
