# Prop3000 Portal — Complete Build Specification

Paste this document (plus the attached `prop3000-portal-source.zip`) into Claude to rebuild the app exactly. The zip contains every source file; this document explains the architecture, schema, roles, and behavior so Claude can reconstruct or extend it faithfully.

---

## 1. Business Context

**Prop3000** (Cape Town, South Africa) runs two business lines under one brand:

1. **Prop3000 Developers** — renovations, building, plumbing, electrical, paving, cabinetry, etc.
2. **Prop3000 Investments** — buys distressed/fixer-upper properties fast for cash, publishes listings, manages offers.

Everything previously ran through phone + WhatsApp (081 253 4300). This portal replaces that with structured lead-to-job workflows while keeping WhatsApp links as a parallel channel.

**Company constants** (in `src/lib/prop3000.ts`):
- WhatsApp: `27812534300` (display `081 253 4300`), office `021 705 1867`, email `info@prop3000.co.za`
- Base: Cape Town, coordinates `{ lat: -34.0351, lng: 18.4839 }`
- Currency: ZAR, formatted with `Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 })`

## 2. Tech Stack (exact)

- **Framework:** TanStack Start v1 (React 19, SSR, Vite 7). Routes are file-based under `src/routes/`. No react-router-dom.
- **Styling:** Tailwind CSS v4 via `src/styles.css` with `@theme` OKLCH design tokens. shadcn/ui components. Fonts: **Barlow** family. Theme: **Industrial Navy + Safety Orange** (tokens include `primary-deep`, `accent`, `brick`, `shadow-panel`, `text-display` utility).
- **Backend:** Lovable Cloud (Supabase). Client: `@/integrations/supabase/client`. Server functions: `createServerFn` from `@tanstack/react-start`; privileged work dynamically imports `@/integrations/supabase/client.server` (supabaseAdmin) **inside handlers only**.
- **Auth:** Supabase email/password + Google OAuth. Client-side bearer middleware `attachSupabaseAuth` in `src/start.ts` `functionMiddleware`; `requireSupabaseAuth` middleware guards server functions.
- **Data fetching:** TanStack Query. Authenticated routes use `ssr: false` + `beforeLoad` gate redirecting to `/auth`.
- **Maps:** **Mapbox GL JS** (not Google Maps). Public `pk.` token only — geocoding and directions run **in the browser** (`src/lib/mapbox-client.ts`: `geocodeInBrowser`, `routeInBrowser`) because only a public token is available. `MapCanvas` is loaded via `LazyMap` (browser-only dynamic import, never statically from SSR).
- **Charts:** Recharts (`src/components/portal/Charts.tsx`: `TrendChart`, `StatusPie`, `CountBars`, `MoneyBars`).
- **Toasts:** sonner.

## 3. Roles & Access

`app_role` enum: `'admin' | 'owner' | 'supervisor' | 'agent' | 'client'`. Roles live in `user_roles` (separate table — never on profiles). Helpers: `has_role(uid, role)`, `is_staff(uid)` (admin/owner/supervisor/agent), `is_office(uid)` (admin/owner), `is_agent(uid)` — all `SECURITY DEFINER`.

**Role → home route** (`roleHome` in `src/lib/portal.ts`): admin→`/admin`, owner→`/owner`, supervisor→`/supervisor`, agent→`/agent`, else→`/client`. `/dashboard` redirects per role.

**Demo accounts** (one-click buttons on `/auth`, password `Prop3000#2026`, seeded idempotently by `seedDemoAccounts` server function in `src/lib/admin.functions.ts`):
- `client@prop3000.demo` — Thandi Client
- `admin@prop3000.demo` — Office Admin
- `agent@prop3000.demo` — Riaan Agent
- `supervisor@prop3000.demo` — Sipho Supervisor
- `owner@prop3000.demo` — Leah's Dad

## 4. Database Schema

All tables in `public`, all with RLS enabled, all with explicit GRANTs (`authenticated` + `service_role`; `anon` INSERT-only on public submission tables).

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | id (=auth.users), email, full_name, phone | own read/write; staff read all |
| `user_roles` | user_id, role | unique(user_id, role); own read, office read |
| `service_types` | name, description | public read, office manage |
| `service_requests` | client_id, service_type, description, address, budget_range, photos, status | anon INSERT allowed; status ∈ `new, contacted, quoted, approved, converted, declined` |
| `property_submissions` | client_id, address, property_type, condition, asking_price, photos, status | status ∈ `new, reviewing, viewing_booked, offer_made, accepted, declined, purchased` |
| `jobs` | reference (JOB-xxxx), client_id, supervisor_id, service_request_id, title, address, status, progress (0–100), quote_amount | status ∈ `quoted, approved, in_progress, on_hold, complete, cancelled`; office + assigned supervisor update |
| `job_status_history` | job_id, status, note, changed_by | insert by supervisor/office only; `status` column holds the **job status**, never the reference |
| `job_photos` | job_id, storage_path, caption, uploaded_by | storage-backed |
| `quotes` | reference (Q-xxxx), job_id, client_id, line_items (jsonb), total, vat, status | client can approve/decline own quotes |
| `bookings` | client_id, type, date, time_slot, address, assigned_to, status | status ∈ **`requested, confirmed, completed`** (never `pending`) |
| `listings` | title, address, lat, lng, price, condition, status | status ∈ `draft, published, under_offer, sold`; anon read where status<>'draft'; agents CRUD |
| `offers` | listing_id, client_id, amount, message, status | state machine: `pending → approved / declined / countered`; counter sets `counter_amount` |
| `offer_events` | offer_id, actor_id, action, amount | audit trail |
| `notifications` | user_id, title, body, read | per-user feed |

