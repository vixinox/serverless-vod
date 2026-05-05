import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const pptxPath = path.join(outDir, "基于AWS Serverless的视频点播平台答辩PPT.pptx");
const notesPath = path.join(outDir, "答辩PPT讲稿.md");

const pptx = new pptxgen();
pptx.author = "serverless-vod";
pptx.company = "北京理工大学珠海学院";
pptx.subject = "本科毕业设计答辩";
pptx.title = "基于 AWS Serverless 的视频点播平台的设计与实现";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};
pptx.defineLayout({ name: "DEFENSE_WIDE", width: 10, height: 5.625 });
pptx.layout = "DEFENSE_WIDE";
pptx.margin = 0;
pptx.slideWidth = 10;
pptx.slideHeight = 5.625;

const C = {
  navy: "24476F",
  blue: "2F66A0",
  lightBlue: "E8F1FA",
  midBlue: "BFD4EA",
  slate: "4A5568",
  text: "2B2F38",
  muted: "687385",
  pale: "F6F8FB",
  line: "D7E0EA",
  white: "FFFFFF",
  green: "2F8F70",
  amber: "B7791F",
  red: "C2413A",
};

const W = 10;
const H = 5.625;
const font = "Microsoft YaHei";
const song = "SimSun";

function addBg(slide, opts = {}) {
  slide.background = { color: opts.dark ? C.navy : C.white };
  if (!opts.dark) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: C.white },
      line: { color: C.white, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.16,
      h: H,
      fill: { color: C.navy },
      line: { color: C.navy, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.16,
      y: 0,
      w: 0.08,
      h: H,
      fill: { color: C.midBlue },
      line: { color: C.midBlue, transparency: 100 },
    });
  }
}

function addTitle(slide, title, section = "") {
  slide.addText(title, {
    x: 0.56,
    y: 0.32,
    w: 6.5,
    h: 0.38,
    fontFace: font,
    fontSize: 20,
    bold: true,
    color: C.navy,
    margin: 0,
    fit: "shrink",
  });
  if (section) {
    slide.addText(section, {
      x: 7.25,
      y: 0.36,
      w: 2.1,
      h: 0.25,
      fontFace: font,
      fontSize: 8.5,
      color: C.muted,
      align: "right",
      margin: 0,
      fit: "shrink",
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.56,
    y: 0.86,
    w: 8.86,
    h: 0,
    line: { color: C.line, width: 1 },
  });
}

function addFooter(slide, idx) {
  slide.addText(String(idx).padStart(2, "0"), {
    x: 9.18,
    y: 5.16,
    w: 0.36,
    h: 0.18,
    fontFace: font,
    fontSize: 7.5,
    color: C.muted,
    align: "right",
    margin: 0,
  });
}

function addChip(slide, text, x, y, w, color = C.blue) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.06,
    fill: { color: C.lightBlue },
    line: { color: color, transparency: 35 },
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: 0.12,
    fontFace: font,
    fontSize: 8,
    bold: true,
    color,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addCard(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: opts.fill || C.white },
    line: { color: opts.line || C.line, width: opts.lineWidth || 1 },
    shadow: opts.shadow
      ? { type: "outer", color: "000000", blur: 1.2, offset: 0.8, angle: 45, opacity: 0.12 }
      : undefined,
  });
}

function addBullets(slide, items, x, y, w, h, opts = {}) {
  slide.addText(
    items.map((item, i) => ({
      text: item,
      options: { bullet: { indent: 10 }, breakLine: i !== items.length - 1 },
    })),
    {
      x,
      y,
      w,
      h,
      fontFace: font,
      fontSize: opts.fontSize || 11.5,
      color: opts.color || C.text,
      breakLine: false,
      paraSpaceAfterPt: opts.paraSpaceAfterPt || 8,
      fit: "shrink",
      valign: "top",
      margin: 0.03,
    }
  );
}

function addIconCircle(slide, label, x, y, color = C.blue, size = 0.42) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color },
    line: { color, transparency: 100 },
  });
  slide.addText(label, {
    x,
    y: y + 0.08,
    w: size,
    h: 0.16,
    fontFace: font,
    fontSize: 8.5,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addArrow(slide, x1, y1, x2, y2, color = C.blue, width = 1.3) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width, beginArrowType: "none", endArrowType: "triangle" },
  });
}

function addNotes(slide, note) {
  if (typeof slide.addNotes === "function") {
    slide.addNotes(note);
  }
}

const talk = [];
function registerTalk(no, title, note) {
  talk.push({ no, title, note });
}

