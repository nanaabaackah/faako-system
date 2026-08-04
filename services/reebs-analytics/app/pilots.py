from __future__ import annotations

from collections import Counter
from datetime import datetime
from statistics import mean
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .analytics import build_dashboard_insights
from .contracts import AnalyticsRequest, AnalyticsResponse, Confidence, DataQualityCheck
from .quality import build_quality_result, duplicate_identifier_check, empty_dataset_check, freshness_check, utc_now


class ReebsInventoryRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    productId: int | str
    name: str = "Inventory item"
    stock: float = 0
    reorderLevel: float = 2
    unitsOut90d: float = 0


class ReebsDashboardSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    organizationId: int = Field(gt=0)
    generatedAt: datetime
    historyDays: int = Field(default=180, ge=1, le=730)
    revenueSeries: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    weekdayDemand: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    inventory: list[ReebsInventoryRow] = Field(default_factory=list, max_length=5000)
    customers: dict[str, Any] = Field(default_factory=dict)


class OperationalTask(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taskId: str = Field(min_length=1, max_length=120)
    stage: str = Field(min_length=1, max_length=80)
    createdAt: datetime
    startedAt: datetime | None = None
    completedAt: datetime | None = None
    dueAt: datetime | None = None
    assigneeKey: str | None = Field(default=None, max_length=120)

    @field_validator("createdAt", "startedAt", "completedAt", "dueAt")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("task timestamps must include a timezone")
        return value


class OperationalHealthSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tasks: list[OperationalTask] = Field(default_factory=list, max_length=10000)


def _confidence(record_count: int, quality_status: str) -> Confidence:
    if quality_status == "blocked" or record_count == 0:
        return "low"
    if record_count >= 30:
        return "high"
    if record_count >= 10:
        return "medium"
    return "low"


def run_reebs_dashboard(
    request: AnalyticsRequest,
    request_id: str,
    now: datetime | None = None,
) -> AnalyticsResponse:
    snapshot = ReebsDashboardSnapshot.model_validate(request.data)
    if str(snapshot.organizationId) != request.context.tenantId:
        raise HTTPException(status_code=403, detail="REEBS organisation does not match the analytics tenant context.")
    effective_now = now or utc_now()
    inventory = [row.model_dump() for row in snapshot.inventory]
    negative_count = sum(
        1 for row in snapshot.inventory
        if row.stock < 0 or row.reorderLevel < 0 or row.unitsOut90d < 0
    )
    checks = [
        freshness_check(request.sourceTimestamp, effective_now),
        empty_dataset_check(len(snapshot.revenueSeries) + len(inventory)),
        duplicate_identifier_check([str(row.productId) for row in snapshot.inventory], "productId"),
        DataQualityCheck(
            checkId="inventory-non-negative-values",
            status="fail" if negative_count else "pass",
            severity="high" if negative_count else "low",
            message=(
                "Inventory quantities contain unexpected negative values."
                if negative_count
                else "Inventory quantities are non-negative."
            ),
            affectedRecords=negative_count,
        ),
    ]
    quality = build_quality_result(checks)
    analytics_payload = snapshot.model_dump(mode="json")
    analytics_payload["inventory"] = inventory
    result = build_dashboard_insights(analytics_payload)
    result["source"] = "python"
    return AnalyticsResponse(
        analysisId="reebs.dashboard-insights",
        metricIds=["revenue", "booking-count", "inventory-days-cover", "repeat-customer-rate"],
        calculationVersion=result["version"],
        context=request.context,
        period=request.period,
        sourceTimestamp=request.sourceTimestamp,
        refreshTimestamp=effective_now,
        requestId=request_id,
        result=result,
        confidence=_confidence(len(snapshot.revenueSeries), quality.status),
        warnings=quality.warnings,
        dataQuality=quality,
    )


def run_operational_health(
    request: AnalyticsRequest,
    request_id: str,
    now: datetime | None = None,
) -> AnalyticsResponse:
    snapshot = OperationalHealthSnapshot.model_validate(request.data)
    effective_now = now or utc_now()
    tasks = snapshot.tasks
    checks = [
        freshness_check(request.sourceTimestamp, effective_now),
        empty_dataset_check(len(tasks)),
        duplicate_identifier_check([task.taskId for task in tasks], "taskId"),
    ]

    invalid_sequence_count = sum(
        1
        for task in tasks
        if (task.completedAt and task.completedAt < task.createdAt)
        or (task.startedAt and task.startedAt < task.createdAt)
    )
    checks.append(
        DataQualityCheck(
            checkId="task-date-sequence",
            status="fail" if invalid_sequence_count else "pass",
            severity="high" if invalid_sequence_count else "low",
            message=(
                "Task lifecycle dates contain impossible sequences."
                if invalid_sequence_count
                else "Task lifecycle dates follow valid sequences."
            ),
            affectedRecords=invalid_sequence_count,
        )
    )
    quality = build_quality_result(checks)

    unique_tasks = {task.taskId: task for task in tasks}.values()
    open_tasks = [task for task in unique_tasks if task.completedAt is None]
    completed_tasks = [
        task
        for task in unique_tasks
        if task.completedAt is not None and task.completedAt >= task.createdAt
    ]
    overdue_tasks = [task for task in open_tasks if task.dueAt is not None and task.dueAt < effective_now]
    cycle_hours = [
        (task.completedAt - task.createdAt).total_seconds() / 3600
        for task in completed_tasks
        if task.completedAt is not None
    ]
    overdue_by_stage = Counter(task.stage for task in overdue_tasks)
    open_by_stage = Counter(task.stage for task in open_tasks)
    workload = Counter(task.assigneeKey or "unassigned" for task in open_tasks)
    delay_stage = overdue_by_stage.most_common(1)[0][0] if overdue_by_stage else None

    result = {
        "taskCount": len(list(unique_tasks)),
        "openTaskCount": len(open_tasks),
        "completedTaskCount": len(completed_tasks),
        "overdueTaskCount": len(overdue_tasks),
        "averageCompletionHours": round(mean(cycle_hours), 2) if cycle_hours else None,
        "delayConcentrationStage": delay_stage,
        "openByStage": [
            {"stage": stage, "tasks": count}
            for stage, count in sorted(open_by_stage.items())
        ],
        "overdueByStage": [
            {"stage": stage, "tasks": count}
            for stage, count in sorted(overdue_by_stage.items())
        ],
        "workloadDistribution": [
            {"assigneeKey": assignee, "openTasks": count}
            for assignee, count in sorted(workload.items())
        ],
    }
    return AnalyticsResponse(
        analysisId="dev-erp.operational-health",
        metricIds=["process-cycle-time", "overdue-work-item-count", "open-workload"],
        calculationVersion="2026-08-operational-health-v1",
        context=request.context,
        period=request.period,
        sourceTimestamp=request.sourceTimestamp,
        refreshTimestamp=effective_now,
        requestId=request_id,
        result=result,
        confidence=_confidence(len(tasks), quality.status),
        warnings=quality.warnings,
        dataQuality=quality,
    )


ANALYSIS_RUNNERS = {
    ("reebs", "dashboard-insights"): run_reebs_dashboard,
    ("dev-erp", "operational-health"): run_operational_health,
}
