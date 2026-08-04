import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.analytics import build_dashboard_insights
from app.main import _authorize


class DashboardAnalyticsTests(unittest.TestCase):
    def test_service_authentication_fails_closed_without_a_secret(self):
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(HTTPException) as raised:
            _authorize(None)

        self.assertEqual(raised.exception.status_code, 503)

    def test_service_authentication_uses_constant_time_bearer_comparison(self):
        with patch.dict("os.environ", {"REEBS_ANALYTICS_SERVICE_SECRET": "expected-secret"}):
            _authorize("Bearer expected-secret")
            with self.assertRaises(HTTPException) as raised:
                _authorize("Bearer wrong-secret")

        self.assertEqual(raised.exception.status_code, 401)

    def test_builds_forecast_demand_and_inventory_risk(self):
        payload = {
            "historyDays": 180,
            "revenueSeries": [
                {"orderRevenueCents": 10_000 + day * 100, "bookingRevenueCents": 5_000}
                for day in range(60)
            ],
            "weekdayDemand": [
                {"weekday": "Saturday", "bookings": 20},
                {"weekday": "Sunday", "bookings": 5},
            ],
            "inventory": [
                {"productId": 1, "name": "Balloons", "stock": 2, "reorderLevel": 3, "unitsOut90d": 90},
            ],
            "customers": {"total": 20, "repeat": 8},
        }

        result = build_dashboard_insights(payload)

        self.assertGreater(result["forecast"]["next30RevenueCents"], 0)
        self.assertEqual(result["demand"]["peakWeekday"], "Saturday")
        self.assertEqual(result["customer"]["repeatRate"], 40)
        self.assertEqual(result["inventoryRisks"][0]["severity"], "critical")
        self.assertTrue(result["insights"])

    def test_empty_snapshot_returns_safe_defaults(self):
        result = build_dashboard_insights({})

        self.assertEqual(result["forecast"]["next30RevenueCents"], 0)
        self.assertEqual(result["demand"]["peakWeekday"], "No pattern yet")
        self.assertEqual(result["inventoryRisks"], [])


if __name__ == "__main__":
    unittest.main()
