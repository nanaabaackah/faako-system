import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.contracts import AnalyticsRequest
from app.main import app
from app.pilots import run_operational_health, run_reebs_dashboard

NOW = datetime(2026, 8, 4, 12, 0, tzinfo=timezone.utc)


def operational_request(tasks, source_timestamp="2026-08-04T11:00:00Z"):
    return {
        "context": {"applicationId": "dev-erp", "tenantId": "tenant-a"},
        "period": {"startAt": "2026-07-01T00:00:00Z", "endAt": "2026-08-04T12:00:00Z"},
        "sourceTimestamp": source_timestamp,
        "data": {"tasks": tasks},
    }


def reebs_request(inventory):
    return {
        "context": {"applicationId": "reebs", "tenantId": "42"},
        "period": {"startAt": "2026-05-01T00:00:00Z", "endAt": "2026-08-04T12:00:00Z"},
        "sourceTimestamp": "2026-08-04T11:00:00Z",
        "data": {
            "organizationId": 42,
            "generatedAt": "2026-08-04T11:00:00Z",
            "historyDays": 90,
            "revenueSeries": [
                {"date": f"2026-07-{day:02d}", "orderRevenueCents": 1000, "bookingRevenueCents": 500}
                for day in range(1, 31)
            ],
            "inventory": inventory,
            "weekdayDemand": [{"weekday": "Saturday", "bookings": 8}],
            "customers": {"total": 10, "repeat": 3},
        },
    }


