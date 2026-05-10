import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";

const projectRoot = process.cwd();
const docsDir = path.join(projectRoot, "docs");
const assetsDir = path.join(docsDir, "ppt-assets");
const shotsDir = path.join(assetsDir, "screenshots");
const outputPath = path.join(docsDir, "答辩演示.pptx");

fs.mkdirSync(assetsDir, { recursive: true });
fs.mkdirSync(shotsDir, { recursive: true });

const COLORS = {
  dark: "0F172A",
  light: "F8FAFC",
  white: "FFFFFF",
  text: "0F172A",
  muted: "64748B",
  accent: "14B8A6",
  warm: "F97316",
  border: "CBD5E1",
  softCard: "EEF2F7",
  ok: "22C55E",
  warn: "F59E0B",
  fail: "EF4444",
};

const FONTS = {
  title: "Microsoft YaHei",
  body: "Microsoft YaHei",
  code: "Consolas",
};

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.author = "[姓名]";
pptx.company = "北京理工大学珠海学院";
pptx.subject = "本科毕业答辩";
pptx.title = "基于AWS Serverless的视频点播平台的设计与实现";
pptx.lang = "zh-CN";

const SLIDE_W = 10;
const SLIDE_H = 5.625;

const jmeterSummaryPath = path.join(projectRoot, "reports", "jmeter", "video-list-summary.json");
const fallbackJmeterData = [
  { threads: "50", throughput: 112.45, avg: 411, p99: 883, errorRate: 0 },
  { threads: "100", throughput: 119.71, avg: 770, p99: 1542, errorRate: 0 },
  { threads: "200", throughput: 146.89, avg: 1257, p99: 2733, errorRate: 0 },
];

function loadJmeterData() {
  if (!fs.existsSync(jmeterSummaryPath)) {
    return fallbackJmeterData;
  }
  try {
    const raw = fs.readFileSync(jmeterSummaryPath, "utf8");
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed.results) ? parsed.results : [];
    const normalized = rows
      .map((row) => ({
        threads: String(row.threads ?? ""),
        throughput: Number(row.throughput ?? 0),
        avg: Number(row.average ?? 0),
        p99: Number(row.p99 ?? 0),
        errorRate: Number(row.errorRate ?? 0),
      }))
      .filter((row) => row.threads && Number.isFinite(row.throughput) && Number.isFinite(row.p99));
    return normalized.length > 0 ? normalized : fallbackJmeterData;
  } catch {
    return fallbackJmeterData;
  }
}

const jmeterData = loadJmeterData();

function bgLight(slide) {
  slide.background = { color: COLORS.light };
}

function bgDark(slide) {
  slide.background = { color: COLORS.dark };
}

function addTopTag(slide, text) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.5,
    y: 0.3,
    w: 1.7,
    h: 0.32,
    rectRadius: 0.08,
    line: { color: COLORS.accent, width: 0 },
    fill: { color: COLORS.accent, transparency: 5 },
  });
  slide.addText(text, {
    x: 0.58,
    y: 0.36,
    w: 1.52,
    h: 0.2,
    fontFace: FONTS.body,
    fontSize: 10,
    bold: true,
    color: COLORS.white,
    margin: 0,
    align: "center",
  });
}

function addTitle(slide, title, sub = "") {
  slide.addText(title, {
    x: 0.5,
    y: 0.72,
    w: 7.4,
    h: 0.6,
    fontFace: FONTS.title,
    fontSize: 30,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.5,
      y: 1.28,
      w: 8.8,
      h: 0.35,
      fontFace: FONTS.body,
      fontSize: 13,
      color: COLORS.muted,
      margin: 0,
    });
  }
}

function addTitleDark(slide, title, sub = "") {
  slide.addText(title, {
    x: 0.5,
    y: 0.72,
    w: 8.6,
    h: 0.8,
    fontFace: FONTS.title,
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.5,
      y: 1.55,
      w: 8.8,
      h: 0.35,
      fontFace: FONTS.body,
      fontSize: 13,
      color: "BFDBFE",
      margin: 0,
    });
  }
}