function addMiniBarChart(slide, x, y, w, h) {
  const data = [
    { label: "50", qps: 112.45, rt: 410.55 },
    { label: "100", qps: 119.71, rt: 770.28 },
    { label: "200", qps: 146.89, rt: 1257.34 },
  ];
  const maxQps = 160;
  const maxRt = 1400;
  slide.addText("吞吐量 QPS", {
    x,
    y,
    w: 1.2,
    h: 0.18,
    fontFace: font,
    fontSize: 8,
    bold: true,
    color: C.blue,
    margin: 0,
  });
  slide.addText("平均响应 ms", {
    x: x + 2.15,
    y,
    w: 1.4,
    h: 0.18,
    fontFace: font,
    fontSize: 8,
    bold: true,
    color: C.amber,
    margin: 0,
  });
  for (const [i, d] of data.entries()) {
    const rowY = y + 0.36 + i * 0.52;
    slide.addText(`${d.label} 并发`, {
      x,
      y: rowY + 0.08,
      w: 0.65,
      h: 0.15,
      fontFace: font,
      fontSize: 8,
      color: C.text,
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.78,
      y: rowY,
      w: (1.08 * d.qps) / maxQps,
      h: 0.18,
      fill: { color: C.blue },
      line: { color: C.blue, transparency: 100 },
    });
    slide.addText(d.qps.toFixed(2), {
      x: x + 1.94,
      y: rowY - 0.01,
      w: 0.46,
      h: 0.12,
      fontFace: font,
      fontSize: 7,
      color: C.blue,
      margin: 0,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 2.82,
      y: rowY,
      w: (1.08 * d.rt) / maxRt,
      h: 0.18,
      fill: { color: "D69E2E" },
      line: { color: "D69E2E", transparency: 100 },
    });
    slide.addText(d.rt.toFixed(0), {
      x: x + 3.98,
      y: rowY - 0.01,
      w: 0.34,
      h: 0.12,
      fontFace: font,
      fontSize: 7,
      color: C.amber,
      margin: 0,
    });
  }
  slide.addText("错误率：0%（三轮并发测试）", {
    x,
    y: y + h - 0.25,
    w,
    h: 0.18,
    fontFace: font,
    fontSize: 8.5,
    bold: true,
    color: C.green,
    margin: 0,
  });
}

function addMockBrowser(slide, x, y, w, h, title, kind = "player") {
  addCard(slide, x, y, w, h, { fill: C.white, shadow: true });
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w,
    h: 0.36,
    fill: { color: C.pale },
    line: { color: C.line },
  });
  for (let i = 0; i < 3; i++) {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.18 + i * 0.18,
      y: y + 0.13,
      w: 0.07,
      h: 0.07,
      fill: { color: ["E05656", "D69E2E", "38A169"][i] },
      line: { color: "FFFFFF", transparency: 100 },
    });
  }
  slide.addText(title, {
    x: x + 0.72,
    y: y + 0.12,
    w: w - 0.88,
    h: 0.1,
    fontFace: font,
    fontSize: 6.5,
    color: C.muted,
    margin: 0,
    fit: "shrink",
  });
  if (kind === "player") {
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.28,
      y: y + 0.55,
      w: w - 0.56,
      h: h * 0.44,
      fill: { color: C.navy },
      line: { color: C.navy, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.triangle, {
      x: x + w * 0.48,
      y: y + 0.95,
      w: 0.3,
      h: 0.28,
      rotate: 90,
      fill: { color: C.white, transparency: 5 },
      line: { color: C.white, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.38,
      y: y + h - 0.58,
      w: 1.35,
      h: 0.12,
      fill: { color: C.blue },
      line: { color: C.blue, transparency: 100 },
    });
    ["点赞", "评论", "收藏"].forEach((t, i) => addChip(slide, t, x + 0.34 + i * 0.95, y + h - 0.34, 0.72));
  } else {
    for (let i = 0; i < 3; i++) {
      slide.addShape(pptx.ShapeType.rect, {
        x: x + 0.32,
        y: y + 0.62 + i * 0.46,
        w: w - 0.64,
        h: 0.28,
        fill: { color: i === 1 ? C.lightBlue : C.pale },
        line: { color: C.line },
      });
      slide.addText(["READY", "PROCESSING", "FAILED"][i], {
        x: x + w - 1.26,
        y: y + 0.7 + i * 0.46,
        w: 0.72,
        h: 0.1,
        fontFace: font,
        fontSize: 6.5,
        color: [C.green, C.blue, C.red][i],
        bold: true,
        margin: 0,
        fit: "shrink",
      });
    }
    slide.addShape(pptx.ShapeType.line, {
      x: x + 0.38,
      y: y + h - 0.52,
      w: w - 0.76,
      h: -0.34,
      line: { color: C.blue, width: 1.4 },
    });
    slide.addText("30 天观看趋势", {
      x: x + 0.34,
      y: y + h - 0.31,
      w: 1.1,
      h: 0.1,
      fontFace: font,
      fontSize: 6.5,
      color: C.muted,
      margin: 0,
    });
  }
}