class SharedAnalyticsPlatformTests(unittest.TestCase):
    def test_reebs_pilot_returns_stable_quality_aware_inventory_output(self):
        request = AnalyticsRequest.model_validate(reebs_request([
            {"productId": 1, "name": "Balloons", "stock": 2, "reorderLevel": 3, "unitsOut90d": 90}
        ]))

        response = run_reebs_dashboard(request, "reebs-request", now=NOW)

        self.assertEqual(response.analysisId, "reebs.dashboard-insights")
        self.assertEqual(response.context.tenantId, "42")
        self.assertEqual(response.dataQuality.status, "good")
        self.assertEqual(response.result["inventoryRisks"][0]["productId"], 1)

    def test_reebs_pilot_blocks_invalid_inventory_grain(self):
        repeated = {"productId": 1, "name": "Balloons", "stock": -1, "unitsOut90d": 5}
        request = AnalyticsRequest.model_validate(reebs_request([repeated, repeated]))

        response = run_reebs_dashboard(request, "reebs-request", now=NOW)

        self.assertEqual(response.dataQuality.status, "blocked")
        self.assertTrue(any(check.status == "fail" for check in response.dataQuality.checks))

    def test_operational_health_calculates_cycle_overdue_and_workload(self):
        request = AnalyticsRequest.model_validate(operational_request([
            {
                "taskId": "completed-1",
                "stage": "DONE",
                "createdAt": "2026-08-01T08:00:00Z",
                "completedAt": "2026-08-01T20:00:00Z",
                "assigneeKey": "team-a",
            },
            {
                "taskId": "late-1",
                "stage": "REVIEW",
                "createdAt": "2026-07-30T08:00:00Z",
                "dueAt": "2026-08-03T08:00:00Z",
                "assigneeKey": "team-b",
            },
        ]))

        response = run_operational_health(request, "request-1", now=NOW)

        self.assertEqual(response.result["overdueTaskCount"], 1)
        self.assertEqual(response.result["averageCompletionHours"], 12)
        self.assertEqual(response.result["delayConcentrationStage"], "REVIEW")
        self.assertEqual(response.dataQuality.status, "good")

    def test_operational_health_blocks_duplicate_grain(self):
        task = {
            "taskId": "duplicate",
            "stage": "TODO",
            "createdAt": "2026-08-01T08:00:00Z",
        }
        request = AnalyticsRequest.model_validate(operational_request([task, task]))

        response = run_operational_health(request, "request-2", now=NOW)

        self.assertEqual(response.dataQuality.status, "blocked")
        self.assertIn("Duplicate taskId", " ".join(response.warnings))

    def test_operational_health_marks_stale_empty_data_as_warning(self):
        request = AnalyticsRequest.model_validate(operational_request([], "2026-07-01T00:00:00Z"))

        response = run_operational_health(request, "request-3", now=NOW)

        self.assertEqual(response.dataQuality.status, "warning")
        self.assertEqual(response.confidence, "low")
        self.assertEqual(response.result["taskCount"], 0)

    def test_shared_api_preserves_request_and_tenant_context(self):
        tokens = json.dumps({
            "dev-erp-backend": {
                "secret": "dev-secret",
                "applicationIds": ["dev-erp"],
                "tenantIds": ["tenant-a"],
            }
        })
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/dev-erp/operational-health",
                headers={
                    "Authorization": "Bearer dev-secret",
                    "X-Application-Id": "dev-erp",
                    "X-Tenant-Id": "tenant-a",
                    "X-Request-Id": "request-from-dev-erp",
                },
                json=operational_request([]),
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["requestId"], "request-from-dev-erp")
        self.assertEqual(payload["context"], {"applicationId": "dev-erp", "tenantId": "tenant-a"})
        self.assertIn("dataQuality", payload)

    def test_shared_api_rejects_cross_tenant_request(self):
        tokens = json.dumps({
            "dev-erp-backend": {
                "secret": "dev-secret",
                "applicationIds": ["dev-erp"],
                "tenantIds": ["tenant-a"],
            }
        })
        payload = operational_request([])
        payload["context"]["tenantId"] = "tenant-b"
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/dev-erp/operational-health",
                headers={
                    "Authorization": "Bearer dev-secret",
                    "X-Application-Id": "dev-erp",
                    "X-Tenant-Id": "tenant-b",
                },
                json=payload,
            )

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("tenant-a", response.text)

    def test_shared_api_rejects_context_header_mismatch(self):
        tokens = json.dumps({
            "reebs-backend": {
                "secret": "reebs-secret",
                "applicationIds": ["reebs"],
                "tenantIds": ["1"],
            }
        })
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/dev-erp/operational-health",
                headers={
                    "Authorization": "Bearer reebs-secret",
                    "X-Application-Id": "dev-erp",
                    "X-Tenant-Id": "tenant-a",
                },
                json=operational_request([]),
            )

        self.assertEqual(response.status_code, 403)

    def test_reebs_api_rejects_payload_from_another_tenant(self):
        tokens = json.dumps({
            "reebs-backend": {
                "secret": "reebs-secret",
                "applicationIds": ["reebs"],
                "tenantIds": ["42"],
            }
        })
        payload = reebs_request([])
        payload["data"]["organizationId"] = 99
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/reebs/dashboard-insights",
                headers={
                    "Authorization": "Bearer reebs-secret",
                    "X-Application-Id": "reebs",
                    "X-Tenant-Id": "42",
                },
                json=payload,
            )

        self.assertEqual(response.status_code, 403)

    def test_legacy_reebs_api_rejects_scoped_cross_tenant_request(self):
        tokens = json.dumps({
            "reebs-backend": {
                "secret": "reebs-secret",
                "applicationIds": ["reebs"],
                "tenantIds": ["42"],
            }
        })
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/v1/dashboard/insights",
                headers={"Authorization": "Bearer reebs-secret"},
                json={"organizationId": 99, "generatedAt": "2026-08-04T11:00:00Z"},
            )

        self.assertEqual(response.status_code, 403)

    def test_nested_dataset_validation_uses_safe_error_contract(self):
        tokens = json.dumps({
            "dev-erp-backend": {
                "secret": "dev-secret",
                "applicationIds": ["dev-erp"],
                "tenantIds": ["tenant-a"],
            }
        })
        payload = operational_request([])
        payload["data"] = {"tasks": [{"taskId": "", "stage": "TODO", "createdAt": "not-a-date"}]}
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/dev-erp/operational-health",
                headers={
                    "Authorization": "Bearer dev-secret",
                    "X-Application-Id": "dev-erp",
                    "X-Tenant-Id": "tenant-a",
                    "X-Request-Id": "invalid-dataset",
                },
                json=payload,
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["requestId"], "invalid-dataset")
        self.assertNotIn("not-a-date", response.text)

    def test_validation_errors_use_safe_contract_and_request_id(self):
        tokens = json.dumps({
            "dev-erp-backend": {
                "secret": "dev-secret",
                "applicationIds": ["dev-erp"],
                "tenantIds": ["tenant-a"],
            }
        })
        payload = operational_request([])
        payload["period"]["startAt"] = "not-a-date"
        with patch.dict("os.environ", {"FAAKO_ANALYTICS_SERVICE_TOKENS": tokens}, clear=True):
            response = TestClient(app).post(
                "/api/analytics/dev-erp/operational-health",
                headers={
                    "Authorization": "Bearer dev-secret",
                    "X-Application-Id": "dev-erp",
                    "X-Tenant-Id": "tenant-a",
                    "X-Request-Id": "invalid-request",
                },
                json=payload,
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["requestId"], "invalid-request")
        self.assertNotIn("not-a-date", response.text)


if __name__ == "__main__":
    unittest.main()
