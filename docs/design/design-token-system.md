# Design token system

Status: target standard documented on 2026-07-26. No application styles,
components, token values, or visuals were changed by this task.

Related standards:

- `docs/design/shared-ui-audit.md`
- `docs/design/shared-ui-standards.md`

## Purpose

The repository needs one structural design foundation without making Faako,
REEBS, Stroane, The Thriving Network GH (TTNGH), and By Nana look like the
same brand.

The target system separates:

1. global foundation tokens for consistent spacing, typography scales,
   breakpoints, radii, shadows, motion, sizing, and semantic color roles;
2. app-owned brand tokens for identity;
3. semantic `--sys-*` mappings consumed by shared UI;
4. narrow `--ui-*` and `--erp-*` component overrides.

This document defines the target contract and a non-visual adoption path. It
does not authorize mass replacement of existing CSS values.

## Audit scope

The audit inspected:

- `packages/theme`
- `packages/layout`
- `packages/ui`
- UI-related contracts in `packages/types` and `packages/config`
- app-level `appSystem.js` mappings
- global and component CSS for Faako Website and Faako ERP
- REEBS Website and REEBS Portal
- Stroane Website and Portal
- By Nana Portfolio
- the locally available TTNGH foundation build artifact

Generated sources and backend code were excluded from token ownership.

## Current system

### Shared package responsibilities

| Package | Current responsibility | Target responsibility |
| --- | --- | --- |
| `@faako/theme` | Font presets, minimal root system CSS, ERP shell CSS | Canonical foundation token values, brand preset registration, and shared theme CSS |
| `@faako/layout` | ERP layout modes, region names, 900/901 shell breakpoint, class helpers | Framework-light layout constants and canonical breakpoint registry |
| `@faako/ui` | React components and approximately 4,400 lines of canonical plus compatibility CSS | Consume semantic/foundation tokens and expose component-scoped override hooks; do not define brand identity |
| `@faako/types` | Open `Record<string, string>` theme token contracts | Framework-independent token/preset types; later add known token-name validation without blocking extensions |
| `@faako/config` | ERP module, shell placeholder, and app-mode metadata | Continue to own metadata, not visual token values |

### Existing global foundation

`packages/theme/src/system.css` currently defines only:

- `--sys-font-body`
- `--sys-font-display`
- `--sys-shadow-sm`
- `--sys-shadow-md`
- `--sys-shadow-lg`
- `--sys-radius-sm`
- `--sys-radius-md`
- `--sys-radius-lg`
- `--sys-page-max-width`

The default shadows are `none`; the default radii are 5px, 10px, and 18px;
the page maximum is 1180px.

Shared UI also consumes semantic colors such as `--sys-text`,
`--sys-muted`, `--sys-border`, `--sys-surface`, and `--sys-accent`. These are
not complete fallback values in `system.css`; applications supply them through
`appSystem.js`.

There is no shared spacing scale, type-size scale, line-height scale, motion
scale, control-size scale, icon-size scale, container scale, or complete
breakpoint registry.

### Current semantic color mapping

The versioned UI-enabled applications generally map these roles through
`appSystem.js`:

- background and elevated background;
- surface and strong surface;
- border and strong border;
- text and muted text;
- accent, accent contrast, and accent soft;
- success, warning, danger, and information roles with soft variants;
- danger contrast;
- small, medium, and large shadows;
- overlay.

ERP applications additionally provide `--erp-*` shell mappings.

This is the right architecture. It needs a complete fallback contract and
consistent non-color foundations.

## Audit findings

### Foundation gaps

1. `--sys-radius-pill` is consumed by `@faako/ui` but is not defined by the
   shared theme or any app mapping. The affected border-radius declaration can
   therefore become invalid.
2. `--sys-color-scheme` is optional and falls back locally to light instead of
   being part of the documented app theme contract.
3. `--sys-table-*` roles are defined in compatibility or app styles rather
   than as documented component tokens.
4. Shared component CSS contains many raw spacing, font-size, control-size,
   duration, and easing values because no foundation scale exists.
5. The token type accepts any string key and does not detect misspelled or
   missing required roles.

### Typography preset gaps

