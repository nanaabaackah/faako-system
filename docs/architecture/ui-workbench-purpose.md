# UI Workbench Purpose

## Decision

`@faako/ui-workbench` is the official React environment for developing and verifying the framework-compatible Faako design system. It remains an internal React/Vite workspace and is not a production application, public website, or business workflow owner.

## Responsibilities

- shared `@faako/ui` component development and visual verification;
- global and application-specific `@faako/theme` preset testing;
- shared layout and responsive shell testing;
- notification, toast, inline notice, and banner testing;
- loading, empty, error, permission-denied, session-expired, and related UX-state examples;
- form control, focus, keyboard, reduced-motion, and contrast checks;
- reusable component documentation through executable examples.

The current workbench already demonstrates theme switching, fields, notices, toast delivery, security states, loading, tables, page headers, cards, and responsive shell foundations.

## Component coverage standard

The workbench should provide a maintained example for each foundational component before broad application adoption:

- Button and icon button
- Input, select, checkbox, and textarea
- Dialog and confirmation dialog
- Card and alert/notice
- Toast
- Loading, empty, error, and skeleton states
- Breadcrumbs and page header
- Data table, search, filter, and pagination where shared

Current gaps are confirmation-dialog interaction, explicit empty/error examples, breadcrumbs, checkbox variants, and a component-level accessibility regression suite. These are workbench improvements, not blockers for Batch 1 application pilots.

## Boundaries

- Do not place app-specific business components or fixtures here.
- Do not call production APIs or require authentication.
- Do not become a second package implementation; components remain owned by `packages/ui` and tokens by `packages/theme`.
- Do not replace product integration tests. The workbench proves shared behavior in isolation; applications prove workflow behavior.
- Do not publish analytics in local development unless explicitly enabled by the existing environment switch.

## Change workflow

1. Add or update the shared component in its existing package.
2. Add an interactive, keyboard-usable workbench example covering relevant states.
3. Run UI package tests plus workbench lint/build.
4. Verify the relevant brand presets and narrow/wide layouts.
5. Pilot the component in one application workflow before mass adoption.

## Quality target

The workbench should eventually add automated interaction/accessibility coverage and screenshot regression coverage. It does not need Storybook unless a later decision demonstrates that the current Vite workbench cannot meet documentation or testing needs.
