from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "mock-vector-surveys"
RAW_CSV = DATA_DIR / "mock_after_sales_surveys_raw_500.csv"
NORMALIZED_CSV = DATA_DIR / "mock_after_sales_feedback_records_500.csv"
REPORT = DATA_DIR / "mock_after_sales_data_quality_report.md"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def append_report(section: str) -> None:
    with REPORT.open("a", encoding="utf-8") as file:
        file.write("\n\n")
        file.write(section.strip())
        file.write("\n")


def dependency_missing_section(error: Exception) -> str:
    return f"""## 10. Presidio 实际运行结果

- 运行时间：{datetime.now().isoformat(timespec="seconds")}
- 状态：未完成
- 原因：当前 Python 环境缺少 Microsoft Presidio 依赖。
- 错误：`{type(error).__name__}: {error}`
- 后续命令建议：`python -m pip install presidio-analyzer presidio-anonymizer`

生成数据仍保留透明假数据与基础正则校验结果；正式入库前应在安装 Presidio 后重新运行本脚本。
"""


def build_analyzer():
    from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer

    analyzer = AnalyzerEngine(supported_languages=["en"])

    plate_pattern = Pattern(
        name="mock_cn_license_plate",
        regex=r"[\u4e00-\u9fa5][A-Z]-?(?:MK\d{3}|DM\d{4})",
        score=0.85,
    )
    vin_pattern = Pattern(
        name="mock_vehicle_vin",
        regex=r"LFAKE\d{12}",
        score=0.95,
    )
    masked_phone_pattern = Pattern(
        name="masked_cn_phone",
        regex=r"1[3-9]\d\*{4}\d{4}",
        score=0.85,
    )
    raw_phone_pattern = Pattern(
        name="raw_cn_phone",
        regex=r"(?<!\d)1[3-9]\d{9}(?!\d)",
        score=0.95,
    )
    any_plate_pattern = Pattern(
        name="any_cn_license_plate",
        regex=r"[\u4e00-\u9fa5][A-Z]-?[A-Z0-9]{5,6}",
        score=0.75,
    )
    any_vin_pattern = Pattern(
        name="any_vehicle_vin",
        regex=r"\b[A-HJ-NPR-Z0-9]{17}\b",
        score=0.75,
    )

    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="CN_LICENSE_PLATE_MOCK",
            patterns=[plate_pattern],
            supported_language="en",
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="VEHICLE_VIN_MOCK",
            patterns=[vin_pattern],
            supported_language="en",
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="CN_PHONE_MASKED_MOCK",
            patterns=[masked_phone_pattern],
            supported_language="en",
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="CN_PHONE_RAW",
            patterns=[raw_phone_pattern],
            supported_language="en",
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="CN_LICENSE_PLATE_ANY",
            patterns=[any_plate_pattern],
            supported_language="en",
        )
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(
            supported_entity="VEHICLE_VIN_ANY",
            patterns=[any_vin_pattern],
            supported_language="en",
        )
    )
    return analyzer


def scan_rows(analyzer, rows: list[dict[str, str]], columns: list[str]) -> tuple[Counter[str], list[str]]:
    entity_counts: Counter[str] = Counter()
    violations: list[str] = []
    allowed_mock_entities = {"CN_LICENSE_PLATE_MOCK", "VEHICLE_VIN_MOCK", "CN_PHONE_MASKED_MOCK"}
    target_entities = [
        "PHONE_NUMBER",
        "EMAIL_ADDRESS",
        "IP_ADDRESS",
        "CREDIT_CARD",
        "US_SSN",
        "IBAN_CODE",
        "CN_PHONE_RAW",
        "CN_PHONE_MASKED_MOCK",
        "CN_LICENSE_PLATE_MOCK",
        "CN_LICENSE_PLATE_ANY",
        "VEHICLE_VIN_MOCK",
        "VEHICLE_VIN_ANY",
    ]
    mock_plate_regex = re.compile(r"^[\u4e00-\u9fa5][A-Z]-?(?:MK\d{3}|DM\d{4})$")
    mock_vin_regex = re.compile(r"^LFAKE\d{12}$")

    for index, row in enumerate(rows, start=1):
        for column in columns:
            value = row.get(column, "")
            if not value:
                continue
            results = analyzer.analyze(text=value, entities=target_entities, language="en")
            for result in results:
                entity_counts[result.entity_type] += 1
                matched_text = value[result.start : result.end]
                if result.entity_type not in allowed_mock_entities:
                    if result.entity_type == "CN_LICENSE_PLATE_ANY" and mock_plate_regex.match(matched_text):
                        continue
                    if result.entity_type == "VEHICLE_VIN_ANY" and mock_vin_regex.match(matched_text):
                        continue
                    violations.append(
                        f"row={index} column={column} entity={result.entity_type} text={matched_text} score={result.score:.2f}"
                    )

    return entity_counts, violations


