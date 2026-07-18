from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .analytics import build_dashboard_insights


class AnalyticsSnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")

    organizationId: int = Field(gt=0)
    generatedAt: str
    historyDays: int = Field(default=180, ge=1, le=730)
    revenueSeries: list[dict[str, Any]] = Field(default_factory=list)
    weekdayDemand: list[dict[str, Any]] = Field(default_factory=list)
    inventory: list[dict[str, Any]] = Field(default_factory=list)
    customers: dict[str, Any] = Field(default_factory=dict)


app = FastAPI(
    title="REEBS Advanced Analytics",
    version="0.1.0",
    description="Read-only forecasting and operational insight service for the REEBS dashboard.",
)


def _authorize(authorization: str | None) -> None:
    expected = os.getenv("REEBS_ANALYTICS_SERVICE_SECRET", "").strip()
    if not expected:
        return
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid analytics service credential.")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "reebs-analytics", "mode": "read-only"}


@app.post("/v1/dashboard/insights")
def dashboard_insights(
    snapshot: AnalyticsSnapshot,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)
    result = build_dashboard_insights(snapshot.model_dump())
    return {
        **result,
        "organizationId": snapshot.organizationId,
        "generatedAt": snapshot.generatedAt,
        "source": "python",
    }