// Slide 1
{
  const slide = pptx.addSlide();
  slide.background = { color: C.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 3.15,
    h: H,
    fill: { color: C.navy },
    line: { color: C.navy, transparency: 100 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.15,
    y: 0,
    w: 0.14,
    h: H,
    fill: { color: C.midBlue },
    line: { color: C.midBlue, transparency: 100 },
  });
  slide.addText("VOD", {
    x: 0.58,
    y: 0.78,
    w: 1.4,
    h: 0.4,
    fontFace: font,
    fontSize: 26,
    bold: true,
    color: C.white,
    margin: 0,
  });
  slide.addText("Serverless Architecture", {
    x: 0.6,
    y: 1.22,
    w: 1.9,
    h: 0.22,
    fontFace: font,
    fontSize: 10,
    color: "D7E7F8",
    margin: 0,
  });
  const nodes = [
    ["S3", 0.72, 2.15],
    ["Lambda", 1.72, 1.88],
    ["SFN", 2.28, 2.72],
    ["HLS", 1.2, 3.22],
  ];
  nodes.forEach(([t, x, y]) => addIconCircle(slide, t, x, y, C.blue, 0.52));
  addArrow(slide, 1.2, 2.42, 1.74, 2.13, "BFD4EA", 1.1);
  addArrow(slide, 2.0, 2.32, 2.28, 2.72, "BFD4EA", 1.1);
  addArrow(slide, 2.16, 3.02, 1.72, 3.28, "BFD4EA", 1.1);
  slide.addText("基于 AWS Serverless 的\\n视频点播平台的设计与实现", {
    x: 3.72,
    y: 1.15,
    w: 5.65,
    h: 1.1,
    fontFace: font,
    fontSize: 25,
    bold: true,
    color: C.navy,
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
  slide.addText("本科毕业设计答辩", {
    x: 3.74,
    y: 2.55,
    w: 2.2,
    h: 0.24,
    fontFace: font,
    fontSize: 13,
    bold: true,
    color: C.blue,
    margin: 0,
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 3.74,
    y: 3.05,
    w: 4.95,
    h: 0,
    line: { color: C.line, width: 1 },
  });
  slide.addText("Next.js 16 / React 19 / PostgreSQL / Prisma / Better Auth\\nS3 / Lambda / Step Functions / EventBridge / FFmpeg / HLS", {
    x: 3.74,
    y: 3.35,
    w: 5.3,
    h: 0.55,
    fontFace: font,
    fontSize: 10,
    color: C.slate,
    margin: 0,
    fit: "shrink",
    breakLine: false,
  });
  slide.addText("2026年4月25日", {
    x: 3.74,
    y: 4.72,
    w: 2.2,
    h: 0.2,
    fontFace: song,
    fontSize: 10,
    color: C.muted,
    margin: 0,
  });
  addNotes(slide, "各位老师好，我的毕业设计题目是基于 AWS Serverless 的视频点播平台的设计与实现。接下来我会从研究背景、系统设计、核心实现、测试结果和总结展望五个方面进行汇报。");
  registerTalk(1, "封面", "各位老师好，我的毕业设计题目是基于 AWS Serverless 的视频点播平台的设计与实现。接下来我会从研究背景、系统设计、核心实现、测试结果和总结展望五个方面进行汇报。");
}

// Slide 2
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "研究背景与问题", "背景");
  const x0 = 0.72;
  const y0 = 1.28;
  ["上传", "转码", "存储", "分发", "播放"].forEach((t, i) => {
    const x = x0 + i * 1.03;
    addCard(slide, x, y0, 0.8, 0.48, { fill: C.pale });
    slide.addText(t, {
      x,
      y: y0 + 0.16,
      w: 0.8,
      h: 0.1,
      fontFace: font,
      fontSize: 9,
      bold: true,
      color: C.navy,
      align: "center",
      margin: 0,
    });
    if (i < 4) addArrow(slide, x + 0.84, y0 + 0.24, x + 1.0, y0 + 0.24, C.muted, 1);
  });
  slide.addText("视频点播链路天然复杂", {
    x: 0.72,
    y: 0.98,
    w: 2.4,
    h: 0.24,
    fontFace: font,
    fontSize: 15,
    bold: true,
    color: C.navy,
    margin: 0,
  });
  addCard(slide, 0.72, 2.15, 3.72, 2.28, { fill: C.white, shadow: true });
  slide.addText("传统架构痛点", {
    x: 0.98,
    y: 2.42,
    w: 1.35,
    h: 0.2,
    fontFace: font,
    fontSize: 13,
    bold: true,
    color: C.red,
    margin: 0,
  });
  addBullets(slide, ["常驻转码服务运维复杂", "高峰期资源不足，低峰期资源闲置", "存储、队列、调度等组件耦合度高"], 0.98, 2.9, 3.0, 1.1);
  addCard(slide, 5.08, 2.15, 3.72, 2.28, { fill: C.lightBlue, shadow: true });
  slide.addText("Serverless 切入点", {
    x: 5.34,
    y: 2.42,
    w: 1.6,
    h: 0.2,
    fontFace: font,
    fontSize: 13,
    bold: true,
    color: C.blue,
    margin: 0,
  });
  addBullets(slide, ["对象存储承接大文件", "函数计算按事件触发运行", "工作流编排异步处理与失败回写"], 5.34, 2.9, 3.0, 1.1);
  addArrow(slide, 4.55, 3.28, 4.95, 3.28, C.blue, 2);
  addFooter(slide, 2);
  const note = "在线视频业务的难点不只是页面播放，还包括上传、转码、存储、分发和播放这一整条链路。传统方案通常需要维护常驻转码服务和多种中间件，成本和复杂度都比较高。Serverless 的价值在于把大文件、异步任务和状态回写拆开处理，更适合中小规模视频平台。";
  addNotes(slide, note);
  registerTalk(2, "研究背景与问题", note);
}