function card(slide, x, y, w, h, leftAccent = false) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h,
    line: { color: COLORS.border, width: 1 },
    fill: { color: COLORS.white },
    shadow: { type: "outer", color: "000000", blur: 2, offset: 1, angle: 45, opacity: 0.08 },
  });
  if (leftAccent) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.08,
      h,
      line: { color: COLORS.accent, width: 0 },
      fill: { color: COLORS.accent },
    });
  }
}

function addBulletRows(slide, rows, baseX, baseY, width) {
  rows.forEach((row, index) => {
    const y = baseY + index * 0.72;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: baseX,
      y: y + 0.03,
      w: 0.12,
      h: 0.12,
      line: { color: COLORS.accent, width: 0 },
      fill: { color: COLORS.accent },
    });
    slide.addText(row, {
      x: baseX + 0.2,
      y,
      w: width,
      h: 0.34,
      fontFace: FONTS.body,
      fontSize: 14,
      color: COLORS.text,
      margin: 0,
    });
  });
}

function addFlowBox(slide, x, y, label, color = COLORS.accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: 1.62,
    h: 0.56,
    rectRadius: 0.08,
    line: { color, width: 1 },
    fill: { color: COLORS.white },
  });
  slide.addText(label, {
    x: x + 0.08,
    y: y + 0.16,
    w: 1.46,
    h: 0.2,
    fontFace: FONTS.body,
    fontSize: 11,
    color: COLORS.text,
    align: "center",
    margin: 0,
  });
}

function connectArrow(slide, x, y, w) {
  slide.addShape(pptx.ShapeType.line, {
    x,
    y,
    w,
    h: 0,
    line: { color: COLORS.muted, width: 1.6, endArrowType: "triangle" },
  });
}

function shotPath(fileName) {
  return path.join(shotsDir, fileName);
}

function addScreenshotOrPlaceholder(slide, fileName, caption, x, y, w, h) {
  const imgPath = shotPath(fileName);
  if (fs.existsSync(imgPath)) {
    slide.addImage({
      path: imgPath,
      x,
      y,
      w,
      h,
      sizing: { type: "cover", x, y, w, h },
      shadow: { type: "outer", color: "000000", blur: 2, offset: 1, angle: 45, opacity: 0.1 },
    });
  } else {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      line: { color: COLORS.border, width: 1.2, dashType: "dash" },
      fill: { color: COLORS.softCard },
    });
    slide.addText("待替换截图", {
      x,
      y: y + 0.26,
      w,
      h: 0.3,
      fontFace: FONTS.body,
      fontSize: 14,
      bold: true,
      color: COLORS.muted,
      align: "center",
      margin: 0,
    });
    slide.addText(fileName, {
      x,
      y: y + 0.57,
      w,
      h: 0.2,
      fontFace: FONTS.code,
      fontSize: 9,
      color: COLORS.muted,
      align: "center",
      margin: 0,
    });
  }
  slide.addText(caption, {
    x,
    y: y + h + 0.05,
    w,
    h: 0.2,
    fontFace: FONTS.body,
    fontSize: 10,
    color: COLORS.muted,
    align: "center",
    margin: 0,
  });
}

