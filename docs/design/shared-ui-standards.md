# Shared UI standards

Status: proposed repository standard based on the 2026-07-26 shared UI audit.

## Goals

- Reuse the existing foundation before creating components.
- Keep presentation separate from business workflows, routing, validation,
  data fetching, permissions, and side effects.
- Provide accessible keyboard, screen-reader, touch, reduced-motion, and
  responsive behavior.
- Preserve application branding through semantic tokens and narrow adapters,
  not copied component logic.
- Make neutral components usable by public sites and ERP compatibility
  components usable by back-office applications without forcing one visual
  structure onto every app.

## Package responsibility

| Concern | Owner |
| --- | --- |
| React components and UI state such as toast context | `@faako/ui` |
| Theme tokens, presets, and shared theme CSS | `@faako/theme` |
| Framework-light shell regions, breakpoints, and layout class contracts | `@faako/layout` |
| Module/app-mode/shell metadata and labels | `@faako/config` |
| Notification channel constants, templates, and safe delivery-link helpers | `@faako/notifications` |
| Auth/security normalization and server security helpers | `@faako/security` |
| Framework-independent UI configuration types | `@faako/types` |
| Form validation | `@faako/validation` or app-local schemas when domain-specific |

Do not create `@faako/components`, `@faako/primitives`,
`@faako/design-system`, or another toast/notification package while these
owners exist.

## Selection rule

Before adding local markup or a new shared component:

1. Search `@faako/ui` exports and UI Workbench.
2. Choose the neutral primitive for public or general-purpose presentation.
3. Choose the ERP-prefixed component only when ERP shell classes, form/table
   conventions, or action layout are required.
4. Use a thin app adapter only for routing, icons, brand classes, or transition
   compatibility.
5. Keep domain state and callbacks in the application.
6. Add a new shared component only when:
   - no suitable implementation exists;
   - at least two concrete consumers have compatible semantics, or the
     primitive is a proven accessibility foundation;
   - its API and accessibility behavior are documented;
   - it is demonstrated in UI Workbench;
   - package tests and at least one consumer test exist.

Exact markup alone does not prove shared semantics.

## Canonical component guidance

### Button

- Use `Button` for neutral actions.
- Use `ERPPrimaryAction`, `ERPSecondaryAction`, `ERPDangerAction`, and
  `ERPIconAction` within ERP action bars.
- Every non-submit action must set `type="button"`.
- A destructive action must use the danger tone and must not rely on color
  alone.
- Icon-only buttons require an accessible label.
- Loading buttons must remain disabled against duplicate submission and retain
  a stable accessible name.
- Router links remain links. Do not render navigation as a button solely for
  styling.

### Input and Textarea

- Use `TextField` and `TextareaField` for new neutral forms.
- Use ERP fields only where ERP compatibility styling is needed.
- Always provide a visible label unless the accessible name is supplied by a
  surrounding composite with equivalent clarity.
- Associate hint and error copy through `aria-describedby`.
- Set `aria-invalid` only for an invalid field.
- Do not put server-only values, authorization decisions, or validation policy
  in a field component.

### Select

- Prefer `SelectField` for new general-purpose screens.
- Retain a native or ERP select when native mobile behavior, very large option
  sets, or existing workflow accessibility has not been proven equivalent.
- Options contain display/value/disabled metadata only. Fetching, filtering,
  permissions, and mutations stay outside the component.
- Custom-select keyboard behavior must support opening, closing, Escape,
  directional navigation, selection, focus return, disabled options, and a
  meaningful accessible name.
- Test select popovers inside dialogs and at mobile viewport sizes.

### Checkbox

There is no approved standalone shared Checkbox yet. Until one is added:

- use a native `<input type="checkbox">`;
- pair it with a real `<label>`;
- keep the input operable by keyboard and touch;
- use the `checked` property for controlled state;
- set the native `indeterminate` property for mixed state rather than relying
  only on `aria-checked`;