// Slide 3
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "研究目标与主要内容", "目标");
  addCard(slide, 0.72, 1.15, 8.56, 0.78, { fill: C.lightBlue });
  slide.addText("设计并实现一套完整的视频点播平台，并验证 AWS Serverless 架构在中小规模 VOD 场景中的可行性。", {
    x: 1.0,
    y: 1.38,
    w: 7.95,
    h: 0.24,
    fontFace: font,
    fontSize: 12.5,
    bold: true,
    color: C.navy,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  const modules = [
    ["浏览搜索", "公开内容发现"],
    ["上传处理", "直传与异步转码"],
    ["在线播放", "HLS 流媒体播放"],
    ["互动组织", "评论/收藏/列表"],
    ["工作室", "发布与内容管理"],
    ["统计分析", "播放行为汇总"],
  ];
  modules.forEach(([title, desc], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.82 + col * 2.82;
    const y = 2.35 + row * 1.12;
    addCard(slide, x, y, 2.28, 0.78, { fill: C.white, shadow: true });
    addIconCircle(slide, String(i + 1), x + 0.16, y + 0.18, C.blue, 0.38);
    slide.addText(title, {
      x: x + 0.68,
      y: y + 0.18,
      w: 1.18,
      h: 0.16,
      fontFace: font,
      fontSize: 11.5,
      bold: true,
      color: C.navy,
      margin: 0,
    });
    slide.addText(desc, {
      x: x + 0.68,
      y: y + 0.45,
      w: 1.38,
      h: 0.12,
      fontFace: font,
      fontSize: 7.8,
      color: C.muted,
      margin: 0,
      fit: "shrink",
    });
  });
  addFooter(slide, 3);
  const note = "本课题的目标不是只做一个播放器，而是实现从内容生产到内容消费的完整闭环。平台覆盖浏览搜索、上传处理、在线播放、互动组织、创作者工作室和统计分析六类能力。通过这些功能，可以验证 Serverless 在视频上传和异步转码场景中的工程可行性。";
  addNotes(slide, note);
  registerTalk(3, "研究目标与主要内容", note);
}

// Slide 4
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "系统技术路线", "技术栈");
  const layers = [
    ["表现层", "Next.js 16 / React 19", C.lightBlue],
    ["业务层", "REST API / Better Auth / 服务端鉴权", "EDF4FB"],
    ["数据层", "PostgreSQL / Prisma / 统计汇总表", "F4F7FB"],
    ["基础设施层", "S3 / Lambda / Step Functions / EventBridge", "E7EEF7"],
    ["媒体处理", "FFmpeg / HLS / 封面抽取 / 状态回写", "F8FAFC"],
  ];
  layers.forEach(([name, tech, fill], i) => {
    const y = 1.14 + i * 0.72;
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.0,
      y,
      w: 7.95 - i * 0.22,
      h: 0.48,
      fill: { color: fill },
      line: { color: C.line },
    });
    slide.addText(name, {
      x: 1.24,
      y: y + 0.15,
      w: 1.0,
      h: 0.1,
      fontFace: font,
      fontSize: 9,
      bold: true,
      color: C.navy,
      margin: 0,
    });
    slide.addText(tech, {
      x: 2.38,
      y: y + 0.15,
      w: 5.5,
      h: 0.1,
      fontFace: font,
      fontSize: 9,
      color: C.text,
      margin: 0,
      fit: "shrink",
    });
  });
  addChip(slide, "类型安全", 1.02, 4.95, 0.86);
  addChip(slide, "事件驱动", 2.06, 4.95, 0.86);
  addChip(slide, "异步解耦", 3.1, 4.95, 0.86);
  addChip(slide, "本地仿真", 4.14, 4.95, 0.86);
  addChip(slide, "可观测状态", 5.18, 4.95, 1.0);
  addFooter(slide, 4);
  const note = "技术路线分为五层：前端由 Next.js 和 React 负责页面与交互，业务层通过 API 和 Better Auth 做权限控制，数据层使用 PostgreSQL 和 Prisma 管理结构化数据。媒体处理部分则由 S3、Lambda、Step Functions 和 EventBridge 组成，并用 FFmpeg 生成 HLS 播放资源。";
  addNotes(slide, note);
  registerTalk(4, "系统技术路线", note);
}