| Surface | Current application typography | Current shared preset behavior | Finding |
| --- | --- | --- | --- |
| Faako Website | Manrope body, Inter display, Fraunces hero plus expressive local fonts | Inter body/display | Shared components do not follow the app body family. Preserve the deliberate editorial families while explicitly mapping shared UI. |
| Faako ERP | IBM Plex Sans | IBM Plex Sans | Aligned. |
| REEBS Website/Portal | Nunito body, Baloo 2 display, Modak/expressive headings | Nunito body, Baloo 2 display | Aligned for shared UI; expressive public headings remain brand-local. |
| Stroane | Inter | No `stroane-web` preset; resolver falls back to Core Neutral/IBM Plex Sans | Missing preset causes shared UI typography to diverge from Stroane. |
| TTNGH | Inter in the current foundation artifact | No tracked source or preset | The brand is not integrated into the shared theme. |
| By Nana | Inter body, Feyora headings, Bastliga title treatment | Space Grotesk body/display | Preset and application typography disagree. Expressive title/heading faces must remain brand-owned. |

### Breakpoint fragmentation

The CSS audit found these clusters:

- shared UI/theme: 420, 700, 720, 760, 780, and 900px;
- Faako: 420, 480, 620, 680, 700, 760, 900, 980, 1000, 1024, 1100,
  1120, and 1200px;
- REEBS: values from 420 through 1500px, with heavy use of 720, 760, 900,
  980, and 1100px;
- Stroane: 480, 560, 620, 640, 760/768, 860, 900/901, 960, 1024, and
  1180px;
- By Nana: 520, 640, 680, 720, 760, 900, 960, 980, 1080, 1100, 1120,
  1200, and 1260px.

These values often reflect component-specific layout needs and must not be
globally rewritten without screenshots. New work should use the canonical
registry below.

### Motion defects and overlap

- REEBS defines `--transition-fast` and `--transition-slow` as motion values.
- REEBS defines `--transition-base` as a box-shadow value:
  `rgba(33, 35, 38, 0.1) 0px 20px 30px -20px`.
- The same REEBS token is used both as a shadow and as the timing part of
  multiple transition declarations, making those transition declarations
  invalid.
- Stroane Header CSS consumes `--transition-base`, but no Stroane definition
  was found.
- Many shared and app styles use isolated 140ms, 160ms, 180ms, 200ms, 220ms,
  260ms, 300ms, 320ms, 360ms, 420ms, and 450ms timings.

Motion and shadow roles must never share a token.

### Layout/config overlap

`@faako/layout` defines kebab-case visual placeholder regions such as
`offline-indicator`, while `@faako/config` defines camelCase metadata slots
such as `offlineIndicator`. `@faako/layout` currently has no discovered
consumer. Reconcile these identifiers before adding more layout tokens.

### TTNGH source status

`apps/ttngh` currently has no tracked source, manifest, or configuration in
Git. A local `dist/index.html` foundation artifact exists and shows:

- Thriving Pink `#E52477`;
- Soft Blush Pink `#F5E4EC`;
- black `#0A0A0A`;
- charcoal `#4E4B4C`;
- white `#FFFFFF`;
- Inter/system typography;
- a 760px responsive rule;
- reduced-motion handling.

These values are evidence for the future TTNGH brand preset, not an
authoritative source module. Token integration should happen when the scaffold
is intentionally restored to the repository.

## Target token architecture

### Layer 1: global foundation

Global foundation tokens use `--sys-*` and contain non-brand defaults:

- spacing scale;
- type sizes, weights, line heights, and tracking;
- breakpoint constants;
- radii;
- elevation/shadows;
- motion durations and easing;
- control, icon, touch, and container sizing;
- semantic color roles with safe neutral fallback values.

Shared UI consumes this layer.

### Layer 2: app brand source

Each brand owns `--brand-*` source tokens:

- primary, secondary, and accent colors;
- brand ink and brand surfaces;
- body, display, and expressive font families;
- optional brand-specific shape/elevation decisions;
- public-site decorative gradients, textures, illustrations, and glow values.

Brand tokens express identity. Shared components should not reference another
application's legacy variables directly.

### Layer 3: semantic mapping

Each `appSystem.js` maps brand or legacy values to semantic `--sys-*` roles:

```js
tokenOverrides: {
  "--sys-bg": "var(--brand-bg)",
  "--sys-surface": "var(--brand-surface)",
  "--sys-text": "var(--brand-ink)",
  "--sys-accent": "var(--brand-primary)",
  "--sys-accent-contrast": "var(--brand-on-primary)",
}
```

During compatibility adoption, the source may remain an existing legacy token:

```js
"--sys-accent": "var(--accent)"
```

No visual change occurs until the source value itself changes.

### Layer 4: component and shell overrides

- `--ui-*` customizes one shared component or component family.
- `--erp-*` customizes ERP shell and back-office presentation.
- Component tokens fall back to semantic `--sys-*` roles.
- Component tokens must not become an alternate global palette.

## Naming rules

| Prefix | Meaning | Example |
| --- | --- | --- |
| `--sys-*` | Stable global foundation or semantic role | `--sys-space-4`, `--sys-text`, `--sys-duration-fast` |
| `--brand-*` | Application identity source | `--brand-primary`, `--brand-font-expressive` |
| `--ui-*` | Shared component-scoped override | `--ui-toast-width` |
| `--erp-*` | ERP shell/back-office override | `--erp-sidebar-bg` |
| existing unprefixed tokens | Compatibility source during migration | `--accent`, `--surface-3`, `--color-primary` |

New shared CSS must not introduce unprefixed global tokens.

## Foundation scales

The values below are the target for new shared work. They are not a command to
replace existing application values in bulk.

### Spacing

| Token | Value | Typical use |
| --- | ---: | --- |
| `--sys-space-0` | `0` | Reset |
| `--sys-space-1` | `0.25rem` | Tight inline separation |
| `--sys-space-2` | `0.5rem` | Compact control/icon gap |
| `--sys-space-3` | `0.75rem` | Compact padding |
| `--sys-space-4` | `1rem` | Default gap/padding |
| `--sys-space-5` | `1.25rem` | Card/control group |
| `--sys-space-6` | `1.5rem` | Section/card padding |
| `--sys-space-8` | `2rem` | Page subsection |
| `--sys-space-10` | `2.5rem` | Large section gap |
| `--sys-space-12` | `3rem` | Section rhythm |
| `--sys-space-16` | `4rem` | Large page rhythm |
| `--sys-space-20` | `5rem` | Hero/marketing rhythm |
| `--sys-space-24` | `6rem` | Major public-page section |

Rules:

- Prefer the scale for new shared component spacing.
- Use `clamp()` for page gutters and marketing-section rhythm when needed.
- Preserve app-local decorative composition and intentional optical offsets.
- Negative space uses `calc(-1 * var(--sys-space-*));` rather than separate
  negative token names.

### Typography

#### Family roles

| Token | Purpose |
| --- | --- |
| `--sys-font-body` | General UI and prose |
| `--sys-font-display` | Shared headings and prominent labels |
| `--brand-font-body` | App identity source for body mapping |
| `--brand-font-display` | App identity source for shared headings |
| `--brand-font-expressive` | App-only editorial, logo, or hero treatment |

Shared UI must use body/display roles only. Expressive brand fonts remain
app-owned.

#### Size scale

| Token | Value |
| --- | ---: |
| `--sys-text-xs` | `0.75rem` |
| `--sys-text-sm` | `0.875rem` |
| `--sys-text-md` | `1rem` |
| `--sys-text-lg` | `1.125rem` |
| `--sys-text-xl` | `1.25rem` |
| `--sys-text-2xl` | `1.5rem` |
| `--sys-text-3xl` | `1.875rem` |
| `--sys-text-4xl` | `2.25rem` |
| `--sys-text-5xl` | `3rem` |
| `--sys-text-6xl` | `3.75rem` |

Hero/display sizes may use app-owned fluid `clamp()` values.

#### Supporting roles

| Category | Tokens and values |
| --- | --- |
| Weight | `--sys-weight-regular: 400`, `medium: 500`, `semibold: 600`, `bold: 700`, `extrabold: 800` |
| Line height | `--sys-leading-tight: 1.1`, `snug: 1.3`, `normal: 1.5`, `relaxed: 1.7` |
| Tracking | `--sys-tracking-tight: -0.02em`, `normal: 0`, `wide: 0.08em` |

