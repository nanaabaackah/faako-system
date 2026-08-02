# Shared UI audit

Status: completed on 2026-07-26.

## Scope and method

This audit covers the existing shared packages and the requested foundational
components:

- Button
- Input
- Select
- Checkbox
- Textarea
- Dialog
- Confirmation dialog
- Card
- Alert
- Toast
- Loading state
- Empty state
- Error state
- Skeleton
- Breadcrumbs
- Page header

The audit inspected package manifests, exports, source, styles, application
imports, app-local component files, and exact cross-application JSX/TSX
matches. Generated files, build output, complete pages, and business workflow
behavior were not treated as shared-component candidates.

No new component or package was created. Existing implementations cover most
of the foundation, and the remaining gaps need API and accessibility decisions
before implementation.

## Executive findings

1. `@faako/ui` is already the correct shared React component package. Creating
   another primitives or design-system package would duplicate it.
2. `@faako/theme` is the correct owner for tokens, presets, and shared theme
   CSS. Application branding should continue to enter through
   `appSystem.js` token overrides.
3. `@faako/layout` and `@faako/config` overlap around ERP shell placeholder
   concepts. They use different key formats and are not yet connected.
4. `@faako/notifications` is not a toast package. It owns notification
   constants, safe message templates, and delivery-link helpers; visual
   notices and toast state correctly live in `@faako/ui`.
5. `@faako/security` is not a UI package. Its current UI relationship is
   limited to `UiSystemProvider` normalizing security-profile/auth-mode
   attributes.
6. Neutral and ERP-prefixed implementations overlap inside `@faako/ui`.
   Some overlap is a deliberate compatibility layer, but alerts, fields,
   page headers, table states, and toast stacks need a documented canonical
   path.
7. Shared adoption is uneven. `SelectField` and `AnimatedLoadingState` are
   widely used, while the shared toast provider is currently demonstrated
   only by System Starter and UI Workbench.
8. Genuine gaps are a standalone Checkbox, a generic ErrorState, a
   router-neutral Breadcrumbs component, a composable Skeleton primitive,
   and a neutral dialog foundation with complete focus management.

## Package ownership and overlap

| Package | What is already reusable | App-specific concerns it must not own | Overlap or risk | Decision |
| --- | --- | --- | --- | --- |
| `@faako/ui` | React primitives, fields, feedback, toast context, ERP form/table/action/modal components, shell components, page headers, cards, empty/loading states | Route trees, form state, validation policy, API calls, permissions, payment/booking/inventory workflows, brand copy | Contains neutral and ERP compatibility layers; root import has CSS side effects; `ErpBreadcrumb` adds router coupling; `UiSystemProvider` adds security coupling | Keep as the single shared React UI owner. Add no competing package. Gradually clarify neutral versus ERP compatibility exports. |
| `@faako/theme` | System token names, font presets, ERP shell CSS, base system CSS | Per-page layout, workflow state, hard-coded organization branding | `ui.css` contains most component styling while `theme` owns shell styling; preset objects provide fonts and rely on app token overrides for colors | Keep separate from UI implementation. Theme owns tokens/presets; UI owns component selectors. Document the required semantic-token contract. |
| `@faako/layout` | Framework-light ERP region names, layout modes, breakpoints, class-name helpers | React components, navigation data, feature flags, permissions | No consumer import was found. Its placeholder-region values use kebab-case while `@faako/config` placeholder slots use camelCase | Keep as a low-level structural package only if it is adopted. Reconcile placeholder terminology with config before expanding it. Do not create another layout package. |
| `@faako/config` | ERP module metadata, shell status/placeholder metadata, application modes, app/project registries | JSX, CSS, toast state, permission enforcement | Overlaps `@faako/layout` in shell placeholder concepts, but config also supplies labels and application metadata | Keep separate. Config owns declarative metadata; layout owns structural class/region contracts. Consolidate duplicate placeholder identifiers in a later compatibility change. |
| `@faako/notifications` | Notification channels/types/statuses, safe text, message templates, mail/WhatsApp link helpers | React alerts, toast rendering, frontend provider state, automatic delivery without consent/audit controls | Name can be mistaken for visual notifications; there is no actual component overlap | Keep separate and non-visual. UI toast/alert components must not be moved here. |
| `@faako/security` | Auth/security profile normalization and server security helpers | Login screens, permission prompts, dialog copy, security-state rendering | `@faako/ui` depends on it through `UiSystemProvider`; `SecurityState` presentation still lives in UI | Keep security logic separate. Consider an optional provider entry point later so importing a basic Button does not conceptually require security configuration. |
| `@faako/types` | `AppSystemConfig`, theme and shell types used by the UI foundation | Runtime rendering and CSS | Supports multiple UI-adjacent packages but does not overlap their runtime responsibility | Keep as the framework-independent contract owner. |

### Current dependency observations

- `@faako/ui` depends on `@faako/theme`, `@faako/security`,
  `@faako/types`, and `@faako/utils`.
