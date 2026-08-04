from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .analytics import build_dashboard_insights
from .contracts import AnalyticsRequest, AnalyticsResponse
from .isolation import (
    authenticate,
    authentication_is_configured,
    authorize_context,
    authorize_legacy_reebs_context,
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
    title="Faako Analytics",
    version="0.2.0",
    description="Read-only, tenant-scoped advanced analytics shared by approved Faako applications.",
)

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,120}$")


def _request_id(request: Request) -> str:
    existing = getattr(request.state, "request_id", "")
    return str(existing or uuid.uuid4())


@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Any:
    supplied = request.headers.get("x-request-id", "").strip()
    request.state.request_id = supplied if REQUEST_ID_PATTERN.fullmatch(supplied) else str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


def _error_category(status_code: int) -> tuple[str, str]:
    if status_code == 401:
        return "authentication", "ANALYTICS_AUTHENTICATION_REQUIRED"
    if status_code == 403:
        return "permission", "ANALYTICS_PERMISSION_DENIED"
    if status_code == 404:
        return "not_found", "ANALYTICS_NOT_FOUND"
    if status_code == 422:
        return "validation", "ANALYTICS_VALIDATION_FAILED"
    if status_code == 429:
        return "rate_limit", "ANALYTICS_RATE_LIMITED"
    if status_code >= 500:
        return "server", "ANALYTICS_UNAVAILABLE"
    return "validation", "ANALYTICS_REQUEST_FAILED"


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, error: HTTPException) -> JSONResponse:
    category, code = _error_category(error.status_code)
    message = str(error.detail) if isinstance(error.detail, str) else "Analytics request failed."
    return JSONResponse(
        status_code=error.status_code,
        content={
            "ok": False,
            "error": {
                "category": category,
                "code": code,
                "message": message,
                "requestId": _request_id(request),
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, _error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "ok": False,
            "error": {
                "category": "validation",
                "code": "ANALYTICS_VALIDATION_FAILED",
                "message": "The analytics request is invalid.",
                "requestId": _request_id(request),
            },
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, _error: Exception) -> JSONResponse:
    request_id = _request_id(request)
    log_event("analytics.failed", requestId=request_id, status="failed")
    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": {
                "category": "server",
                "code": "ANALYTICS_UNAVAILABLE",
                "message": "Analytics is temporarily unavailable.",
                "requestId": request_id,
            },
        },
    )


def _authorize(authorization: str | None) -> None:
    authenticate(authorization)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "faako-analytics", "mode": "read-only"}


@app.get("/ready")
def readiness() -> dict[str, Any]:
    if not authentication_is_configured():
        raise HTTPException(status_code=503, detail="Analytics service authentication is not configured.")
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
    principal = authenticate(authorization)
    authorize_legacy_reebs_context(principal, str(snapshot.organizationId))
    result = build_dashboard_insights(snapshot.model_dump())
    return {
        **result,
        "organizationId": snapshot.organizationId,
        "generatedAt": snapshot.generatedAt,
        "source": "python",
    }
