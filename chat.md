一、 项目背景与重构动机 (Context & Motivation)
目前我们正在开发一个 VOD（Video On Demand）视频转码与处理的流水线系统。
底层基础设施使用 AWS Step Functions (状态机) 进行流程编排，通过调用一系列 AWS Lambda 函数实现具体的业务节点，本地开发环境依赖 LocalStack。

在之前的架构中，我们的 Lambda 函数（例如 vod-extract-metadata 提取元数据节点 和 vod-mark-failed 失败降级节点）内部直接引进了 @prisma/client 进行数据库的读写。
这导致了三个极其严重的生产痛点：

构建与运行故障：Lambda 部署包中找不到 @prisma/client 依赖，并且 Prisma 底层的二进制 Query Engine 在 macOS 开发机与 LocalStack 的 Linux 容器之间存在跨平台架构不兼容的乱象，直接导致容器冷启动崩溃（Error: Cannot find package）。
逻辑级联故障：Step Functions 状态机的 ASL (Amazon States Language) 配置中，由于 Catch 块处理异常时的 JsonPath 映射错误（试图寻找根节点不存在的 $.Error），导致了恢复机制也跟着崩溃 (NoSuchJsonPathError)。
基础设施环境噪音：LocalStack 没有开启 EventBridge，导致每次状态机流转都在不停抛出一个无意义的 Service 'events' is not enabled 噪音日志。
二、 全新目标架构 (Target Architecture)
为了获得极速的 Lambda 冷启动并且统一收口数据库连接池，我们决定实施彻底的架构解耦重构：

1. 数据库访问层统一后撤：
所有包含 @prisma/client 逻辑的代码全部从 AWS Lambda 项目中彻底剔除。Lambda 将从“直接连数据库的重终端”蜕变为“纯粹的轻量级 HTTP 客户端 (Thin Client)”。

2. 引入 Next.js 中继 API (Webhook Pattern)：
将原来在 Lambda 里面执行的 Prisma 数据库落盘逻辑，全部转移到 Next.js 工程下的 app/api/... 或 pages/api/... 路由中（作为一个供内部调用的 Webhook 服务）。Lambda 仅仅负责执行自身的核心计算（或者对接其他 AWS 服务），完成后通过 Node.js 原生的 fetch 调用 Next.js 的 RESTful API 进行数据库更新。

3. 内部调用的安全沙箱 (Security & Auth)：
既然 Next.js 开出了修改数据库的 API，我们绝不能允许外网裸连。需要在 Next.js API 和 Lambda 之间约定一个内部通信密钥 (INTERNAL_API_SECRET)，通过 HTTP Headers 校验鉴权。

三、 具体开发方案与执行步骤 (Actionable Blueprint)
针对以上架构，请你在后续协助我编写代码时，严格围绕以下四个核心阶段进行：

第一阶段：Next.js API 服务服务端点的构建 (The Next.js API Layer)
在我们的 Next.js 工程中，新增两个内部供 Lambda 调用的 Serverless API 路由：

API 1: POST /api/internal/vod/update-metadata
职责：接收 Lambda 传回来的原视频信息（jobId, videoId, duration, resolution 等），并使用 Prisma 更新数据库中记录的状态为 METADATA_EXTRACTED 或类似状态。
鉴权限制：检查 req.headers.authorization 是否匹配预定义的共享密钥。
API 2: POST /api/internal/vod/mark-failed
职责：接收崩溃状态机的错误信息（jobId, videoId, errorType, errorMessage），将 Prisma 数据库对应记录的状态置为 FAILED 并记录失败原因供后台排查。
第二阶段：Lambda 函数的“极简化”重构 (The Thin Lambda Layer)
将现有的 vod-extract-metadata 和 vod-mark-failed Lambda 代码完全推翻，按以下规范重写：

零依赖移除：package.json 中彻底拿掉 prisma 及 @prisma/client。
只用原生 fetch：Node.js 18+ 环境下，直接使用原生 fetch 发送状态更新给 Next.js。
网络寻址避坑（非常重要）：由于 Lambda 运行在 LocalStack 的 Docker 容器里面，它如果试图 fetch http://localhost:3000 会打到他自己的容器内部。
约定：必须通过环境变量传入具体的 API Base URL。本地研发期间，环境变量 NEXT_API_BASE_URL 必须配成 http://host.docker.internal:3000（或者你本机的局域网 IP），这样才能击穿 Docker 网络，访问到宿主机上跑的 Next.js 服务。
第三阶段：AWS Step Functions / ASL 的无缝缝合 (Orchestration Fix)
针对状态机之前抛出的 NoSuchJsonPathError，在 ASL (JSON 定义) 中修复失败状态路由 (Catch 和 Parameters) 时的变量读取路径。这需要明确指出异常注入的位置。

如果用的是 ResultPath: "$.errorInfo" 来捕获错误，那么在后续向 vod-mark-failed 传参时，Parameters 字段必须改写为从 $.errorInfo.Error 和 $.errorInfo.Cause 提取：
json

折叠
复制
1
2
3
4
5
6
⌄
"Parameters": {
  "jobId.$": "$.jobId",
  "videoId.$": "$.videoId",
  "error.$": "$.errorInfo.Error",
  "cause.$": "$.errorInfo.Cause"
}
第四阶段：LocalStack 容器编排修复 (Infrastructure Fix)
更改提供 LocalStack 运行环境的 docker-compose.yml 配置文件：

在 SERVICES 环境变量参数中加入 events (例如：SERVICES=lambda,stepfunctions,s3,events)，彻底掐断引擎初始化时无法发送 EventBridge 消息的循环报错。
