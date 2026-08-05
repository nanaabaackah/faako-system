from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

QualityCheckStatus = Literal["pass", "warning", "fail"]
QualityStatus = Literal["good", "warning", "blocked"]
Confidence = Literal["low", "medium", "high", "not_applicable"]


class AnalyticsContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    applicationId: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")
    tenantId: str = Field(min_length=1, max_length=120)


class CalculationPeriod(BaseModel):
    model_config = ConfigDict(extra="forbid")

    startAt: datetime
    endAt: datetime

    @field_validator("startAt", "endAt")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("analytics timestamps must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_period(self) -> CalculationPeriod:
        if self.endAt < self.startAt:
            raise ValueError("endAt must not be earlier than startAt")
        return self


class AnalyticsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: AnalyticsContext
    period: CalculationPeriod
    sourceTimestamp: datetime
    data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("sourceTimestamp")
    @classmethod
    def require_source_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("sourceTimestamp must include a timezone")
        return value


class DataQualityCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkId: str
    status: QualityCheckStatus
    severity: Literal["low", "medium", "high", "critical"]
    message: str
    affectedRecords: int = Field(default=0, ge=0)


class DataQualityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: QualityStatus
    checks: list[DataQualityCheck]
    warnings: list[str] = Field(default_factory=list)


class AnalyticsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysisId: str
    metricIds: list[str] = Field(default_factory=list)
    calculationVersion: str
    context: AnalyticsContext
    period: CalculationPeriod
    sourceTimestamp: datetime
    refreshTimestamp: datetime
    requestId: str
    result: dict[str, Any]
    confidence: Confidence
    warnings: list[str] = Field(default_factory=list)
    dataQuality: DataQualityResult