def baseline_regex_checks(rows: list[dict[str, str]]) -> dict[str, int]:
    joined = "\n".join(",".join(row.values()) for row in rows)
    return {
        "raw_phone_11_digits": len(re.findall(r"(?<![A-Z0-9])1[3-9]\d{9}(?![A-Z0-9])", joined)),
        "mock_plate": len(re.findall(r"[\u4e00-\u9fa5][A-Z]-?(?:MK\d{3}|DM\d{4})", joined)),
        "mock_vin": len(re.findall(r"LFAKE\d{12}", joined)),
        "masked_phone": len(re.findall(r"1[3-9]\d\*{4}\d{4}", joined)),
    }


def markdown_counts(title: str, counts: Counter[str]) -> str:
    if not counts:
        return f"### {title}\n\n无命中。"
    lines = [f"### {title}", "", "| 实体 | 命中数 |", "| --- | ---: |"]
    for entity, count in sorted(counts.items()):
        lines.append(f"| {entity} | {count} |")
    return "\n".join(lines)


def main() -> int:
    if not RAW_CSV.exists() or not NORMALIZED_CSV.exists() or not REPORT.exists():
        print("Required mock survey artifacts are missing. Run node scripts/generate-mock-vector-surveys.mjs first.", file=sys.stderr)
        return 1

    raw_rows = read_csv(RAW_CSV)
    normalized_rows = read_csv(NORMALIZED_CSV)

    try:
        analyzer = build_analyzer()
        # Import anonymizer to verify the package is present for the full Presidio workflow.
        from presidio_anonymizer import AnonymizerEngine  # noqa: F401
    except Exception as error:  # pragma: no cover - depends on local environment
        append_report(dependency_missing_section(error))
        print(f"Presidio dependency missing: {type(error).__name__}: {error}")
        return 2

    raw_counts, raw_violations = scan_rows(
        analyzer,
        raw_rows,
        ["用户账号", "手机号", "车牌号", "VIN", "IP属地/城市", "服务中心", "一句话反馈"],
    )
    normalized_counts, normalized_violations = scan_rows(
        analyzer,
        normalized_rows,
        [
            "mock_user_id",
            "phone_masked",
            "vehicle_plate_mock",
            "vin_mock",
            "city",
            "service_center",
            "feedback_text",
        ],
    )
    baseline = baseline_regex_checks(normalized_rows)
    violations = raw_violations + normalized_violations

    section = f"""## 10. Presidio 实际运行结果

- 运行时间：{datetime.now().isoformat(timespec="seconds")}
- 状态：完成
- 原始问卷扫描行数：{len(raw_rows)}
- 标准反馈扫描行数：{len(normalized_rows)}
- 不允许实体命中数：{len(violations)}
- 明文 11 位手机号正则命中：{baseline["raw_phone_11_digits"]}
- 脱敏假手机号正则命中：{baseline["masked_phone"]}
- 假车牌正则命中：{baseline["mock_plate"]}
- 假 VIN 正则命中：{baseline["mock_vin"]}

{markdown_counts("原始问卷 Presidio 实体命中", raw_counts)}

{markdown_counts("标准反馈 Presidio 实体命中", normalized_counts)}

### 阻断判断

{"通过：未发现未允许的 Presidio PII 实体。" if not violations else "阻断：发现未允许的 Presidio PII 实体。"}
"""
    if violations:
        section += "\n\n### 违规样例\n\n" + "\n".join(f"- {item}" for item in violations[:20])

    append_report(section)
    print(
        {
            "raw_rows": len(raw_rows),
            "normalized_rows": len(normalized_rows),
            "violations": len(violations),
            "baseline": baseline,
            "raw_entities": dict(raw_counts),
            "normalized_entities": dict(normalized_counts),
        }
    )
    return 0 if not violations else 3


if __name__ == "__main__":
    raise SystemExit(main())
