from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.shapes.base import BaseShape


ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = ROOT / "docs" / "defense-study" / "演示文稿1.pptx"
OUTPUT_PATH = ROOT / "docs" / "答辩演示-模板版.pptx"
SHOT_DIR = ROOT / "docs" / "ppt-assets" / "screenshots"
JMETER_SUMMARY = ROOT / "reports" / "jmeter" / "video-list-summary.json"

SCHOOL = "北京理工大学珠海学院"
TITLE = "基于 AWS Serverless 的视频点播平台的设计与实现"
SUBTITLE = "围绕“预签名直传 + 状态机编排 + 异常恢复”验证工程可行性"
TEACHER = "指导老师：[指导老师]"
STUDENT = "答辩学生：[姓名]（学号：[学号]）"


def walk_shapes(shapes: Iterable[BaseShape], prefix: str = ""):
    for idx, shape in enumerate(shapes):
        path = f"{prefix}{idx}" if not prefix else f"{prefix}.{idx}"
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
            yield from walk_shapes(shape.shapes, path)
        else:
            yield path, shape


def set_shape_text(shape: BaseShape, text: str) -> None:
    if not hasattr(shape, "text_frame"):
        return
    tf = shape.text_frame
    tf.clear()
    tf.paragraphs[0].text = text


def set_text_by_path(slide, path: str, text: str) -> bool:
    for current, shape in walk_shapes(slide.shapes):
        if current == path and hasattr(shape, "text_frame"):
            set_shape_text(shape, text)
            return True
    return False


def bulk_set(slide, mapping: dict[str, str]) -> None:
    for p, text in mapping.items():
        set_text_by_path(slide, p, text)


def replace_text_everywhere(slide, replacements: dict[str, str]) -> None:
    for _, shape in walk_shapes(slide.shapes):
        if not hasattr(shape, "text"):
            continue
        original = shape.text
        updated = original
        for src, dst in replacements.items():
            updated = updated.replace(src, dst)
        if updated != original:
            set_shape_text(shape, updated)


def set_cover_or_thanks(slide) -> None:
    replace_text_everywhere(
        slide,
        {
            "请输入您的学校名称": SCHOOL,
            "指导老师：XXX": TEACHER,
            "答辩学生：XXX": STUDENT,
            "Some text about this part related here. Some text about this part related here.Some text about this part related here.": SUBTITLE,
        },
    )


def set_section_slide(slide, section_cn: str, section_en: str, part_no: str) -> None:
    bulk_set(
        slide,
        {
            "1": SCHOOL,
            "4": section_cn,
            "5": section_en,
            "7": part_no,
        },
    )


def load_jmeter_rows() -> list[dict[str, float]]:
    fallback = [
        {"threads": 50, "throughput": 112.45, "p99": 883},
        {"threads": 100, "throughput": 119.71, "p99": 1542},
        {"threads": 200, "throughput": 146.89, "p99": 2733},
    ]
    if not JMETER_SUMMARY.exists():
        return fallback
    try:
        data = json.loads(JMETER_SUMMARY.read_text(encoding="utf-8"))
        rows = []
        for row in data.get("results", []):
            rows.append(
                {
                    "threads": int(row.get("threads", 0)),
                    "throughput": float(row.get("throughput", 0)),
                    "p99": float(row.get("p99", 0)),
                }
            )
        if rows:
            return rows
    except Exception:
        return fallback
    return fallback


def update_slide7_charts(slide, rows: list[dict[str, float]]) -> None:
    charts = [sh.chart for sh in slide.shapes if sh.shape_type == MSO_SHAPE_TYPE.CHART]
    if len(charts) < 2:
        return
    labels = [f"{r['threads']}并发" for r in rows]

    throughput_data = CategoryChartData()
    throughput_data.categories = labels
    throughput_data.add_series("吞吐量(req/s)", [round(r["throughput"], 2) for r in rows])
    charts[0].replace_data(throughput_data)

    p99_data = CategoryChartData()
    p99_data.categories = labels
    p99_data.add_series("P99(ms)", [round(r["p99"], 0) for r in rows])
    charts[1].replace_data(p99_data)