### Breakpoints

CSS custom properties cannot reliably be used in ordinary media-query
conditions. Canonical breakpoints should be exposed as constants from
`@faako/layout` and repeated as literals in plain CSS until a custom-media
build step is adopted.

| Name | Value | Purpose |
| --- | ---: | --- |
| compact | `480px` | Narrow phone adjustments |
| small | `640px` | Phone-to-small-tablet composition |
| medium | `768px` | Tablet and common content reflow |
| shell | `900px` / desktop begins `901px` | Existing ERP navigation boundary |
| large | `1024px` | Desktop layout |
| wide | `1200px` | Wide content/grid layout |

Rules:

- Use mobile-first `min-width` rules for new components where practical.
- The ERP 900/901 boundary is preserved.
- Component-specific intrinsic breakpoints are allowed when driven by
  content, preferably through container queries.
- Existing 700/720/760/780, 980, 1100/1120/1180, 1260, 1400, and 1500 rules
  are compatibility values. Migrate only with screenshot comparison.

### Radius

| Token | Value |
| --- | ---: |
| `--sys-radius-none` | `0` |
| `--sys-radius-xs` | `4px` |
| `--sys-radius-sm` | `8px` |
| `--sys-radius-md` | `12px` |
| `--sys-radius-lg` | `18px` |
| `--sys-radius-xl` | `24px` |
| `--sys-radius-full` | `9999px` |
| `--sys-radius-pill` | `var(--sys-radius-full)` |

Brand-specific shapes may override mappings intentionally:

- REEBS may retain its rounded, playful 12/16/24/32px language.
- By Nana may retain 16/28px and curved editorial surfaces.
- Faako public marketing may retain 14/24/32px forms.
- Stroane may retain 8/12/20px.
- TTNGH may retain welcoming rounded cards and pill calls to action.

The token name expresses role; the brand may vary its value.

### Shadows and elevation

| Token | Default role |
| --- | --- |
| `--sys-shadow-none` | `none` |
| `--sys-shadow-xs` | subtle control separation |
| `--sys-shadow-sm` | card/small popover |
| `--sys-shadow-md` | dropdown/sticky surface |
| `--sys-shadow-lg` | dialog/drawer |
| `--sys-shadow-focus` | keyboard focus ring; derive from accent |
| `--sys-overlay` | modal/background overlay color |

Default neutral values should use low-alpha neutral ink. Brand mappings may
retain green-tinted Faako shadows, charcoal REEBS shadows, neutral Stroane
elevation, or soft By Nana editorial shadows.

Do not encode a shadow value in a motion token.

### Motion

| Token | Value |
| --- | ---: |
| `--sys-duration-instant` | `0ms` |
| `--sys-duration-fast` | `120ms` |
| `--sys-duration-normal` | `200ms` |
| `--sys-duration-slow` | `320ms` |
| `--sys-duration-emphasis` | `420ms` |
| `--sys-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--sys-ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--sys-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--sys-ease-emphasis` | `cubic-bezier(0.2, 0.7, 0.2, 1)` |

Rules:

- Animate opacity and transform before layout properties.
- Use fast for hover/focus, normal for controls/popovers, slow for
  drawers/panels, and emphasis only for intentional brand storytelling.
- Loading animation duration may be component-scoped.
- Under `prefers-reduced-motion: reduce`, remove non-essential movement,
  scrolling effects, parallax, and repeated animation. State changes must
  remain understandable without motion.
- Expressive By Nana, Faako, and REEBS motion may remain app-specific but must
  use reduced-motion alternatives.

### Sizing

#### Controls and touch

| Token | Value |
| --- | ---: |
| `--sys-control-sm` | `2rem` / 32px |
| `--sys-control-md` | `2.5rem` / 40px |
| `--sys-control-lg` | `2.75rem` / 44px |
| `--sys-control-xl` | `3rem` / 48px |
| `--sys-touch-min` | `2.75rem` / 44px |

Interactive controls intended for touch should meet the 44px minimum unless
spacing around a compact target provides an equivalent accessible target.

#### Icons

| Token | Value |
| --- | ---: |
| `--sys-icon-sm` | `1rem` |
| `--sys-icon-md` | `1.25rem` |
| `--sys-icon-lg` | `1.5rem` |
| `--sys-icon-xl` | `2rem` |

