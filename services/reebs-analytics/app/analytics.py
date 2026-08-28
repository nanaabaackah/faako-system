from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _trend_projection(values: list[float], horizon_days: int = 30) -> dict[str, Any]:
    safe = [max(0, _number(value)) for value in values]
    if not safe:
        return {
            "next30RevenueCents": 0,
            "dailyAverageCents": 0,
            "changePct": 0,
            "direction": "steady",
            "confidence": "low",
        }

    recent = safe[-30:]
    previous = safe[-60:-30]
    recent_average = mean(recent)
    previous_average = mean(previous) if previous else recent_average
    change_pct = round(((recent_average - previous_average) / previous_average) * 100) if previous_average else 0
    bounded_change = max(-40, min(40, change_pct))
    projected_daily = recent_average * (1 + bounded_change / 200)

    return {
        "next30RevenueCents": round(projected_daily * horizon_days),
        "dailyAverageCents": round(recent_average),
        "changePct": change_pct,
        "direction": "up" if change_pct > 5 else "down" if change_pct < -5 else "steady",
        "confidence": "high" if len(safe) >= 60 else "medium" if len(safe) >= 21 else "low",
    }


def _inventory_risks(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    risks: list[dict[str, Any]] = []
    for row in rows:
        stock = max(0, round(_number(row.get("stock"))))
        reorder_level = max(0, round(_number(row.get("reorderLevel"), 2)))
        units_out = max(0, _number(row.get("unitsOut90d")))
        daily_velocity = units_out / 90
        days_cover = round(stock / daily_velocity) if daily_velocity > 0 else None
        below_reorder = stock <= reorder_level
        running_out = days_cover is not None and days_cover <= 21
        if not below_reorder and not running_out:
            continue
        severity = "critical" if stock == 0 or (days_cover is not None and days_cover <= 7) else "warning"
        risks.append({
            "productId": row.get("productId"),
            "name": row.get("name") or "Inventory item",
            "stock": stock,
            "reorderLevel": reorder_level,
            "unitsOut90d": round(units_out),
            "daysCover": days_cover,
            "severity": severity,
        })

    return sorted(
        risks,
        key=lambda item: (
            0 if item["severity"] == "critical" else 1,
            item["daysCover"] if item["daysCover"] is not None else 999999,
            item["stock"],
        ),
    )[:5]


def build_dashboard_insights(payload: dict[str, Any]) -> dict[str, Any]:
    revenue_rows = payload.get("revenueSeries") or []
    daily_totals = [
        _number(row.get("orderRevenueCents")) + _number(row.get("bookingRevenueCents"))
        for row in revenue_rows
    ]
    forecast = _trend_projection(daily_totals)

    weekday_totals: dict[str, int] = defaultdict(int)
    for row in payload.get("weekdayDemand") or []:
        weekday = str(row.get("weekday") or "").strip().title()
        if weekday in WEEKDAYS:
            weekday_totals[weekday] += max(0, round(_number(row.get("bookings"))))
    peak_weekday = max(WEEKDAYS, key=lambda day: weekday_totals[day]) if weekday_totals else "No pattern yet"
    total_historic_bookings = sum(weekday_totals.values())
    history_days = max(1, round(_number(payload.get("historyDays"), 180)))
    booking_forecast = round((total_historic_bookings / history_days) * 30)

    customers = payload.get("customers") or {}
    total_customers = max(0, round(_number(customers.get("total"))))
    repeat_customers = max(0, round(_number(customers.get("repeat"))))
    repeat_rate = round((repeat_customers / total_customers) * 100) if total_customers else 0
    risks = _inventory_risks(payload.get("inventory") or [])

    insights: list[dict[str, str]] = []
    if risks:
        critical_count = sum(1 for item in risks if item["severity"] == "critical")
        insights.append({
            "key": "inventory-risk",
            "title": f"{len(risks)} fast-moving item{'s' if len(risks) != 1 else ''} need attention",
            "detail": f"{critical_count} may run out within a week." if critical_count else "Review stock cover before the next booking cycle.",
            "tone": "critical" if critical_count else "warning",
            "path": "/admin/inventory?filter=low",
        })
    if peak_weekday != "No pattern yet":
        insights.append({
            "key": "peak-day",
            "title": f"{peak_weekday} is the busiest booking day",
            "detail": f"Plan staff, delivery, and setup capacity around {peak_weekday.lower()} demand.",
            "tone": "info",
            "path": "/admin/schedule",
        })
    if repeat_rate < 25 and total_customers >= 10:
        insights.append({
            "key": "repeat-rate",
            "title": "Repeat customer rate has room to grow",
            "detail": f"{repeat_rate}% of customers have returned. Consider a post-event follow-up campaign.",
            "tone": "info",
            "path": "/admin/crm",
        })

    return {
        "version": "2026-08-reebs-core-recognition-v2",
        "forecast": forecast,
        "demand": {
            "peakWeekday": peak_weekday,
            "peakBookings": weekday_totals.get(peak_weekday, 0),
            "bookingForecastNext30": booking_forecast,
            "weekdayTotals": [{"weekday": day, "bookings": weekday_totals[day]} for day in WEEKDAYS],
        },
        "inventoryRisks": risks,
        "customer": {
            "total": total_customers,
            "repeat": repeat_customers,
            "repeatRate": repeat_rate,
        },
        "insights": insights[:4],
    }