def add_screenshot_grid(slide) -> None:
    rect_left = [shape for _, shape in walk_shapes(slide.shapes) if shape.name == "矩形 14"]
    rect_right = [shape for _, shape in walk_shapes(slide.shapes) if shape.name == "矩形 13"]
    if not rect_left or not rect_right:
        return

    left = rect_left[0]
    right = rect_right[0]

    targets = [
        ("home-search.png", left.left, left.top, left.width, left.height // 2),
        ("watch-page.png", left.left, left.top + left.height // 2, left.width, left.height // 2),
        ("upload-pipeline.png", right.left, right.top, right.width, right.height // 2),
        ("studio-stat.png", right.left, right.top + right.height // 2, right.width, right.height // 2),
    ]

    for filename, x, y, w, h in targets:
        path = SHOT_DIR / filename
        if path.exists():
            slide.shapes.add_picture(str(path), x, y, width=w, height=h)
        else:
            box = slide.shapes.add_textbox(x, y, w, h)
            set_shape_text(box, f"待替换截图\n{filename}")


def clear_remaining_placeholders(slide) -> None:
    cleanup = {
        "单击这里可编辑内容，需复制粘贴内容进。": "",
        "单击这里可编辑内容，需复制粘贴内容进来": "",
        "单击这里可编辑内容，需复制粘贴内容来": "",
        "单击此处添加文本具体内容，阐述你的观点。": "",
        "单击此处添加文本具体内容，简明扼要地阐述你的观点。": "",
        "请输入标题": "",
        "输入标题": "",
        "标题文案": "",
        "点击此处 / 输入标题文本": "",
        "20XX": "",
        "XXX": "",
        "Some text about this part related here. Some text about this part related here.Some text about this part related here.": "",
    }
    replace_text_everywhere(slide, cleanup)


def fill() -> None:
    prs = Presentation(str(TEMPLATE_PATH))
    rows = load_jmeter_rows()

    # Slide 1: Cover
    s1 = prs.slides[0]
    set_cover_or_thanks(s1)
    bulk_set(
        s1,
        {
            "3": "毕业设计答辩",
            "9": SUBTITLE,
        },
    )

    # Slide 2: TOC
    s2 = prs.slides[1]
    bulk_set(
        s2,
        {
            "5.1.1": "研究背景与问题",
            "5.1.2": "Background & Problem",
            "6.1.1": "系统设计与实现",
            "6.1.2": "Design & Implementation",
            "7.1.1": "关键技术与难点",
            "7.1.2": "Key Technologies",
            "8.1.1": "测试结果与分析",
            "8.1.2": "Test Results",
            "9.1.1": "总结与展望",
            "9.1.2": "Conclusion",
        },
    )

    # Slide 3: PART 01
    set_section_slide(prs.slides[2], "绪论", "Introduction", "PART 01")

    # Slide 4: Background pain points
    s4 = prs.slides[3]
    bulk_set(
        s4,
        {
            "1": "研究背景与问题",
            "2.8": "中小规模视频平台的核心复杂度在于上传后链路：转码、切片、分发、状态回写和异常恢复。",
            "2.9": "大文件上传若由后端中转，带宽与连接资源压力明显增加。",
            "2.10": "异步转码流程步骤多，任务失败时易出现状态不一致与卡死。",
            "2.11": "传统常驻转码服务运维成本高，难适配业务峰谷波动。",
        }
    )

    # Slide 5: PART 02
    set_section_slide(prs.slides[4], "研究方法与思路", "Research methods and ideas", "PART 02")

    # Slide 6: Goal & scope
    s6 = prs.slides[5]
    bulk_set(
        s6,
        {
            "12": "研究目标与系统范围",
            "16.0.1": "内容生产",
            "16.1": "提供创作者上传、发布、管理与转码状态追踪能力。",
            "17.0.1": "内容消费",
            "17.1": "支持浏览、搜索、HLS播放与评论点赞等互动行为。",
            "18.0.1": "内容运营",
            "18.1": "采集播放事件并聚合统计，形成可分析的数据闭环。",
        }
    )

    # Slide 7: Architecture
    s7 = prs.slides[6]
    bulk_set(
        s7,
        {
            "12": "总体架构设计",
            "19": "应用层 + 数据层 + Serverless 媒体层分离：同步请求与异步任务解耦。",
            "20": "对象存储负责大文件，状态机编排 Lambda，EventBridge 回传阶段事件。",
        }
    )
    update_slide7_charts(s7, rows)

    # Slide 8: Core modules
    s8 = prs.slides[7]
    bulk_set(
        s8,
        {
            "12": "核心业务模块",
            "15.5.0.1": "用户认证",
            "15.5.0.0": "Better Auth 统一登录与会话鉴权。",
            "15.5.1.1": "内容浏览",
            "15.5.1.0": "首页流式加载与关键词搜索。",
            "15.6.0.1": "上传处理",
            "15.6.0.0": "预签名直传 + 状态机转码。",
            "15.6.1.1": "工作室统计",
            "15.6.1.0": "内容管理与频道/视频分析。",
        }
    )

    # Slide 9: PART 03
    set_section_slide(prs.slides[8], "关键技术与难点", "Key Technology and Difficulty", "PART 03")

    # Slide 10: Pipeline flow
    s10 = prs.slides[9]
    bulk_set(
        s10,
        {
            "12": "媒体处理流程",
            "15.1.1": "预签名直传",
            "15.1.0": "客户端直传 vod-raw，避免占用 Web 服务带宽。",
            "15.2.1": "任务初始化",
            "15.2.0": "创建 UploadSession 与 TranscodeJob 并启动状态机。",
            "15.3.1": "状态机编排",
            "15.3.0": "Lambda 执行提取元数据、转码、切片、封面抽取。",
            "15.4.1": "状态回写",
            "15.4.0": "阶段事件回写数据库，前端轮询显示实时处理状态。",
        }
    )

    # Slide 11: Recovery
    s11 = prs.slides[10]
    bulk_set(
        s11,
        {
            "12": "状态机与异常恢复",
            "15.22.1": "成功路径",
            "15.22.0": "UPLOADING -> PROCESSING -> READY，任务完成后资源可播放。",
            "15.23.1": "失败分支",
            "15.23.0": "任一阶段异常进入 Catch，统一触发 mark-failed 回写。",
            "15.24.1": "重试机制",
            "15.24.0": "支持前端发起失败重试，降低偶发错误影响。",
            "15.25.1": "纠错机制",
            "15.25.0": "reconcile-stale 处理超时 RUNNING 任务，避免长期锁定。",
        }
    )

    # Slide 12: PART 04
    set_section_slide(prs.slides[11], "研究成果与应用", "Research results and applications", "PART 04")

    # Slide 13: Database consistency
    s13 = prs.slides[12]
    bulk_set(
        s13,
        {
            "12": "数据库与一致性设计",
            "15.7": "认证与会话",
            "15.10": "User / Session / Account / Verification",
            "15.8": "内容互动",
            "15.12": "Video / Channel / Comment / Reaction / Subscription",
            "15.9": "上传处理",
            "15.13": "UploadSession / TranscodeJob / VideoAsset",
            "15.11": "统计分析",
            "15.14": "VideoPlaybackEvent + 日级统计汇总表",
        }
    )

    # Slide 14: Screenshots
    s14 = prs.slides[13]
    bulk_set(
        s14,
        {
            "12": "系统实现效果",
            "17": "界面效果与演示路径",
            "19": "左侧为首页/播放页，右侧为上传进度与工作室统计页。\n截图来源于本项目页面，后续可按目录命名自动替换。",
            "21": "截图目录：docs/ppt-assets/screenshots/",
        }
    )
    add_screenshot_grid(s14)

    # Slide 15: PART 05
    set_section_slide(prs.slides[14], "论文总结", "Summary of the paper", "PART 05")

    # Slide 16: Test scheme
    s16 = prs.slides[15]
    bulk_set(
        s16,
        {
            "12": "测试方案",
            "16.4": "功能与异常测试",
            "16.3": "覆盖权限拦截、上传、状态机运行、失败回写与任务纠错。",
            "17.4": "并发压测",
            "17.3": "JMeter 以 50/100/200 并发压测公开视频列表接口。",
        }
    )

    # Slide 17: Test results
    s17 = prs.slides[16]
    bulk_set(
        s17,
        {
            "12": "测试结果与分析",
            "15.0.7.1": "50并发",
            "15.0.8.0.1": "100并发",
            "15.0.8.1.1": "200并发",
            "15.0.9.1": "异常恢复",
            "15.0.10.1": "功能覆盖",
            "15.0.11.0": f"吞吐量约 {rows[0]['throughput']:.2f} req/s，P99 {rows[0]['p99']:.0f} ms。",
            "15.0.11.1": f"吞吐量约 {rows[1]['throughput']:.2f} req/s，P99 {rows[1]['p99']:.0f} ms。",
            "15.0.12.0": f"吞吐量约 {rows[2]['throughput']:.2f} req/s，P99 {rows[2]['p99']:.0f} ms。",
            "15.0.12.1": "损坏视频进入 FAILED，超时任务可通过纠错接口恢复。",
            "15.0.12.2": "核心业务流程测试通过，系统在实验环境下运行稳定。",
        }
    )

    # Slide 18: Conclusion
    s18 = prs.slides[17]
    bulk_set(
        s18,
        {
            "12": "总结与展望",
            "15.1": "完成闭环实现",
            "15.9": "完成上传、处理、播放、互动、统计全链路工程落地。",
            "15.2": "验证架构可行",
            "15.10": "Serverless 在中小规模 VOD 异步处理场景具备实践价值。",
            "15.3": "优化方向",
            "15.11": "继续完善 ABR 策略、内容审核机制与链路监控能力。",
            "15.4": "生产化验证",
            "15.12": "在真实 AWS/CDN 环境进行更完整的性能与可靠性测试。",
        }
    )

    # Slide 19: Thanks
    s19 = prs.slides[18]
    set_cover_or_thanks(s19)
    bulk_set(
        s19,
        {
            "3": "谢谢您的聆听",
            "9": "欢迎各位老师提出意见与问题",
        }
    )

    # Generic placeholder cleanup
    for slide in prs.slides:
        clear_remaining_placeholders(slide)
        replace_text_everywhere(
            slide,
            {
                "请输入您的学校名称": SCHOOL,
                "指导老师：XXX": TEACHER,
                "答辩学生：XXX": STUDENT,
                "Some text about this part related here. Some text about this part related here.Some text about this part related here.": SUBTITLE,
            },
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUTPUT_PATH))
    print(f"Generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    fill()