- `@faako/ui` does not depend on or consume `@faako/layout`.
- `@faako/config` and `@faako/theme` depend only on
  `@faako/types`.
- `@faako/notifications`, `@faako/layout`, and
  `@faako/security` remain framework-independent.
- Importing the root `@faako/ui` entry imports `system.css`,
  `erp-shell.css`, and `ui.css`. This is convenient for applications but
  makes every root import a style side effect.

## Foundational component inventory

| Foundation | Existing implementation | Reuse status | Duplication or limitation | Decision |
| --- | --- | --- | --- | --- |
| Button | `Button`, `IconButton`; ERP action variants in `ERPActions.tsx` | Suitable now | Neutral and ERP actions overlap by styling/API. Faako Website has a router-aware `PrimaryButton` | Use `Button` for neutral actions and ERP action components for back-office action bars. Keep router-aware/branded link buttons app-local until a polymorphic link API is agreed. |
| Input | `TextField`; `ERPTextField` | Suitable now | Two field chrome APIs exist. Many legacy native inputs remain | Use `TextField` for new neutral/public forms. Use ERP fields where ERP form compatibility classes are required. Do not add another input. |
| Select | `SelectField`; `ERPSelectField`; `CrmSelectField` app wrapper | Suitable now | `SelectField` is a custom trigger/popover with a hidden native control; ERP select is native-styled. Both need distinct regression coverage | `SelectField` is the preferred general component. Retain ERP/native and CRM wrappers where behavior or legacy styling differs. |
| Checkbox | Native checkboxes in apps and inside `ERPTable` | Missing standalone primitive | Checkbox grids are repeated in Faako Website; table selection and workflow checkboxes implement their own markup | This is a valid future shared component candidate. Do not extract workflow groups or table selection logic into it. |
| Textarea | `TextareaField`; `ERPTextareaField` | Suitable now | Same neutral/ERP field overlap as Input | Reuse the matching field family; add no new textarea. |
| Dialog | `ERPModal`, `ERPDrawer`; presentation-only `ModalFrame` | Partially suitable | `ERPModal` supports roles, labels, Escape, and optional backdrop close but does not trap focus, restore focus, set initial focus, or lock background scroll. `ModalFrame` is not a dialog behavior primitive. Many apps retain custom modal markup | Use ERPModal only where its present behavior has been accepted. Do not present `ModalFrame` as an accessible dialog. A neutral hardened dialog may be added only after the current ERP implementation is evaluated as the base. |
| Confirmation dialog | `ERPConfirmDialog` | Partially suitable | It composes ERPModal and currently confirms on Enter at the dialog container, including destructive confirmations | Keep for reviewed ERP flows. Remove implicit destructive Enter confirmation and complete dialog focus behavior before broad adoption. Do not add a second confirmation system. |
| Card | `Card`, `KpiCard`, `ErpPanel`; many domain-specific cards | Suitable now | Card and panel are presentation layers; domain cards often contain meaningful workflow behavior | Use `Card` for neutral composition, `ErpPanel` for ERP compatibility, and keep product/order/project/rental cards app-local. |
| Alert | `InlineNotice`, `NoticeBanner`, `ERPNotice`, `ERPAlert`, `ERPBanner`, `ERPFormNotice`, `SecurityState` | Suitable but overlapping | Multiple components share tone metadata, roles, selectors, and markup. Dev ERP still has many raw `notice is-error` blocks | Treat `InlineNotice` and `NoticeBanner` as neutral canonical surfaces. ERP variants are compatibility/domain wrappers, not a new alert system. Migrate raw notices incrementally. |
| Toast | `ToastProvider`, `ToastViewport`, `useToast`; ERP re-exports and standalone `ERPToastStack`/`useERPToastStack` | Suitable but under-adopted | Two toast state paths exist inside UI. The ERP standalone path has no application consumer in the current scan | `UiSystemProvider` plus `useToast` is canonical. Retain the ERP standalone stack only for a demonstrated provider-free use case; otherwise deprecate later. |
| Loading state | `AnimatedLoadingState`; `ERPTableLoadingState`; app wrappers such as SiteLoader/Loader | Suitable now | App wrappers add layout/brand context. Several pages still use custom spinners or text | Use AnimatedLoadingState for route, page, and panel fetches. Keep thin app loaders only when they select an app-specific layout variant or shell placement. |
| Empty state | `EmptyState`; `ERPTableEmptyState` | Suitable now | Many domain/table empty blocks remain local | Use generic EmptyState outside tables and the table state inside ERPTable. Domain-specific empty copy/actions stay local. |
| Error state | `SecurityState`, ERPTable error rendering, app route ErrorPage/ErrorBoundary implementations | Missing generic state | SecurityState is intentionally security-specific; route boundaries require app logging/recovery; table error reuses empty-state markup | Add a neutral ErrorState only after retry/action semantics and error-reporting boundaries are defined. Keep ErrorBoundary and route error pages app-local. |
| Skeleton | Layout-specific skeleton markup inside `AnimatedLoadingState` | Suitable for current composite loading | No standalone shape/line Skeleton primitive; existing skeleton layouts are tightly coupled to loading variants | Continue using AnimatedLoadingState. Add a composable Skeleton only when at least two consumers need custom layouts not covered by existing variants. |
| Breadcrumbs | `ErpBreadcrumb`; Portal `AdminBreadcrumb` re-export facade | ERP-only | It imports React Router, hard-codes `/admin`, and hard-codes the root label “Admin” | Keep ERP breadcrumb separate. A generic router-neutral Breadcrumbs component is a valid future candidate; do not generalize by copying this implementation. |
| Page header | `PageHeader`, `ErpPageHeader`; Portal `AdminPageHeader` wrapper | Suitable now | Neutral and ERP shell versions overlap; Admin wrapper mainly maps legacy class names | Use PageHeader for neutral/public pages and ErpPageHeader for ERP shell regions/metadata. Keep AdminPageHeader only as a migration facade. |

