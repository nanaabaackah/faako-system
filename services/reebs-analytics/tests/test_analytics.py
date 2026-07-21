import unittest

from app.analytics import build_dashboard_insights


class DashboardAnalyticsTests(unittest.TestCase):
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

