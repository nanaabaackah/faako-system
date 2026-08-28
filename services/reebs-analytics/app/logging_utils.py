from __future__ import annotations

import json
import logging
import os
from typing import Any

LOGGER = logging.getLogger("faako.analytics")
if not LOGGER.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    LOGGER.addHandler(handler)
LOGGER.setLevel(os.getenv("FAAKO_ANALYTICS_LOG_LEVEL", "INFO").upper())
LOGGER.propagate = False


def log_event(event_name: str, **fields: Any) -> None:
    safe_fields = {
        key: value
        for key, value in fields.items()
        if key in {
            "analysisId",
            "applicationId",
            "callerId",
            "dataQualityStatus",
            "eventName",
            "requestId",
            "status",
            "tenantId",
        }
    }
    LOGGER.info(json.dumps({"eventName": event_name, **safe_fields}, default=str, sort_keys=True))