## Duplicated and app-specific implementations

### Exact cross-application matches

The exact JSX/TSX scan found six cross-application groups:

- Faako ERP and Faako Website `CurrencyContext` (not a UI primitive);
- REEBS Portal and REEBS Website `BackToTop`;
- REEBS Portal and REEBS Website `CartContext` (not a UI primitive);
- REEBS Portal and REEBS Website `Icon`;
- REEBS Portal and REEBS Website `PartyConfetti`;
- REEBS Portal and REEBS Website `SearchField`.

Only SearchField is directly in this foundational scope. Both copies already
delegate behavior to `@faako/ui/SearchField`; the duplicated wrapper supplies
REEBS icons and legacy classes. It is temporary brand-adapter duplication, not
a reason to add a new shared primitive.

### Structural duplication

- Dev ERP, REEBS Portal, and Stroane Portal contain many workflow modals.
  Stroane has adopted `ERPModal` more broadly; Dev ERP and REEBS still retain
  significant custom `role="dialog"` markup.
- Faako Website repeats CheckboxGrid patterns between Signup and ClientSetup.
  The generic checkbox item can be shared later, while form-specific option
  groups, validation, and state paths should remain local.
- Dev ERP has many raw `notice is-error` alert blocks despite the shared
  feedback components.
- REEBS Portal keeps `InlineNotice`, `AdminPageHeader`, SearchField, and loader
  wrappers around shared components to preserve legacy class and icon
  contracts.
- Public applications have branded cookie-consent dialogs and route error
  pages. Their consent categories, legal copy, analytics behavior, navigation,
  and recovery actions are application concerns.

### What should remain separate

- Payment, booking, invoice, inventory, checkout, and destructive workflow
  dialogs.
- Complete form sections and their validation/submission state.
- Router-specific links and navigation decisions.
- Cookie-consent state and legal copy.
- Error boundaries, logging integration, and route-level recovery.
- Product, project, rental, customer, KPI, and other domain cards.
- App shell placement and branded loader wrappers.
- Portal auth state, permissions, and admin actions.

## Risks and quality gaps

1. Dialog accessibility is incomplete. Broad migration would reproduce missing
   focus containment/restoration and background interaction controls.
2. `ERPConfirmDialog` handling Enter as confirmation is unsafe for destructive
   actions.
3. `SelectField` is complex custom-select code. It needs keyboard, screen
   reader, mobile, and modal/popover regression coverage before replacing all
   native selects.
4. `ERPTable` exposes mixed selection through `aria-checked` but does not set
   the native checkbox `indeterminate` property.
5. Error toasts currently render through the same status-oriented toast markup
   as non-critical messages. Live-region severity should be tested.
6. Neutral and ERP feedback components duplicate tone metadata and rendering.
7. The root UI entry mixes primitives, ERP shell components, analytics,
   security presentation, update polling, and global CSS side effects. This is
   workable but makes tree-level ownership less obvious.
8. `@faako/layout` currently has no discovered consumer and conflicts with
   config placeholder naming. Expanding either contract before reconciliation
   would deepen duplication.
9. `system.css` defines structural defaults while complete semantic colors are
   supplied by each app's token overrides. A missing or partial `appSystem`
   theme can leave shared components without a complete visual baseline.

## Recommended order

1. Adopt the standards in `shared-ui-standards.md`; add no package.
2. Add tests and accessibility hardening to the existing dialog and toast
   foundations.
3. Reconcile layout/config placeholder identifiers without changing app
   behavior.
4. Pilot raw-alert replacement in one low-risk Dev ERP settings surface.
5. Design a standalone Checkbox API and test it in UI Workbench before app
   adoption.
6. Only then consider neutral Dialog, ErrorState, Breadcrumbs, or composable
   Skeleton additions, reusing existing code where possible.

## Verification

- `@faako/ui` lint: passed.
- `@faako/ui` type-check: passed.
- `@faako/theme` type-check: passed.
- `@faako/layout` type-check: passed.
- `@faako/notifications` tests: 5 passed.
- `@faako/config` tests: 4 passed.
- `@faako/security` lint: passed.
- Git whitespace validation: passed.