#### Containers

| Token | Value |
| --- | ---: |
| `--sys-container-sm` | `640px` |
| `--sys-container-md` | `768px` |
| `--sys-container-lg` | `960px` |
| `--sys-page-max-width` | `1180px` (preserve current shared value) |
| `--sys-container-wide` | `1280px` |
| `--sys-page-gutter` | `clamp(1rem, 3vw, 2rem)` |

Header heights, side rails, footer reveals, hero heights, media aspect ratios,
and ERP sidebar widths remain app/shell tokens.

## Base color roles

### Required semantic roles

| Role | Meaning |
| --- | --- |
| `--sys-bg` | Application/page canvas |
| `--sys-bg-elevated` | Raised canvas or alternate page region |
| `--sys-surface` | Default component surface |
| `--sys-surface-strong` | Opaque/high-emphasis surface |
| `--sys-text` | Primary readable text |
| `--sys-muted` | Secondary readable text |
| `--sys-border` | Subtle structural border |
| `--sys-border-strong` | Strong/focus-adjacent border |
| `--sys-accent` | Primary interactive emphasis |
| `--sys-accent-contrast` | Text/icon on accent |
| `--sys-accent-soft` | Low-emphasis accent background |
| `--sys-success` / `--sys-success-soft` | Successful state only |
| `--sys-warning` / `--sys-warning-soft` | Caution state only |
| `--sys-danger` / `--sys-danger-soft` / `--sys-danger-contrast` | Destructive/error state only |
| `--sys-info` / `--sys-info-soft` | Informational state |
| `--sys-overlay` | Backdrop or obscuring layer |
| `--sys-focus` | Keyboard focus indicator |

Rules:

- Semantic state colors are not decorative brand slots.
- Text/background combinations must be contrast-tested in every supported
  theme.
- Muted text still needs readable contrast.
- Accent contrast must be explicit; do not assume white or black.
- Dark mode remaps semantic roles and does not invert every literal.
- Component-specific table, toast, sidebar, or loading colors fall back to
  these roles.

## Brand preservation

### Faako

Current identity:

- green accent `#388364`;
- deep green `#235842`;
- mint `#68C8A2`;
- light canvas `#FBFBFB`;
- dark-mode orange accent currently used by the public site;
- Manrope/Inter/Fraunces and expressive public faces;
- IBM Plex Sans in ERP.

Target:

- one Faako brand source for core colors;
- separate Website and ERP typography mappings;
- editorial hero fonts remain public-site tokens;
- ERP shell continues to map through `--erp-*`;
- do not replace the public dark-mode personality with the ERP palette.

### REEBS

Current identity:

- orange `#FE7733`;
- green `#74B53F`;
- amber/orange `#FF9932`;
- charcoal `#3A3F45`;
- dark ink `#23262C`;
- Nunito body, Baloo 2 display, expressive Modak/brand headings;
- rounded 12/16/24/32px forms and playful motion.

Target:

- Website and Portal share REEBS brand source tokens;
- Portal maps the same identity into ERP semantic/shell roles;
- public expressive typography and imagery remain Website-owned;
- fix motion token naming without altering timing or shadow appearance.

### Stroane

Current identity:

- primary blue `#2563EB`;
- light blue `#60A5FA`;
- dark navy `#071640`;
- cyan accent `#0EA5E9`;
- Inter typography;
- clean 8/12/20px radii and neutral elevation.

Target:

- register an explicit Stroane theme preset;
- map shared UI typography to Inter;
- preserve storefront and portal surface differences through semantic and
  `--erp-*` mappings;
- define motion roles used by Header instead of borrowing an undefined token.

### TTNGH

Current approved identity and foundation evidence:

- Thriving Pink `#E52477`;
- Soft Blush Pink `#F5E4EC`;
- black `#0A0A0A`;
- charcoal `#4E4B4C`;
- white `#FFFFFF`;
- modern compassionate and uplifting presentation;
- welcoming rounded forms, not clinical or gloomy styling.

Target when tracked source returns:

- add a `ttngh` preset rather than copying another brand;
- use pink as interactive/brand emphasis, not as every semantic state;
- keep danger, warning, success, and information roles semantically distinct;
- use Inter/system body typography initially unless approved brand fonts are
  supplied;