function slide1Title() {
  const slide = pptx.addSlide();
  bgDark(slide);
  addTopTag(slide, "本科毕业答辩");
  addTitleDark(slide, "基于AWS Serverless的视频点播平台", "设计与实现");

  slide.addText("姓名：[姓名]   学号：[学号]", {
    x: 0.5,
    y: 2.18,
    w: 4.9,
    h: 0.3,
    fontFace: FONTS.body,
    fontSize: 13,
    color: "DBEAFE",
    margin: 0,
  });
  slide.addText("专业：[专业]   指导老师：[指导老师]", {
    x: 0.5,
    y: 2.55,
    w: 5.6,
    h: 0.3,
    fontFace: FONTS.body,
    fontSize: 13,
    color: "DBEAFE",
    margin: 0,
  });
  slide.addText("答辩日期：2026 年 5 月", {
    x: 0.5,
    y: 2.92,
    w: 4.8,
    h: 0.3,
    fontFace: FONTS.body,
    fontSize: 13,
    color: "DBEAFE",
    margin: 0,
  });

  card(slide, 5.7, 1.45, 3.8, 2.95, true);
  slide.addText("架构主轴", {
    x: 5.92,
    y: 1.67,
    w: 1.8,
    h: 0.28,
    fontFace: FONTS.body,
    fontSize: 14,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  addFlowBox(slide, 5.92, 2.12, "Web 应用层\nNext.js 16 / React 19");
  addFlowBox(slide, 7.92, 2.12, "数据层\nPostgreSQL / Prisma");
  addFlowBox(slide, 5.92, 2.95, "媒体处理层\nS3 / Lambda / FFmpeg");
  addFlowBox(slide, 7.92, 2.95, "编排与事件\nStep Functions / EventBridge");
}

function slide2Background() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "01 背景");
  addTitle(slide, "研究背景与问题", "中小规模视频点播平台的核心挑战");

  const blocks = [
    {
      title: "大文件上传压力",
      text: "视频文件体积大，后端中转上传会占用大量带宽与连接资源。",
      color: COLORS.warm,
    },
    {
      title: "异步转码复杂",
      text: "转码链路涉及多个阶段，失败恢复与状态一致性处理难度高。",
      color: COLORS.accent,
    },
    {
      title: "传统架构运维重",
      text: "常驻转码服务与中间件集群投入大，资源峰谷不均时成本高。",
      color: COLORS.fail,
    },
  ];

  blocks.forEach((item, i) => {
    const y = 1.85 + i * 1.03;
    card(slide, 0.7, y, 8.6, 0.86, false);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.86,
      y: y + 0.16,
      w: 1.85,
      h: 0.48,
      rectRadius: 0.08,
      line: { color: item.color, width: 0 },
      fill: { color: item.color },
    });
    slide.addText(item.title, {
      x: 0.95,
      y: y + 0.31,
      w: 1.65,
      h: 0.2,
      fontFace: FONTS.body,
      fontSize: 11,
      bold: true,
      color: COLORS.white,
      align: "center",
      margin: 0,
    });
    slide.addText(item.text, {
      x: 2.95,
      y: y + 0.22,
      w: 6.1,
      h: 0.42,
      fontFace: FONTS.body,
      fontSize: 14,
      color: COLORS.text,
      margin: 0,
    });
  });
}

function slide3Goal() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "02 目标");
  addTitle(slide, "研究目标与系统范围", "实现内容生产、处理、消费、运营的一体化闭环");

  addFlowBox(slide, 0.8, 2.0, "上传", COLORS.accent);
  addFlowBox(slide, 2.85, 2.0, "处理", COLORS.accent);
  addFlowBox(slide, 4.9, 2.0, "播放", COLORS.accent);
  addFlowBox(slide, 6.95, 2.0, "统计", COLORS.accent);
  connectArrow(slide, 2.45, 2.28, 0.34);
  connectArrow(slide, 4.5, 2.28, 0.34);
  connectArrow(slide, 6.55, 2.28, 0.34);

  card(slide, 0.7, 3.0, 8.6, 1.95, true);
  addBulletRows(
    slide,
    [
      "游客：浏览首页、搜索、稳定播放公开视频。",
      "注册用户：评论、点赞、订阅、收藏、播放列表。",
      "创作者：上传视频、查看转码状态、管理内容、分析数据。",
    ],
    1.0,
    3.28,
    7.7,
  );
}