// Slide 5
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "总体架构设计", "架构");
  addCard(slide, 0.72, 1.25, 2.15, 2.9, { fill: C.pale, shadow: true });
  addCard(slide, 3.68, 1.25, 2.25, 2.9, { fill: C.white, shadow: true });
  addCard(slide, 6.75, 1.25, 2.35, 2.9, { fill: C.lightBlue, shadow: true });
  slide.addText("用户端", { x: 1.34, y: 1.52, w: 0.9, h: 0.18, fontFace: font, fontSize: 13, bold: true, color: C.navy, margin: 0 });
  slide.addText("Next.js Web 服务", { x: 4.08, y: 1.52, w: 1.55, h: 0.18, fontFace: font, fontSize: 13, bold: true, color: C.navy, margin: 0 });
  slide.addText("AWS Serverless", { x: 7.08, y: 1.52, w: 1.58, h: 0.18, fontFace: font, fontSize: 13, bold: true, color: C.navy, margin: 0 });
  addChip(slide, "浏览/搜索", 1.06, 2.08, 0.88);
  addChip(slide, "上传/播放", 1.06, 2.58, 0.88);
  addChip(slide, "互动/管理", 1.06, 3.08, 0.88);
  addChip(slide, "REST API", 4.04, 2.0, 0.9);
  addChip(slide, "鉴权", 4.04, 2.5, 0.9);
  addChip(slide, "数据库读写", 4.04, 3.0, 1.04);
  addChip(slide, "S3", 7.18, 1.98, 0.62);
  addChip(slide, "Step Functions", 7.18, 2.46, 1.18);
  addChip(slide, "Lambda", 7.18, 2.94, 0.82);
  addChip(slide, "EventBridge", 7.18, 3.42, 1.02);
  addArrow(slide, 2.88, 2.52, 3.62, 2.52, C.blue, 1.4);
  addArrow(slide, 5.94, 2.52, 6.68, 2.52, C.blue, 1.4);
  addCard(slide, 3.9, 4.48, 1.78, 0.38, { fill: C.white });
  slide.addText("PostgreSQL + Prisma", {
    x: 4.06,
    y: 4.61,
    w: 1.46,
    h: 0.09,
    fontFace: font,
    fontSize: 7.8,
    bold: true,
    color: C.navy,
    margin: 0,
    fit: "shrink",
  });
  addArrow(slide, 4.8, 4.1, 4.8, 4.45, C.muted, 1);
  slide.addText("同步业务：API + 数据库\\n异步媒体：对象存储 + 状态机 + 函数", {
    x: 0.96,
    y: 4.62,
    w: 2.35,
    h: 0.38,
    fontFace: font,
    fontSize: 9.5,
    color: C.slate,
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 5);
  const note = "系统总体上分为三部分：用户端、Next.js Web 服务和 AWS Serverless 媒体处理服务。评论、查询、统计等同步业务通过 REST API 访问数据库；视频上传后的转码、切片和封面抽取则交给对象存储、状态机和 Lambda 异步完成，最后再把状态写回数据库。";
  addNotes(slide, note);
  registerTalk(5, "总体架构设计", note);
}

// Slide 6
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "需求与角色划分", "需求");
  const roles = [
    ["游客", "浏览 / 搜索 / 播放公开内容", 1.0, 3.42, 1.3, C.midBlue],
    ["注册用户", "评论 / 点赞 / 订阅 / 收藏 / 播放列表", 3.44, 2.62, 1.86, C.blue],
    ["创作者", "上传 / 管理 / 发布 / 统计分析", 6.38, 1.78, 1.94, C.navy],
  ];
  roles.forEach(([name, desc, x, y, w, color], i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h: 4.35 - y,
      fill: { color, transparency: i === 0 ? 8 : 0 },
      line: { color, transparency: 100 },
    });
    slide.addText(name, {
      x,
      y: y - 0.42,
      w,
      h: 0.22,
      fontFace: font,
      fontSize: 16,
      bold: true,
      color: i === 0 ? C.navy : color,
      align: "center",
      margin: 0,
    });
    slide.addText(desc, {
      x: x - 0.18,
      y: 4.58,
      w: w + 0.36,
      h: 0.28,
      fontFace: font,
      fontSize: 8.2,
      color: C.slate,
      align: "center",
      margin: 0,
      fit: "shrink",
      breakLine: false,
    });
  });
  slide.addText("权限递进，避免过度复杂的权限体系", {
    x: 2.1,
    y: 1.08,
    w: 5.7,
    h: 0.24,
    fontFace: font,
    fontSize: 14,
    bold: true,
    color: C.navy,
    align: "center",
    margin: 0,
  });
  addArrow(slide, 2.48, 3.84, 3.26, 3.18, C.blue, 1.4);
  addArrow(slide, 5.46, 2.98, 6.22, 2.4, C.blue, 1.4);
  addFooter(slide, 6);
  const note = "需求设计上，我把用户划分为游客、注册用户和创作者三个层次。游客主要完成公开内容浏览，注册用户增加评论、点赞、订阅和收藏等互动能力，创作者进一步拥有上传、管理、发布和统计权限。这样既覆盖视频平台的基本业务，也避免引入过于复杂的权限模型。";
  addNotes(slide, note);
  registerTalk(6, "需求与角色划分", note);
}

