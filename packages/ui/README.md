# @faako/ui

Shared React UI foundations for Faako apps.

## What changed

Expanded the ERP shell and low-risk presentation foundation with reusable wrappers for topbars, page content, page headers, mobile bottom navigation frames, sidebar slots, module group rendering, status badges, ERP panels, section headers, stack groups, form groups, and shared ERP table presentation.

## Where it lives

- `src/ErpShellFrame.tsx`: shell frame with sidebar, content, topbar, bottom-nav, and placeholder slots.
- `src/ErpShellTopbar.tsx`: shared topbar/header wrapper.
- `src/ErpMobileBottomNavFrame.tsx`: shared mobile bottom-nav wrapper.
- `src/ErpPageContent.tsx`: page content container.
- `src/ErpPageHeader.tsx`: section/page header pattern.
- `src/ErpModuleGroupNav.tsx`: grouped module navigation renderer.
- `src/ErpStatusBadge.tsx`: shared status/module badge pattern.
- `src/ErpNavSidebar.tsx` and `src/ErpBottomNav.tsx`: registry-friendly navigation primitives.
- `src/components/Primitives.tsx`: shared page/card/button/status primitives plus low-risk ERP panel, panel header, section header, stack, and form-group wrappers.
- `src/components/Fields.tsx`: shared field controls and typed option parsing for display/input surfaces.
- `src/components/ERPTable.tsx`: shared ERP table foundation, toolbar/search/filter/action wrappers, controlled pagination, empty/loading states, and visual status badges.
- `src/ui.css`: shared primitive styles, including section-header defaults.

## How to use it

Import wrappers from `@faako/ui` and keep app-specific routes, pages, branding, and workflows in the app:

```tsx
import {
  ErpPanel,
  ErpPanelGrid,
  ErpPanelHeader,
  ErpShellFrame,
  ErpShellTopbar,
  ErpPageContent,
  ERPTable,
  ERPTablePagination,
  ERPStatusBadge,
  FormGroup,
  StackGroup,
} from "@faako/ui";
```

The shell supports registry-driven navigation metadata, module groups, module visibility states, responsive sidebar collapse, mobile bottom navigation, and placeholder slots for offline, sync, notifications, and future organization switching.

The ERP panel/form wrappers intentionally keep legacy class names such as `panel-grid`, `panel`, `panel-header`, `stack`, and `form-field` so apps can adopt them without changing existing CSS or business behavior.

The ERP table components are presentation-only. Apps pass prepared rows, columns, search/filter controls, pagination state, row actions, and status labels. The shared components do not fetch data, filter data, mutate records, enforce permissions, or own workflow validation.

## Environment variables

None.

## Setup or migration steps

None. These are frontend shell primitives and do not require migrations.

## Security or data impact

Presentation-only standardization. No auth behavior, route behavior, API permissions, billing, database schema, payment/receipt logic, booking/order/inventory workflows, table data fetching, table filtering, row mutations, or data access changed.

## Known limitations

The placeholder slots are visual/structural only. Backend-backed module toggles, org branding, offline sync, notifications, and multi-tenant controls remain future work.

The new panel/form/table wrappers are intentionally small. Deeper form, modal, mobile POS layout, workflow table, editable table, bulk action, and ERP page-template systems still require app-specific review before extraction.

Shared form and table planning lives in [docs/platform/shared-form-table-system-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/platform/shared-form-table-system-plan.md). Use that plan before adding table wrappers, pagination controls, filter/action toolbars, modal form shells, or broader form systems.

## Testing notes

Run app builds or lint/type checks for ERP apps that consume these components and verify existing sidebar, topbar, page body, form, panel, table, status badge, pagination, and mobile navigation behavior remains intact.