function slide4Architecture() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "03 架构");
  addTitle(slide, "总体架构设计", "同步业务走应用层，异步媒体任务走Serverless流水线");

  card(slide, 0.8, 1.78, 8.4, 1.0, true);
  slide.addText("应用层：Next.js 16 + React 19", {
    x: 1.1,
    y: 2.02,
    w: 3.4,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 16,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  slide.addText("负责页面渲染、接口聚合、权限校验、业务编排。", {
    x: 4.4,
    y: 2.06,
    w: 4.5,
    h: 0.22,
    fontFace: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
    margin: 0,
  });

  card(slide, 0.8, 2.94, 8.4, 1.0, true);
  slide.addText("数据层：PostgreSQL + Prisma", {
    x: 1.1,
    y: 3.18,
    w: 3.4,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 16,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  slide.addText("负责实体关系、任务状态、统计聚合和一致性约束。", {
    x: 4.4,
    y: 3.22,
    w: 4.5,
    h: 0.22,
    fontFace: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
    margin: 0,
  });

  card(slide, 0.8, 4.1, 8.4, 1.0, true);
  slide.addText("媒体处理层：S3 + Lambda + Step Functions + EventBridge", {
    x: 1.1,
    y: 4.33,
    w: 5.8,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 15,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  slide.addText("负责预签名直传、转码切片、阶段事件回写、失败重试。", {
    x: 6.1,
    y: 4.36,
    w: 3.0,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
    margin: 0,
  });
}

function slide5Modules() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "04 模块");
  addTitle(slide, "核心业务模块", "围绕“发现-消费-生产-运营”构建完整平台能力");

  const modules = [
    { t: "用户认证", s: "Better Auth\n会话管理/权限控制" },
    { t: "内容浏览", s: "首页流式加载\n搜索与推荐展示" },
    { t: "播放互动", s: "HLS播放\n评论/点赞/订阅" },
    { t: "上传处理", s: "预签名上传\n状态机异步转码" },
    { t: "工作室统计", s: "内容管理\n数据分析图表" },
  ];

  modules.forEach((m, i) => {
    const x = 0.7 + (i % 3) * 3.08;
    const y = i < 3 ? 2.0 : 3.55;
    card(slide, x, y, 2.85, 1.35, false);
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.18,
      y: y + 0.18,
      w: 0.35,
      h: 0.35,
      line: { color: COLORS.accent, width: 0 },
      fill: { color: COLORS.accent },
    });
    slide.addText(String(i + 1), {
      x: x + 0.285,
      y: y + 0.295,
      w: 0.12,
      h: 0.12,
      fontFace: FONTS.code,
      fontSize: 9,
      bold: true,
      color: COLORS.white,
      align: "center",
      margin: 0,
    });
    slide.addText(m.t, {
      x: x + 0.63,
      y: y + 0.25,
      w: 2.05,
      h: 0.24,
      fontFace: FONTS.body,
      fontSize: 14,
      bold: true,
      color: COLORS.text,
      margin: 0,
    });
    slide.addText(m.s, {
      x: x + 0.22,
      y: y + 0.64,
      w: 2.45,
      h: 0.55,
      fontFace: FONTS.body,
      fontSize: 11,
      color: COLORS.muted,
      margin: 0,
      valign: "top",
    });
  });
}

function slide6Pipeline() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "05 核心");
  addTitle(slide, "媒体处理流程设计", "预签名直传 + 状态机编排 + 资源回写形成可观测异步链路");

  const labels = [
    "获取预签名地址",
    "直传 vod-raw",
    "创建 UploadSession/TranscodeJob",
    "启动 Step Functions",
    "Lambda 处理链路",
    "写入 HLS/封面与状态",
  ];

  const y = 2.15;
  labels.forEach((text, i) => {
    const x = 0.45 + i * 1.6;
    card(slide, x, y, 1.45, 1.1, true);
    slide.addText(`0${i + 1}`, {
      x: x + 0.14,
      y: y + 0.15,
      w: 0.34,
      h: 0.2,
      fontFace: FONTS.code,
      fontSize: 10,
      bold: true,
      color: COLORS.accent,
      margin: 0,
    });
    slide.addText(text, {
      x: x + 0.14,
      y: y + 0.38,
      w: 1.16,
      h: 0.56,
      fontFace: FONTS.body,
      fontSize: 10,
      color: COLORS.text,
      margin: 0,
    });
    if (i < labels.length - 1) {
      connectArrow(slide, x + 1.47, y + 0.56, 0.1);
    }
  });

  card(slide, 0.7, 3.55, 8.6, 1.35, false);
  addBulletRows(
    slide,
    [
      "视频文件上传不经过 Next.js 服务端，减少应用层带宽消耗与阻塞。",
      "流水线阶段状态通过内部接口回写数据库，前端轮询即可追踪进度。",
    ],
    1.0,
    3.85,
    7.7,
  );
}

