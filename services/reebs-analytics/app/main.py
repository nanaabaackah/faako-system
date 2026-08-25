from __future__ import annotations

import hmac
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .analytics import build_dashboard_insights
from .contracts import AnalyticsRequest, AnalyticsResponse
from .isolation import (
    authenticate,
    authorize_context,
    authorize_legacy_reebs_context,
    validate_authentication_configuration,
)
from .logging_utils import log_event
from .pilots import ANALYSIS_RUNNERS


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
    return {"ok": True, "service": "faako-analytics", "mode": "read-only"}


@app.get("/ready")
def readiness() -> dict[str, Any]:
    validate_authentication_configuration()
    return {"ok": True, "service": "faako-analytics"}


@app.post("/api/analytics/{application_id}/{analysis_id}", response_model=AnalyticsResponse)
def shared_analytics(
    request: Request,
    application_id: str,
    analysis_id: str,
    payload: AnalyticsRequest,
    authorization: str | None = Header(default=None),
    x_application_id: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> AnalyticsResponse:
    principal = authenticate(authorization)
    if application_id != payload.context.applicationId:
        raise HTTPException(status_code=403, detail="Analytics application path does not match the request context.")
    authorize_context(principal, payload.context, x_application_id, x_tenant_id)
    runner = ANALYSIS_RUNNERS.get((application_id, analysis_id))
    if runner is None:
        raise HTTPException(status_code=404, detail="The requested analytics capability is not supported.")
    request_id = _request_id(request)
    try:
        response = runner(payload, request_id)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail="The analytics dataset is invalid.") from error
    log_event(
        "analytics.completed",
        analysisId=response.analysisId,
        applicationId=payload.context.applicationId,
        callerId=principal.caller_id,
        dataQualityStatus=response.dataQuality.status,
        requestId=request_id,
        status="succeeded",
        tenantId=payload.context.tenantId,
    )
    return response


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

