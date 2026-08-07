from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from datetime import datetime, timezone

from .contracts import DataQualityCheck, DataQualityResult, QualityStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def freshness_check(
    source_timestamp: datetime,
    now: datetime,
    maximum_age_hours: int = 24,
) -> DataQualityCheck:
    safe_source = (
        source_timestamp
        if source_timestamp.tzinfo
        else source_timestamp.replace(tzinfo=timezone.utc)
    )
    safe_now = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    age_hours = max(0, (safe_now - safe_source).total_seconds() / 3600)
    if age_hours > maximum_age_hours:
        return DataQualityCheck(
            checkId="source-freshness",
            status="warning",
            severity="high",
            message=f"Source snapshot is older than {maximum_age_hours} hours.",
        )
    return DataQualityCheck(
        checkId="source-freshness",
        status="pass",
        severity="low",
        message="Source snapshot is within the approved freshness window.",
    )


def duplicate_identifier_check(values: Iterable[str], identifier_name: str) -> DataQualityCheck:
    counts = Counter(value for value in values if value)
    duplicate_count = sum(count - 1 for count in counts.values() if count > 1)
    if duplicate_count:
        return DataQualityCheck(
            checkId=f"{identifier_name}-uniqueness",
            status="fail",
            severity="critical",
            message=f"Duplicate {identifier_name} values break the expected analytical grain.",
            affectedRecords=duplicate_count,
        )
    return DataQualityCheck(
        checkId=f"{identifier_name}-uniqueness",
        status="pass",
        severity="low",
        message=f"{identifier_name} values are unique at the expected grain.",
    )


def empty_dataset_check(record_count: int) -> DataQualityCheck:
    if record_count == 0:
        return DataQualityCheck(
            checkId="dataset-completeness",
            status="warning",
            severity="medium",
            message="The source dataset is empty; outputs are safe defaults, not evidence of normal performance.",
        )
    return DataQualityCheck(
        checkId="dataset-completeness",
        status="pass",
        severity="low",
        message="The source dataset contains records for analysis.",
    )


def build_quality_result(checks: list[DataQualityCheck]) -> DataQualityResult:
    status: QualityStatus
    if any(check.status == "fail" for check in checks):
        status = "blocked"
    elif any(check.status == "warning" for check in checks):
        status = "warning"
    else:
        status = "good"
    warnings = [check.message for check in checks if check.status != "pass"]
    return DataQualityResult(status=status, checks=checks, warnings=warnings)