- preserve the reduced-motion foundation.

### By Nana

Current identity:

- warm beige surfaces `#E8E3D4`, `#F3EEE0`, `#DDD6C3`, `#EBE5D4`;
- brown accent `#5E4B3B`;
- dark text `#3C3C3C`;
- dark-theme blue-gray accent `#6B7B84`;
- Inter body, Feyora headings, Bastliga title treatment;
- soft editorial shadows and 16/28px curves.

Target:

- align the shared preset with the actual Inter body;
- keep Feyora/Bastliga as brand expressive roles, not global UI fonts;
- preserve light/dark editorial palettes and curved composition;
- shared controls use semantic roles without flattening the portfolio into an
  ERP visual style.

## Compatibility mapping table

| Brand/surface | Existing brand source | Semantic destination |
| --- | --- | --- |
| Faako Website | `--bg`, `--surface`, `--ink`, `--muted`, `--accent` | `--sys-bg`, `--sys-surface`, `--sys-text`, `--sys-muted`, `--sys-accent` |
| Faako ERP | Same core names plus ERP state tokens | Same semantic roles plus `--erp-*` |
| REEBS Website | `--bg-base`, `--surface`, `--text-main`, `--muted`, `--other`/`--accent` | Global semantic roles |
| REEBS Portal | Shared REEBS values plus admin/shell values | Global semantic roles plus `--erp-*` |
| Stroane | `--color-bg`, `--color-surface`, `--color-text-*`, `--color-primary` | Global semantic roles plus portal `--erp-*` |
| TTNGH | `--paper`, `--surface`, `--ink`, `--ink-soft`, `--accent` in local artifact | Future global semantic roles |
| By Nana | `--surface-*`, `--text-*`, `--line`, `--accent` | Global semantic roles |

Legacy tokens remain valid sources during migration. They should not be copied
into new shared packages.

## Adoption plan without redesign

### Phase 1: contract and tests

1. Add complete neutral fallback tokens to `@faako/theme`.
2. Add known-token typing/validation while preserving extension keys.
3. Add explicit Stroane, TTNGH, and corrected By Nana/Faako typography
   presets.
4. Add token-contract tests that verify required semantic roles resolve.
5. Add the canonical breakpoint registry to `@faako/layout`.

Each new token must initially resolve to the application's current computed
value.

### Phase 2: compatibility aliases

1. Introduce `--brand-*` aliases in each app that point to current values.
2. Map current `--sys-*` roles through those aliases.
3. Define spacing, motion, radius, sizing, and typography scales without
   changing existing selectors.
4. Correct missing/invalid tokens using equivalent current values.

No bulk selector migration occurs in this phase.

### Phase 3: low-risk shared adoption

1. Move `@faako/ui` raw foundation values to the new scales.
2. Validate UI Workbench across all presets.
3. Pilot one low-risk shared component in one public app and one ERP app.
4. Capture before/after screenshots and computed token values.

### Phase 4: app migration

Migrate one brand and component family at a time:

1. base/shared controls;
2. alerts and loading states;
3. cards and tables;
4. shell/layout;
5. public marketing sections last.

Do not combine token migration with framework migration, page redesign, or
business workflow changes.

## Definition of done for future implementation

- Every shared UI semantic token has a neutral fallback.
- Every UI-enabled app declares an explicit registered preset.
- Each brand retains its approved colors and typography.
- Shared spacing, type, radius, shadow, motion, and sizing scales exist.
- Breakpoint constants exist in `@faako/layout`; new CSS follows the registry.
- Reduced-motion behavior is tested.
- Required color pairs meet accessibility contrast requirements.
- No undefined shared tokens remain.
- Token tests, UI Workbench states, and representative app builds pass.
- Screenshot comparison confirms no unintended visual redesign.

## Verification for this audit

- `@faako/theme` type-check: passed.
- `@faako/layout` type-check: passed.
- `@faako/ui` type-check: passed.
- `@faako/ui` lint: passed.
- Git whitespace validation: passed.
- No conflict markers were found in this document.
- No tracked TTNGH source was found.
- No application CSS, shared token source, component, or visual behavior was
  changed.
