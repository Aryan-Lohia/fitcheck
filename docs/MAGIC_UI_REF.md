# 21st.dev Magic (visual reference)

**Pass date:** 2025-03-21

We queried **21st Magic** (`21st_magic_component_inspiration`, search: “marketing header nav”) for layout patterns only. Snippets used **shadcn-style** `Button` / `Badge` / `muted` tokens; we did **not** copy registry code or add dependencies.

**Adapted into this repo (tokens only):**

- **Marketing home** (`src/app/page.tsx`): top bar with paired primary/secondary actions mirrors the “centered CTA row” pattern from the returned call-to-action examples; styles use FitCheck `brand-*`, `surface`, and `border-subtle` instead of `primary` / `muted-foreground`.
- **App chrome** (`src/components/layout/app-header.tsx`, `app-bar-auth.tsx`): same idea—clear hierarchy, generous padding, focus rings via `ring-focus`—aligned with the inspiration components’ spacing without changing routes or behavior.

Re-run inspiration anytime via Magic MCP; keep integrations **className / structure only**, forwarding native props on form controls.