- group related options with `fieldset` and `legend`;
- keep workflow-specific selection rules in the app.

A future shared Checkbox may own label, description, error, disabled, and
indeterminate presentation. CheckboxGrid and table-selection behavior remain
separate composites.

### Card

- Use `Card` for neutral grouped content and `ErpPanel` for ERP compatibility.
- A card is not automatically interactive.
- Do not add click behavior to the entire card when it contains nested links or
  controls.
- Give section-rendered cards an accessible heading or label when they
  represent a distinct document section.
- Keep domain-specific cards local when they own product, booking, order,
  project, or customer behavior.

### Dialog

`ERPModal` is the existing ERP behavioral base. It contains keyboard focus,
locks background scrolling, restores invoking focus, and supplies accessible
dialog naming. A separate neutral public-site dialog is not yet approved.

Every modal dialog must:

- render only while open;
- expose `role="dialog"` or `role="alertdialog"` and `aria-modal="true"`;
- have an accessible name and optional described-by content;
- move focus to an intentional initial element;
- contain Tab and Shift+Tab focus within the dialog;
- close on Escape when dismissal is allowed;
- restore focus to the invoking control;
- prevent interaction and inappropriate scrolling behind the dialog;
- define whether backdrop dismissal is allowed;
- keep close, cancel, and submit behavior distinct;
- render popovers above the backdrop without breaking focus containment.

`ModalFrame` is presentation only and must not be used as proof of dialog
accessibility.

### Confirmation dialog

- Use `ERPConfirmDialog` only for reviewed ERP flows until dialog hardening is
  complete.
- State the action and consequence in plain language.
- Use a specific confirmation label such as “Delete invoice”, not “Yes”.
- Place the safe cancel action first in keyboard order.
- Do not trigger a destructive confirmation from an unmodified Enter key at
  the dialog container.
- Disable duplicate confirmation while a mutation is pending.
- Keep permission checks and server enforcement outside the dialog.

### Alert and inline notice

- Use `InlineNotice` for contextual feedback within a section or form.
- Use `NoticeBanner` for page-level or cross-section feedback.
- Use ERP-prefixed variants as compatibility/domain wrappers, not as a
  separate tone system.
- Use `role="alert"`/assertive announcements only for urgent errors requiring
  immediate attention.
- Use `role="status"`/polite announcements for success, information, loading,
  sync, and non-urgent warnings.
- Do not dismiss critical information automatically.
- Error copy must explain the problem and, when possible, the recovery action.

### Toast

- Mount the existing provider once through `UiSystemProvider`.
- Use `useToast`; do not create app-local providers.
- Toasts are for transient acknowledgement, not the only record of a failed
  payment, booking, authentication, or other critical state.
- Loading toasts persist until explicitly replaced or dismissed.
- Error toast live-region behavior must be tested before using it for urgent
  failures.
- Do not place secrets, tokens, raw stack traces, payment details, or sensitive
  personal data in toast copy.
- The standalone ERP toast stack should not be selected unless a consumer
  genuinely cannot use the provider.

### Loading state

- Use `AnimatedLoadingState` for route, page, panel, and compact data loading.
- Use `ERPTableLoadingState` only as part of the ERP table system.
- The containing surface should expose busy state while preserving stable
  layout where practical.
- Loading copy should name the object being loaded.
- Never make a decorative animation the only loading signal.
- Respect `prefers-reduced-motion`.

### Empty state

- Use `EmptyState` outside tables.
- Let `ERPTable` own its table empty state.
- Distinguish:
  - first-use empty;
  - no search/filter results;
  - empty because access is restricted;
  - empty because loading failed.
- Provide an action only when the user can meaningfully resolve the state.
- Keep domain-specific copy and actions in the app.

### Error state

There is no neutral shared ErrorState yet.