**Storage buckets** (both private): `lead-photos` (anon+auth INSERT, staff SELECT) and `job-photos` (staff write, job participants read). Storage RLS policies on `storage.objects` scoped by bucket.

**Trigger functions** (`update_updated_at_column`, notification fan-out, etc.): `REVOKE EXECUTE FROM public` — internal only.

## 5. Route Map

**Public** (`SiteLayout` with sticky `SiteHeader` + `SiteFooter`):
- `/` — animated home, hero, both business lines
- `/developers` — renovations services
- `/investments` — cash-sale pitch
- `/listings` (`listings.index.tsx`) — Mapbox map + filterable property list; clicking a map pin navigates to detail (marker click listener with `stopPropagation`, `onPinClick` → pin index → listing id)
- `/listings/$id` — detail: Mapbox location, **RouteFinder** (type any address → geocode → driving route with distance/duration, drawn as GeoJSON on the map), offer submission form
- `/request` — renovation quote request form (with compressed `PhotoUpload`)
- `/sell` — cash-offer property submission form
- `/book` — booking diary (types: site_visit, renovation_start, property_viewing, consultation; hourly slots 08:00–16:00)
- `/contact`, `/auth` (sign in/up, Google, demo-role buttons)

**Authenticated** (`_authenticated/` layout, `ssr:false`, redirects to `/auth`):
- `/dashboard` — role redirect
- `/admin` — lead triage (contacted/quoted/declined), convert lead→job (assign supervisor + quote amount), "Make Cash Offer" on property submissions, booking assign/confirm/cancel
- `/supervisor` — assigned jobs only, status buttons, progress slider, site notes → history, photo upload
- `/owner` — read-only analytics: quoted pipeline, work won + conversion %, listing stock value, acquisition spend, 6-month lead trend, revenue by stage, status pies, demand by trade
- `/client` — approve/decline quotes (line items, total + VAT), live job progress bars, cash-offer WhatsApp link, my requests/bookings/notifications
- `/agent` — offer console: approve / counter / decline
- `/offers` — client offer tracker

Each dashboard uses `PortalShell` (role badge header + shared nav tabs from `portalLinks`) and `StatCard`/`Panel`/`StatusPill`/`Empty` from `src/components/portal/PortalShell.tsx`.

## 6. Key Conventions & Gotchas

1. **Mapbox:** public token in env (`VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN`). Server-side Mapbox calls fail `secret_token_required` — always geocode/route from the browser.
2. **Never SSR map code:** `MapCanvas` only via `LazyMap` dynamic import.
3. **bookings.status** check constraint allows only `requested|confirmed|completed`.
4. **job_status_history.status** must be the job status string, not the JOB reference.
5. Roles never on profiles; use `user_roles` + `has_role` RPC. `setUserRole` server function checks `is_office` before granting/revoking.
6. Every public form allows anonymous submission (`client_id` nullable); WhatsApp deep links (`https://wa.me/27812534300?text=...`) appear on confirmation.
7. Photo upload compresses client-side (for poor rural connectivity), validates type/size, stores in private buckets — never served directly.
8. `STATUS_TONE` map drives all status pill colors; `prettyStatus` humanizes `snake_case`.
9. TypeScript strict flags include `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
10. Every route has its own `head()` with unique title/description/og tags.

## 7. Rebuild Checklist for Claude

1. Scaffold TanStack Start + Tailwind v4 + shadcn; copy `src/styles.css` tokens verbatim.
2. Run migrations in order (in zip under `supabase/migrations/`), then the demo-data seed.
3. Copy `src/` verbatim from the zip; `src/routeTree.gen.ts` regenerates — do not hand-edit.
4. Configure env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, Mapbox public token.
5. Enable Google auth provider; seed demo accounts via `seedDemoAccounts`.
6. Verify: sign in as each demo role → lands on its own dashboard with live data; `/listings` pin click navigates; RouteFinder returns a route for a typed Cape Town address.
