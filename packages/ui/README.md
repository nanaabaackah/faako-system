# @faako/ui

Shared React UI foundations for Faako apps.

## What changed

Expanded the ERP shell and low-risk presentation foundation with reusable wrappers for topbars, page content, page headers, mobile bottom navigation frames, sidebar slots, module group rendering, status badges, ERP panels, section headers, stack groups, form groups, shared ERP table presentation, shared ERP form presentation, shared ERP modal/action presentation, shared ERP in-app notification/alert UI, and shared ERP operational activity feed.

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
- `src/components/ERPForm.tsx`: shared ERP form foundation, section/row/action wrappers, field groups, common input/select/date/textarea/search-select controls, validation messages, and notices.
- `src/components/ERPActions.tsx`: shared action bars, button groups, primary/secondary/danger action buttons, and icon actions with loading/disabled states.
- `src/components/ERPModal.tsx`: shared modal, drawer, and confirm-dialog shells with accessible labels and Escape-key close support.
- `src/components/ERPNotifications.tsx`: shared in-app notification/alert foundation — `ERPNotice`, `ERPAlert`, `ERPBanner`, `ERPSyncAlert`, `ERPOfflineNotice`, `ERPToastStack`, `useERPToastStack`, plus `ERPToastProvider`/`useERPToast` re-exports.
- `src/components/ERPActivityFeed.tsx`: shared operational activity feed — `ERPActivityFeed`, `ERPActivityFeedItem`, `ERPActivityItemTone`. Timeline-style list with tone dots, relative timestamps, status badges, actor/entity metadata lines, detail lines, loading/empty/error states, and compact mode.
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
  ERPActionBar,
  ERPFieldGroup,
  ERPFormSection,
  ERPModal,
  ERPPrimaryAction,
  ERPSecondaryAction,
  ERPTable,
  ERPTablePagination,
  ERPTextField,
  ERPStatusBadge,
  ERPNotice,
  ERPAlert,
  ERPBanner,
  ERPSyncAlert,
  ERPOfflineNotice,
  ERPToastProvider,
  useERPToast,
  ERPActivityFeed,
  FormGroup,
  StackGroup,
} from "@faako/ui";
```

The shell supports registry-driven navigation metadata, module groups, module visibility states, responsive sidebar collapse, mobile bottom navigation, and placeholder slots for offline, sync, notifications, and future organization switching.

The ERP panel/form wrappers intentionally keep legacy class names such as `panel-grid`, `panel`, `panel-header`, `stack`, and `form-field` so apps can adopt them without changing existing CSS or business behavior.

The ERP table components are presentation-only. Apps pass prepared rows, columns, search/filter controls, pagination state, row actions, and status labels. The shared components do not fetch data, filter data, mutate records, enforce permissions, or own workflow validation.

The ERP form components are presentation-only. Apps own form state, validation rules, submit handlers, API calls, permissions, and workflow side effects. Start adoption with settings, profile, simple filters, and read-only/edit-light admin forms; keep payments, bookings, POS checkout, inventory stock adjustments, auth, and other workflow-heavy forms app-owned until separately reviewed.

The ERP modal and action components are presentation-only. Apps own open/close state, confirm/delete/save handlers, validation, submit behavior, API calls, permissions, and side effects. Start adoption with settings/profile modals, simple admin confirmations, and read-only detail drawers; keep payment, booking editor, POS checkout, inventory stock adjustment, auth/session, and offline sync workflow modals app-owned until separately reviewed.

The ERP notification/alert components are presentation-only. `ERPNotice` renders inline contextual notices inside forms, panels, and settings areas. `ERPAlert` renders dismissible page-level alert banners. `ERPBanner` renders full-width page-top system banners without card radius or shadow. `ERPSyncAlert` renders sync queue status based on a status prop (`idle | pending | syncing | synced | failed`). `ERPOfflineNotice` renders an offline indicator when the `offline` prop is true (pass the result of `useOnlineStatus()` from `@faako/offline-sync`). `ERPMaintenanceBanner`, `ERPReadOnlyNotice`, `ERPDegradedNotice`, and `ERPMaintenancePage` provide ERP-specific maintenance/read-only/degraded presentation. Generic `MaintenanceBanner`, `ReadOnlyModeBanner`, `DegradedModeNotice`, `MaintenancePage`, and `MaintenanceGuard` render through neutral `ui-app-mode-*` classes so public/client sites can apply branded maintenance states through app theme tokens and `className` overrides. Apps and APIs must still enforce write restrictions, permissions, and service-state rules. `ERPToastProvider`/`useERPToast` wrap the existing toast context for ERP-namespaced usage. Supported tones: `success`, `error`, `warning`, `info`, `loading`, `offline`, `sync`, `pending`, `maintenance`, `degraded`, `neutral`. Start adoption with settings notices, static informational banners, sync status messages, offline indicators, and maintenance/read-only warnings; keep payment confirmation messages, booking save feedback, inventory adjustment confirmations, and auth/session notices app-owned until separately reviewed.

`ERPActivityFeed` renders a timeline-style operational activity list. Pass `items` as `ERPActivityFeedItem[]` — each item needs an `id`, `actionLabel`, and optional `statusLabel`, `tone`, `actorLabel`, `entityLabel`, `detail`, and `timestamp`. Tones: `success`, `error`, `warning`, `info`, `neutral`. Use `compact` for sidebar/widget contexts. Apps own the data mapping; the component never fetches, writes, or transmits. Do not surface tokens, secrets, passwords, payment details, customer PII, or raw stack traces in any feed item field. Start adoption with settings/admin surfaces backed by already-loaded local data; keep live operational feeds (POS, payments, bookings, orders, inventory adjustments, auth events) app-owned until separately reviewed.

The component accepts optional `className` and `style` props so apps can apply app-specific theming, spacing, or layout overrides without forking. Prefer `className` for theme and spacing concerns; reserve inline `style` for truly dynamic values. CSS uses `--sys-*` theme tokens throughout (text, muted, border, success, danger, warning, accent) with `color-mix` softening, so the feed inherits each app's theme automatically — no app branding is hardcoded into shared styles. Tone modifiers cascade through the item: dot, badge, and detail-text colors all reflect the item's `tone` (default muted; `error` → danger; `warning` → warning).

## Browser And Mobile Rendering

Shared UI form/action controls intentionally reset unwanted native browser styling where the component owns the visual surface. Buttons, ERP actions, icon buttons, field controls, selects, search fields, date/dropdown triggers, and dropdown options use inherited fonts, theme tokens, `appearance: none`, `-webkit-appearance: none`, visible focus states, and touch-friendly sizing. Shared selects use a CSS chevron so Safari/iOS does not render mismatched native controls. Shared app screens, dropdown lists, and maintenance pages keep `vh` fallbacks with `dvh` overrides so mobile browser toolbars do not crop important UI.

## Environment variables

None.

## Setup or migration steps

None. These are frontend shell primitives and do not require migrations.

## Security or data impact

Presentation-only standardization. No auth behavior, route behavior, API permissions, billing, database schema, payment/receipt logic, booking/order/inventory workflows, form submission behavior, form validation behavior, modal open/close state ownership, confirm/delete/save behavior, table data fetching, table filtering, row mutations, or data access changed.

## Known limitations

The placeholder slots are visual/structural only. Backend-backed module toggles, org branding, offline sync, notifications, and multi-tenant controls remain future work.

The new panel/form/table/modal/action wrappers are intentionally small. The form foundation does not replace app validation libraries, server validation, submit handlers, workflow-specific drafts, or mutation logic. The modal/action foundation does not replace confirmation rules, destructive-action policies, or workflow-specific state machines. Deeper mobile POS layout, workflow table, editable table, bulk action, and ERP page-template systems still require app-specific review before extraction.

Shared form and table planning lives in [docs/platform/shared-form-table-system-plan.md](/Users/Nana/Desktop/Developer/faako-system/docs/platform/shared-form-table-system-plan.md). Use that plan before adding table wrappers, pagination controls, filter/action toolbars, modal form shells, or broader workflow form systems.

## Testing notes

Run app builds or lint/type checks for ERP apps that consume these components and verify existing sidebar, topbar, page body, form field, form action, modal/drawer close behavior, confirmation action behavior, panel, table, status badge, pagination, and mobile navigation behavior remains intact.