- Continue using app-owned ErrorBoundary and route error pages because they
  own logging, reset, navigation, and recovery.
- Use an inline notice for recoverable section errors.
- Use SecurityState only for its named security conditions.
- A future ErrorState must accept user-safe title/message/actions and must not
  own logging, exception objects, fetch retries, or router navigation.

### Skeleton

- Use the skeleton layouts built into AnimatedLoadingState when they fit.
- Skeleton shapes are decorative and must be hidden from assistive technology.
- Pair skeletons with a status label or equivalent loading announcement.
- Match the approximate final layout to reduce movement.
- Do not create a standalone Skeleton until multiple consumers require custom
  compositions not covered by existing variants.

### Breadcrumbs

- Use `ErpBreadcrumb` only for its current admin-root React Router contract.
- Do not use it for public sites because it hard-codes the Admin root and
  router implementation.
- Breadcrumb navigation must have an accessible label, ordered hierarchy, and
  `aria-current="page"` on the current item.
- A future neutral Breadcrumbs component must accept rendered links or an
  adapter instead of importing a router directly.
- Route labels and hierarchy stay in the application.

### Page header

- Use `PageHeader` for neutral/public pages.
- Use `ErpPageHeader` inside the ERP shell when metadata and shell-region
  attributes are required.
- Use one page-level `h1`.
- Keep eyebrow, description, metadata, and actions optional.
- On narrow screens, actions must wrap or stack without horizontal overflow.
- `AdminPageHeader` may remain as a legacy class adapter, but new apps should
  import the canonical component directly.

## Styling and theme standards

- Consume semantic `--sys-*` tokens; do not hard-code another application's
  colors into shared CSS.
- Each UI-enabled `appSystem.js` must provide the complete semantic color
  contract used by shared UI: background, elevated background, surfaces,
  text, muted text, borders, accent/contrast/soft, success, warning, danger,
  and information colors.
- App adapters may add classes but should not copy shared interaction logic.
- `compat.css` is a migration layer. New components must use canonical
  `ui-*` or `erp-*` classes rather than adding more broad legacy selectors.
- Component behavior belongs in TS/TSX; tokens/presets belong in theme;
  app-specific spacing and brand overrides belong in app styles.
- Shared components must support 320px-wide layouts, touch targets, visible
  focus, high zoom, and reduced motion.

## API standards

- Extend the appropriate native element attributes.
- Forward refs for form controls and focusable primitives.
- Prefer controlled and uncontrolled native conventions where practical.
- Use `className` for app styling and narrowly scoped props for behavior.
- Avoid boolean combinations that create invalid states; use explicit variants
  or discriminated unions.
- Do not accept API clients, organization records, auth tokens, permission
  functions, or environment objects in foundational components.
- Do not silently retry mutations or perform network requests.
- Preserve user-supplied accessible names and described-by relationships.

## Required verification

For a new or materially changed shared primitive:

1. Type-check and lint `@faako/ui`.
2. Add behavior tests for keyboard, focus, disabled, loading, and ARIA state.
3. Add the component and all states to UI Workbench.
4. Validate at 320px, tablet, and desktop widths.
5. Validate light/dark or every supported token mode that the component uses.
6. Validate 200% zoom and reduced motion.
7. Run at least one public-site and one ERP consumer build when both can use
   the component.
8. For Dialog, Select, Toast, and dynamic feedback, run browser-based
   accessibility tests rather than relying on static markup inspection.

## Adoption sequence

1. Prefer existing neutral primitives in new code.
2. Convert exact app wrappers only after their icon, class, and responsive
   differences are covered.
3. Migrate low-risk raw notices and fields before workflow-heavy dialogs.
4. Harden existing dialog and toast behavior before broad adoption.
5. Pilot a future Checkbox in UI Workbench and one low-risk settings form.
6. Add generic ErrorState, Breadcrumbs, or Skeleton only when concrete
   consumers and compatible behavior are documented.
