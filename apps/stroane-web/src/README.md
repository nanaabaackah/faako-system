# Stroane Frontend Source Map

The React source is organized by product surface first, then by shared browser code.

- `frontend/`: public storefront routes, pages, and storefront-only styles.
- `portal/`: private operations portal routes, shell components, admin API clients, portal context, offline queueing, inventory types, and portal-only styles.
- `components/`, `context/`, `api/`, `data/`, `hooks/`, `utils/`, and `lib/`: browser code that is intentionally shared across surfaces.
- `styles/`: global app styling and shared component styles.

Keep new code in the narrowest surface folder that owns it. Promote code back to a shared root only when both the storefront and portal need the same behavior.