// Slide 7
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "数据库与模块设计", "数据");
  const entities = [
    ["User", 0.88, 1.34],
    ["Channel", 2.4, 1.34],
    ["Video", 4.05, 1.34],
    ["Comment", 5.86, 1.34],
    ["Playlist", 7.62, 1.34],
    ["UploadSession", 2.25, 3.04],
    ["TranscodeJob", 4.05, 3.04],
    ["VideoAsset", 5.9, 3.04],
    ["DailyStat", 7.62, 3.04],
  ];
  entities.forEach(([name, x, y]) => {
    addCard(slide, x, y, 1.2, 0.44, { fill: name === "Video" ? C.lightBlue : C.white, shadow: true });
    slide.addText(name, {
      x,
      y: y + 0.15,
      w: 1.2,
      h: 0.1,
      fontFace: font,
      fontSize: 8,
      bold: true,
      color: C.navy,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  });
  const lines = [
    [2.08, 1.56, 2.38, 1.56],
    [3.62, 1.56, 4.02, 1.56],
    [5.25, 1.56, 5.84, 1.56],
    [5.25, 1.56, 7.6, 1.56],
    [3.0, 3.26, 4.02, 3.26],
    [5.25, 3.26, 5.88, 3.26],
    [5.25, 3.26, 7.6, 3.26],
    [4.65, 1.78, 4.65, 3.0],
  ];
  lines.forEach(([x1, y1, x2, y2]) => addArrow(slide, x1, y1, x2, y2, C.muted, 0.8));
  addCard(slide, 1.08, 4.2, 7.6, 0.56, { fill: C.pale });
  slide.addText("内容数据 + 互动数据 + 上传任务 + 转码任务 + 播放统计 = 平台业务闭环", {
    x: 1.28,
    y: 4.39,
    w: 7.2,
    h: 0.14,
    fontFace: font,
    fontSize: 11,
    bold: true,
    color: C.navy,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 7);
  const note = "数据库设计围绕视频平台的业务闭环展开。用户创建频道，频道发布视频，视频产生评论、播放列表和播放行为；上传会话、转码任务和视频资源表记录媒体处理过程；日级统计表承接播放器和互动数据，供工作室分析页面读取。答辩中重点说明这个闭环即可，不需要展开每个字段。";
  addNotes(slide, note);
  registerTalk(7, "数据库与模块设计", note);
}

// Slide 8
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "视频上传与媒体处理流程", "核心实现");
  const steps = [
    ["1", "创建草稿", "生成 shortCode"],
    ["2", "预签名 URL", "直传 S3"],
    ["3", "创建转码任务", "TranscodeJob"],
    ["4", "状态机编排", "Step Functions"],
    ["5", "Lambda 处理", "FFmpeg/HLS/封面"],
    ["6", "结果回写", "READY 或 FAILED"],
  ];
  steps.forEach(([num, title, desc], i) => {
    const x = 0.56 + i * 1.54;
    addCard(slide, x, 2.05, 1.16, 0.9, { fill: i === 1 || i === 3 ? C.lightBlue : C.white, shadow: true });
    addIconCircle(slide, num, x + 0.37, 1.48, i === 3 ? C.navy : C.blue, 0.42);
    slide.addText(title, {
      x: x + 0.08,
      y: 2.27,
      w: 1.0,
      h: 0.14,
      fontFace: font,
      fontSize: 9.5,
      bold: true,
      color: C.navy,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(desc, {
      x: x + 0.08,
      y: 2.55,
      w: 1.0,
      h: 0.22,
      fontFace: font,
      fontSize: 6.8,
      color: C.muted,
      align: "center",
      margin: 0,
      fit: "shrink",
      breakLine: false,
    });
    if (i < steps.length - 1) addArrow(slide, x + 1.18, 2.5, x + 1.47, 2.5, C.blue, 1.1);
  });
  addCard(slide, 0.9, 3.72, 3.58, 0.62, { fill: C.pale });
  addCard(slide, 5.16, 3.72, 3.58, 0.62, { fill: C.pale });
  slide.addText("核心亮点：大文件不经过 Next.js 服务端", {
    x: 1.18,
    y: 3.93,
    w: 3.0,
    h: 0.13,
    fontFace: font,
    fontSize: 9.2,
    bold: true,
    color: C.blue,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  slide.addText("可恢复：阶段状态、失败分支、重试与回写", {
    x: 5.44,
    y: 3.93,
    w: 3.0,
    h: 0.13,
    fontFace: font,
    fontSize: 9.2,
    bold: true,
    color: C.green,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 8);
  const note = "媒体处理是本系统最核心的实现。前端先创建草稿并获取预签名 URL，视频文件直接上传到 vod-raw 桶，不经过 Next.js 服务端。上传完成后服务端创建转码任务，并启动 Step Functions，编排 Lambda 执行元数据提取、转码、HLS 切片、封面抽取和结果回写。失败时进入失败分支，状态统一写回数据库。";
  addNotes(slide, note);
  registerTalk(8, "视频上传与媒体处理流程", note);
}

// Slide 9
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "核心实现：播放与互动", "核心实现");
  addMockBrowser(slide, 0.78, 1.24, 4.1, 3.25, "watch/[shortCode] - HLS 播放页", "player");
  addCard(slide, 5.25, 1.18, 3.6, 0.74, { fill: C.lightBlue });
  slide.addText("播放链路", { x: 5.52, y: 1.42, w: 0.9, h: 0.14, fontFace: font, fontSize: 12, bold: true, color: C.navy, margin: 0 });
  slide.addText("master.m3u8 -> HLS 分片 -> 浏览器播放器", { x: 6.56, y: 1.43, w: 1.95, h: 0.12, fontFace: font, fontSize: 8, color: C.slate, margin: 0, fit: "shrink" });
  addCard(slide, 5.25, 2.16, 3.6, 0.86, { fill: C.white, shadow: true });
  addBullets(slide, ["开发环境可通过 /api/hls 代理对象存储", "生产环境可切换到 CloudFront CDN"], 5.56, 2.35, 2.84, 0.38, { fontSize: 8.8, paraSpaceAfterPt: 3 });
  addCard(slide, 5.25, 3.25, 3.6, 0.86, { fill: C.white, shadow: true });
  addBullets(slide, ["点赞、评论、订阅、收藏、稍后再看", "播放事件写入 VideoPlaybackEvent"], 5.56, 3.44, 2.84, 0.38, { fontSize: 8.8, paraSpaceAfterPt: 3 });
  addFooter(slide, 9);
  const note = "播放页会读取 HLS 主清单地址，并交给播放器加载。开发环境下可以通过本地代理模拟对象存储访问，生产环境可以接入 CDN。互动部分包括点赞、评论、订阅、收藏和播放列表等操作。播放器还会上报播放开始、暂停、进度和结束等事件，写入播放事件表，为后续统计分析提供原始数据。";
  addNotes(slide, note);
  registerTalk(9, "核心实现：播放与互动", note);
}

// Slide 10
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "创作者工作室与统计分析", "核心实现");
  addMockBrowser(slide, 0.78, 1.16, 3.86, 3.4, "studio/contents - 内容管理", "studio");
  addMockBrowser(slide, 5.28, 1.16, 3.86, 3.4, "studio/stat - 数据分析", "studio");
  addCard(slide, 1.08, 4.77, 7.72, 0.36, { fill: C.pale });
  slide.addText("工作室管理处理状态与内容发布；统计页面读取日级汇总表，避免直接扫描原始播放日志。", {
    x: 1.28,
    y: 4.89,
    w: 7.32,
    h: 0.09,
    fontFace: font,
    fontSize: 8.4,
    bold: true,
    color: C.navy,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 10);
  const note = "创作者工作室负责上传后的管理流程，包括视频列表、处理状态、公开范围修改、失败重试、取消任务和软删除。统计分析模块把播放事件和互动行为汇总成日级统计表，再展示观看次数、观看时长、订阅变化和视频排行榜。这样图表页不需要直接查询大量原始日志，查询压力更可控。";
  addNotes(slide, note);
  registerTalk(10, "创作者工作室与统计分析", note);
}

// Slide 11
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "系统测试与结果", "测试");
  addCard(slide, 0.72, 1.15, 3.6, 1.48, { fill: C.white, shadow: true });
  slide.addText("核心功能测试", { x: 1.0, y: 1.42, w: 1.2, h: 0.16, fontFace: font, fontSize: 12, bold: true, color: C.navy, margin: 0 });
  addBullets(slide, ["权限拦截返回 401", "非法文件上传被 S3 拒绝", "20MB MP4 处理后状态 READY", "游标分页无重复遗漏"], 1.0, 1.78, 2.8, 0.62, { fontSize: 8.7, paraSpaceAfterPt: 3 });
  addCard(slide, 0.72, 2.9, 3.6, 1.18, { fill: C.lightBlue, shadow: true });
  slide.addText("异常恢复测试", { x: 1.0, y: 3.18, w: 1.2, h: 0.16, fontFace: font, fontSize: 12, bold: true, color: C.navy, margin: 0 });
  addBullets(slide, ["损坏 MP4 进入失败分支", "超时 RUNNING 任务可纠错为 FAILED"], 1.0, 3.54, 2.86, 0.38, { fontSize: 8.7, paraSpaceAfterPt: 3 });
  addCard(slide, 4.78, 1.15, 4.28, 2.92, { fill: C.white, shadow: true });
  slide.addText("JMeter 压测：/api/videos?limit=12&type=LONG", {
    x: 5.08,
    y: 1.42,
    w: 3.68,
    h: 0.13,
    fontFace: font,
    fontSize: 8.4,
    bold: true,
    color: C.navy,
    margin: 0,
    fit: "shrink",
  });
  addMiniBarChart(slide, 5.08, 1.82, 3.62, 1.82);
  addCard(slide, 4.78, 4.42, 4.28, 0.52, { fill: C.pale });
  slide.addText("200 并发：8791 请求 / 146.89 QPS / 平均 1257.34ms / P99 2733ms / 错误率 0%", {
    x: 5.0,
    y: 4.61,
    w: 3.84,
    h: 0.11,
    fontFace: font,
    fontSize: 7.2,
    bold: true,
    color: C.green,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 11);
  const note = "测试分为功能测试、异常恢复测试和性能测试。功能测试覆盖权限、非法上传、视频处理和分页查询；异常测试验证损坏视频和超时任务可以进入失败或纠错流程。JMeter 对首页视频列表接口做 50、100、200 并发测试，错误率均为 0，说明当前实验环境下系统具备一定稳定性。";
  addNotes(slide, note);
  registerTalk(11, "系统测试与结果", note);
}

// Slide 12
{
  const slide = pptx.addSlide();
  addBg(slide);
  addTitle(slide, "总结与展望", "结论");
  const cols = [
    ["完成情况", ["上传处理", "在线播放", "互动管理", "统计分析"], C.blue],
    ["架构价值", ["降低运维压力", "异步任务解耦", "处理链路可观测", "失败状态可恢复"], C.green],
    ["后续展望", ["自适应码率策略", "内容审核机制", "真实云部署测试", "更完善监控告警"], C.amber],
  ];
  cols.forEach(([title, items, color], i) => {
    const x = 0.8 + i * 2.92;
    addCard(slide, x, 1.36, 2.38, 2.46, { fill: i === 1 ? C.lightBlue : C.white, shadow: true });
    addIconCircle(slide, String(i + 1), x + 0.18, 1.62, color, 0.42);
    slide.addText(title, {
      x: x + 0.74,
      y: 1.74,
      w: 1.1,
      h: 0.13,
      fontFace: font,
      fontSize: 12,
      bold: true,
      color: C.navy,
      margin: 0,
    });
    addBullets(slide, items, x + 0.38, 2.18, 1.7, 0.96, { fontSize: 8.8, paraSpaceAfterPt: 4 });
  });
  slide.addText("谢谢，请各位老师批评指正", {
    x: 2.38,
    y: 4.55,
    w: 5.25,
    h: 0.36,
    fontFace: font,
    fontSize: 20,
    bold: true,
    color: C.navy,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addFooter(slide, 12);
  const note = "最后做一个总结。本文完成了视频上传、媒体处理、播放、互动、管理和统计等主要功能，并验证了 Serverless 架构在中小规模视频点播场景中的可行性。它的优势是降低基础设施维护压力，并让异步处理链路更加清晰。后续如果面向生产环境，还需要继续完善自适应码率、内容审核和真实云环境测试。谢谢各位老师。";
  addNotes(slide, note);
  registerTalk(12, "总结与展望", note);
}

const notesMd = `# 答辩 PPT 讲稿

题目：基于 AWS Serverless 的视频点播平台的设计与实现

建议总时长：8 分钟左右。第 1 页开场约 15 秒，第 2-3 页约 1 分钟，第 4-7 页约 2 分钟，第 8-10 页约 3 分钟，第 11-12 页约 2 分钟。

${talk
  .map(
    ({ no, title, note }) => `## 第 ${no} 页：${title}

${note}
`
  )
  .join("\n")}
## 追问提示

- 为什么使用 Serverless：视频转码属于波动明显的异步任务，Serverless 可以减少常驻转码服务维护，并把上传、处理、状态回写拆分得更清楚。
- 为什么使用预签名 URL：让客户端直接把大文件上传到对象存储，减少应用服务器带宽压力。
- 为什么使用 Step Functions：媒体处理包含多个阶段，状态机便于编排顺序、配置重试、捕获失败并回写状态。
- LocalStack 的局限：它适合本地验证流程，但真实 AWS 环境中的 IAM、网络、资源限制和计费行为仍需要进一步测试。
`;

fs.writeFileSync(notesPath, notesMd, "utf8");
await pptx.writeFile({ fileName: pptxPath });

console.log(`Wrote ${pptxPath}`);
console.log(`Wrote ${notesPath}`);
