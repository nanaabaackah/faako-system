# System Health Dashboard Phase 1

## Summary

The Dev ERP System Health route is an enterprise monitoring UI preview. It is configuration driven, responsive, keyboard accessible, dark-mode compatible, and backed by deterministic mock data. Existing routes and all backend behavior are unchanged.

## Components

- `SystemHealth`: page composition and UI state.
- `SystemHealthHeader`: title, range selection, and preview refresh.
- `PlatformHealthScore` and `MonitoringSummaryCards`: overall score, availability, latency, and incident summaries.
- `MonitoringFilters`: search, environment, status, category, and provider controls.
- `TimelineRangeSelector`, `HealthTimeline`, and `TimelineBlock`: range-aware adjacent status histories with keyboard-accessible telemetry.
- `MonitoringSection`, `ServiceRow`, `LatencyBadge`, and `StatusBadge`: grouped service inventory.
- `ServiceDrawer`, `DependencyTree`, and `IncidentList`: focused service details and preview manual checks.
- `SkeletonRow` and `EmptyState`: loading/zero-result foundations.

## Demo model

Each service includes `id`, `name`, `category`, `environment`, `provider`, `status`, latency statistics, uptime, timeline blocks, dependencies, incidents, and last-check timestamps. `monitoringConfig.js` is the single Phase 1 configuration source.

## Manual testing

1. Open `/system-health` in light and dark mode.
2. Switch among Last hour, Last 24 hours, Last 7 days, and Last 30 days; confirm the interval label and timelines change.
3. Combine search, environment, status, category, and provider filters; reset the empty state.
4. Tab through timeline blocks and inspect the timestamp/status/latency/HTTP/duration tooltip.
5. Open a service drawer, inspect dependencies and incidents, run the preview check, close with Escape, the close button, and the backdrop.
6. Review desktop, tablet, and mobile widths.
7. On Dashboard, confirm System Status and website/portal cards use adjacent history blocks and the full-dashboard link preserves `/system-health`.

## Future integration points

- Adapt live monitoring observations into the Phase 1 service model without coupling presentation components to API payloads.
- Store real history for the four time ranges and calculate uptime/SLO values server-side.
- Connect manual checks through an authenticated, capability-gated, rate-limited backend action.
- Add provider telemetry, incident lifecycle ownership, and historical percentile charts.
- Replace demo dependencies with registry-backed service relationships.