function slide7Recovery() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "06 稳定性");
  addTitle(slide, "状态机与异常恢复", "确保任务失败可定位、可恢复、可重试");

  card(slide, 0.7, 1.85, 4.2, 2.0, false);
  slide.addText("成功路径", {
    x: 0.95,
    y: 2.08,
    w: 1.5,
    h: 0.22,
    fontFace: FONTS.body,
    fontSize: 14,
    bold: true,
    color: COLORS.ok,
    margin: 0,
  });
  addFlowBox(slide, 0.95, 2.45, "UPLOADING", COLORS.ok);
  addFlowBox(slide, 2.38, 2.45, "PROCESSING", COLORS.ok);
  addFlowBox(slide, 3.81, 2.45, "READY", COLORS.ok);
  connectArrow(slide, 2.2, 2.72, 0.12);
  connectArrow(slide, 3.63, 2.72, 0.12);

  card(slide, 5.1, 1.85, 4.2, 2.0, false);
  slide.addText("失败与恢复路径", {
    x: 5.34,
    y: 2.08,
    w: 2.2,
    h: 0.22,
    fontFace: FONTS.body,
    fontSize: 14,
    bold: true,
    color: COLORS.fail,
    margin: 0,
  });
  addFlowBox(slide, 5.34, 2.43, "Lambda异常 → Catch", COLORS.fail);
  addFlowBox(slide, 7.1, 2.43, "mark-failed 回写", COLORS.fail);
  connectArrow(slide, 6.93, 2.7, 0.12);
  slide.addText("FAILED / retry / reconcile-stale", {
    x: 5.37,
    y: 3.13,
    w: 3.6,
    h: 0.28,
    fontFace: FONTS.code,
    fontSize: 12,
    color: COLORS.text,
    margin: 0,
  });

  card(slide, 0.7, 4.1, 8.6, 0.92, true);
  slide.addText("关键点：通过任务表 + 内部回调 + 纠错接口，避免“卡死任务”造成前端长期锁定。", {
    x: 1.02,
    y: 4.41,
    w: 8.0,
    h: 0.28,
    fontFace: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    margin: 0,
  });
}

function slide8Database() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "07 数据");
  addTitle(slide, "数据库与一致性设计", "核心实体分组 + 触发器计数 + 日级统计汇总");

  const groups = [
    {
      title: "认证与会话",
      body: "User / Session / Account / Verification",
    },
    {
      title: "内容互动",
      body: "Video / Channel / Comment / Reaction / Subscription",
    },
    {
      title: "上传处理",
      body: "UploadSession / TranscodeJob / VideoAsset",
    },
    {
      title: "统计分析",
      body: "VideoPlaybackEvent / VideoDailyStat / ChannelDailyStat",
    },
  ];
  groups.forEach((g, i) => {
    const x = i % 2 === 0 ? 0.8 : 5.05;
    const y = i < 2 ? 2.0 : 3.4;
    card(slide, x, y, 4.1, 1.2, true);
    slide.addText(g.title, {
      x: x + 0.25,
      y: y + 0.21,
      w: 1.8,
      h: 0.22,
      fontFace: FONTS.body,
      fontSize: 14,
      bold: true,
      color: COLORS.text,
      margin: 0,
    });
    slide.addText(g.body, {
      x: x + 0.25,
      y: y + 0.55,
      w: 3.7,
      h: 0.46,
      fontFace: FONTS.code,
      fontSize: 10,
      color: COLORS.muted,
      margin: 0,
    });
  });

  card(slide, 0.8, 4.72, 8.3, 0.65, false);
  slide.addText("一致性策略：触发器维护互动计数；存储过程 rollup.daily 按日聚合，降低统计页实时查询压力。", {
    x: 1.05,
    y: 4.93,
    w: 7.9,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 12,
    color: COLORS.text,
    margin: 0,
  });
}

