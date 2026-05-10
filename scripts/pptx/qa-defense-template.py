from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PPT_PATH = ROOT / "docs" / "答辩演示-模板版.pptx"
REPORT_PATH = ROOT / "docs" / "ppt-assets" / "template-filled-markitdown.txt"

FORBIDDEN = [
    "XXX",
    "单击这里可编辑内容",
    "请输入标题内容",
    "Some text about this part related here",
]


def run() -> int:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    extract = subprocess.run(
        [sys.executable, "-m", "markitdown", str(PPT_PATH)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if extract.returncode != 0:
        print(extract.stderr or extract.stdout)
        return extract.returncode

    REPORT_PATH.write_text(extract.stdout, encoding="utf-8")
    content = extract.stdout

    issues: list[str] = []
    for token in FORBIDDEN:
        if token in content:
            issues.append(token)

    if issues:
        print("QA FAILED: found forbidden placeholders:")
        for token in issues:
            print(f"- {token}")
        print(f"See report: {REPORT_PATH}")
        return 1

    print("QA PASSED: no forbidden placeholders found.")
    print(f"Report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
