from __future__ import annotations

import hmac
import json
import os
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException

from .contracts import AnalyticsContext


@dataclass(frozen=True)
class ServicePrincipal:
    caller_id: str
    application_ids: frozenset[str]
    tenant_ids: frozenset[str]
    platform_admin: bool = False


def _configured_principals() -> list[tuple[str, ServicePrincipal]]:
    raw = os.getenv("FAAKO_ANALYTICS_SERVICE_TOKENS", "").strip()
    if not raw:
        return []
    try:
        configured: dict[str, dict[str, Any]] = json.loads(raw)
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=503, detail="Analytics service authentication is misconfigured.") from error

    principals: list[tuple[str, ServicePrincipal]] = []
    for caller_id, value in configured.items():
        secret = str(value.get("secret") or "").strip()
        applications = frozenset(
            str(item).strip()
            for item in value.get("applicationIds", [])
            if str(item).strip()
        )
        tenants = frozenset(str(item).strip() for item in value.get("tenantIds", []) if str(item).strip())
        platform_admin = value.get("platformAdmin") is True
        if not secret or not applications or (not tenants and not platform_admin):
            raise HTTPException(status_code=503, detail="Analytics service authentication is misconfigured.")
        principals.append(
            (
                secret,
                ServicePrincipal(
                    caller_id=str(caller_id),
                    application_ids=applications,
                    tenant_ids=tenants,
                    platform_admin=platform_admin,
                ),
            )
        )
    return principals


def _legacy_principal() -> tuple[str, ServicePrincipal] | None:
    secret = (
        os.getenv("FAAKO_ANALYTICS_SERVICE_SECRET", "").strip()
        or os.getenv("REEBS_ANALYTICS_SERVICE_SECRET", "").strip()
    )
    if not secret:
        return None
    configured_tenants = frozenset(
        item.strip()
        for item in os.getenv("REEBS_ANALYTICS_TENANT_IDS", "").split(",")
        if item.strip()
    )
    return secret, ServicePrincipal(
        caller_id="legacy-reebs-backend",
        application_ids=frozenset({"reebs"}),
        tenant_ids=configured_tenants or frozenset({"*"}),
    )


def authentication_is_configured() -> bool:
    return bool(
        os.getenv("FAAKO_ANALYTICS_SERVICE_TOKENS", "").strip()
        or os.getenv("FAAKO_ANALYTICS_SERVICE_SECRET", "").strip()
        or os.getenv("REEBS_ANALYTICS_SERVICE_SECRET", "").strip()
    )


def authenticate(authorization: str | None) -> ServicePrincipal:
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not supplied or not authentication_is_configured():
        status = 401 if authentication_is_configured() else 503
        message = (
            "Invalid analytics service credential."
            if status == 401
            else "Analytics service authentication is not configured."
        )
        raise HTTPException(status_code=status, detail=message)

    candidates = _configured_principals()
    legacy = _legacy_principal()
    if legacy:
        candidates.append(legacy)
    for expected, principal in candidates:
        if hmac.compare_digest(supplied, expected):
            return principal
    raise HTTPException(status_code=401, detail="Invalid analytics service credential.")


def authorize_context(
    principal: ServicePrincipal,
    context: AnalyticsContext,
    header_application_id: str | None,
    header_tenant_id: str | None,
) -> None:
    if header_application_id != context.applicationId or header_tenant_id != context.tenantId:
        raise HTTPException(status_code=403, detail="Analytics context does not match the authorised request scope.")
    if context.applicationId not in principal.application_ids:
        raise HTTPException(status_code=403, detail="Analytics application access is not permitted.")
    if (
        not principal.platform_admin
        and "*" not in principal.tenant_ids
        and context.tenantId not in principal.tenant_ids
    ):
        raise HTTPException(status_code=403, detail="Analytics tenant access is not permitted.")


def authorize_legacy_reebs_context(principal: ServicePrincipal, tenant_id: str) -> None:
    """Keep the legacy route usable without allowing scoped credentials to cross tenants."""
    if "reebs" not in principal.application_ids:
        raise HTTPException(status_code=403, detail="Analytics application access is not permitted.")
    if (
        not principal.platform_admin
        and "*" not in principal.tenant_ids
        and tenant_id not in principal.tenant_ids
    ):
        raise HTTPException(status_code=403, detail="Analytics tenant access is not permitted.")