function slide9Screens() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "08 实现");
  addTitle(slide, "系统实现效果", "可替换为真实系统截图：首页、播放页、上传页、工作室与统计页");

  addScreenshotOrPlaceholder(
    slide,
    "home-search.png",
    "首页/搜索页",
    0.68,
    1.92,
    4.1,
    1.45,
  );
  addScreenshotOrPlaceholder(
    slide,
    "watch-page.png",
    "视频播放页",
    5.2,
    1.92,
    4.1,
    1.45,
  );
  addScreenshotOrPlaceholder(
    slide,
    "upload-pipeline.png",
    "上传与转码进度页",
    0.68,
    3.6,
    4.1,
    1.45,
  );
  addScreenshotOrPlaceholder(
    slide,
    "studio-stat.png",
    "工作室与统计页",
    5.2,
    3.6,
    4.1,
    1.45,
  );
}

function slide10TestPlan() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "09 测试");
  addTitle(slide, "测试方案", "黑盒功能 + 异常恢复 + JMeter并发压测");

  const blocks = [
    {
      title: "核心功能测试",
      points: ["权限拦截", "视频上传", "状态机运行", "游标分页查询"],
      x: 0.7,
      color: COLORS.accent,
    },
    {
      title: "异常恢复测试",
      points: ["损坏视频触发FAILED", "长时间RUNNING任务纠错", "前端状态解除锁定"],
      x: 3.55,
      color: COLORS.warm,
    },
    {
      title: "并发性能测试",
      points: [
        "接口：GET /api/videos?limit=12&type=LONG",
        "并发：50 / 100 / 200",
        "指标：吞吐量、RT、P99、错误率",
      ],
      x: 6.4,
      color: "0EA5E9",
    },
  ];

  blocks.forEach((b) => {
    card(slide, b.x, 1.95, 2.85, 3.05, false);
    slide.addShape(pptx.ShapeType.rect, {
      x: b.x,
      y: 1.95,
      w: 2.85,
      h: 0.5,
      line: { color: b.color, width: 0 },
      fill: { color: b.color },
    });
    slide.addText(b.title, {
      x: b.x + 0.15,
      y: 2.12,
      w: 2.55,
      h: 0.2,
      fontFace: FONTS.body,
      fontSize: 12,
      bold: true,
      color: COLORS.white,
      align: "center",
      margin: 0,
    });
    b.points.forEach((p, i) => {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: b.x + 0.2,
        y: 2.7 + i * 0.65,
        w: 0.1,
        h: 0.1,
        line: { color: COLORS.accent, width: 0 },
        fill: { color: COLORS.accent },
      });
      slide.addText(p, {
        x: b.x + 0.35,
        y: 2.65 + i * 0.65,
        w: 2.3,
        h: 0.28,
        fontFace: FONTS.body,
        fontSize: 11,
        color: COLORS.text,
        margin: 0,
      });
    });
  });
}

function slide11Results() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "10 结果");
  addTitle(slide, "测试结果与分析", "吞吐量增长明显，但高并发下延迟上升");

  card(slide, 0.68, 1.9, 5.2, 3.0, false);
  slide.addChart(
    pptx.ChartType.bar,
    [
      {
        name: "吞吐量 (req/s)",
        labels: jmeterData.map((r) => `${r.threads}线程`),
        values: jmeterData.map((r) => Number(r.throughput.toFixed(2))),
      },
    ],
    {
      x: 0.95,
      y: 2.2,
      w: 4.7,
      h: 1.2,
      barDir: "col",
      chartColors: [COLORS.accent],
      showLegend: false,
      showValue: true,
      valGridLine: { color: "E2E8F0", size: 0.5 },
      catAxisLabelColor: COLORS.muted,
      valAxisLabelColor: COLORS.muted,
      dataLabelColor: COLORS.text,
    },
  );
  slide.addChart(
    pptx.ChartType.line,
    [
      {
        name: "P99 (ms)",
        labels: jmeterData.map((r) => `${r.threads}线程`),
        values: jmeterData.map((r) => r.p99),
      },
    ],
    {
      x: 0.95,
      y: 3.45,
      w: 4.7,
      h: 1.2,
      lineSize: 2,
      lineSmooth: true,
      chartColors: [COLORS.warm],
      showLegend: false,
      showValue: true,
      valGridLine: { color: "E2E8F0", size: 0.5 },
      catAxisLabelColor: COLORS.muted,
      valAxisLabelColor: COLORS.muted,
      dataLabelColor: COLORS.text,
    },
  );

  card(slide, 6.08, 1.9, 3.2, 3.0, true);
  addBulletRows(
    slide,
    [
      "20MB H.264 MP4 可在约10-20秒完成处理并生成HLS资源。",
      "损坏视频可进入失败分支并准确标记为 FAILED。",
      "并发从50到200时吞吐量上升，P99从883ms升至2733ms。",
    ],
    6.33,
    2.22,
    2.75,
  );
}

