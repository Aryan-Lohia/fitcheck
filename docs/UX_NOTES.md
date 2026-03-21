# FitCheck UI inventory (Phase 0)

Reference map for UI-only work. No functional changes.

## Routes → sections → controls

| Route | Sections | Controls / notes |
|-------|----------|------------------|
| `/` | Hero, CTAs | Links |
| `/login` | Form | email, password — use visible labels |
| `/signup` | Form | name, email, password, role |
| `/dashboard` | Header, import form, profile banner, recent list | URL input, links |
| `/profile` | ProfileWizard: hero card, personal details, collapsible sections | selects (gender, fit), measurements, file inputs, pickers |
| `/vault` | Title, storage, uploader, filters, grid | category buttons, sort select (label), FileUploader |
| `/product/[id]` | Gallery, info, size chips, fit card, thread, sticky CTA | textarea, primary button — sticky vs bottom nav spacing |
| `/chat` | Header, new chat, session list | buttons, links |
| `/chat/[id]` | Messages, input | ChatInput, prompts |
| `/book-expert` | Experts, form, calendar, bookings | inputs, textarea, select duration, submit |
| `/booking/[id]` | Back link, detail, timeline, cancel | text, links, button |
| Freelancer pages | Nav + page body | per-page inputs/buttons |
| Admin pages | Sidebar + filters + tables | search, selects, toggles, modals |

## Visibility checklist

- Labels: `htmlFor`/`id` on form controls where missing.
- Touch targets: nav and primary actions ≥ ~44px where feasible.
- Focus: `focus-visible:ring-2` using brand focus token.
- Disabled: readable contrast on light surfaces.
- Sticky layers: product CTA clears fixed bottom nav.