function slide12Conclusion() {
  const slide = pptx.addSlide();
  bgDark(slide);
  addTopTag(slide, "11 总结");
  addTitleDark(slide, "总结与展望", "验证中小规模VOD场景下Serverless方案的工程可行性");

  card(slide, 0.7, 2.0, 4.2, 2.65, true);
  slide.addText("已完成", {
    x: 0.95,
    y: 2.25,
    w: 1.2,
    h: 0.24,
    fontFace: FONTS.body,
    fontSize: 14,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  addBulletRows(
    slide,
    [
      "构建上传、转码、播放、互动、统计闭环。",
      "以Step Functions编排Lambda，增强可观测性。",
      "验证了异常恢复与状态一致性机制。",
    ],
    1.0,
    2.58,
    3.5,
  );

  card(slide, 5.1, 2.0, 4.2, 2.65, true);
  slide.addText("后续展望", {
    x: 5.35,
    y: 2.25,
    w: 1.5,
    h: 0.24,
    fontFace: FONTS.body,
    fontSize: 14,
    bold: true,
    color: COLORS.text,
    margin: 0,
  });
  addBulletRows(
    slide,
    [
      "完善多码率自适应与播放策略。",
      "引入内容审核与合规处理链路。",
      "在真实AWS/CDN环境做更完整压测。",
    ],
    5.4,
    2.58,
    3.5,
  );
}

function slide13QA() {
  const slide = pptx.addSlide();
  bgLight(slide);
  addTopTag(slide, "备用");
  addTitle(slide, "答疑准备", "常见问题与回答线索");

  const qa = [
    "为什么选择 Serverless，而不是传统常驻服务架构？",
    "为什么上传使用预签名URL直传，而非后端中转？",
    "Step Functions 与 EventBridge 在链路中如何分工？",
    "LocalStack 仿真与真实 AWS 环境差异有哪些？",
    "如何保证转码失败后的状态一致与可恢复？",
    "并发压力下主要性能瓶颈在哪，后续如何优化？",
  ];

  card(slide, 0.7, 1.9, 8.6, 3.2, false);
  qa.forEach((q, i) => {
    const y = 2.18 + i * 0.47;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.93,
      y: y + 0.06,
      w: 0.42,
      h: 0.27,
      rectRadius: 0.05,
      line: { color: COLORS.accent, width: 0 },
      fill: { color: COLORS.accent },
    });
    slide.addText(`Q${i + 1}`, {
      x: 0.96,
      y: y + 0.145,
      w: 0.36,
      h: 0.12,
      fontFace: FONTS.code,
      fontSize: 8,
      bold: true,
      color: COLORS.white,
      align: "center",
      margin: 0,
    });
    slide.addText(q, {
      x: 1.48,
      y,
      w: 7.65,
      h: 0.38,
      fontFace: FONTS.body,
      fontSize: 13,
      color: COLORS.text,
      margin: 0,
    });
  });
}

slide1Title();
slide2Background();
slide3Goal();
slide4Architecture();
slide5Modules();
slide6Pipeline();
slide7Recovery();
slide8Database();
slide9Screens();
slide10TestPlan();
slide11Results();
slide12Conclusion();
slide13QA();

await pptx.writeFile({ fileName: outputPath });
console.log(`Generated: ${outputPath}`);
console.log(`Screenshot assets dir: ${shotsDir}`);
