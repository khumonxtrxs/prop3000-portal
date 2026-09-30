# Handoff: Prop3000 Portal (public site + 5 role dashboards)

## Overview

Prop3000 is a Cape Town property company with two divisions: **Prop3000 Developers**
(renovations, building and trades) and **Prop3000 Investments** (buys distressed property for
cash, and lists property for sale). This handoff covers the complete customer-facing website
plus the five authenticated role dashboards that run the business: client, office admin,
listing agent, site supervisor and owner.

The portal replaces phone-and-WhatsApp coordination. A homeowner requests a quote or submits a
property without calling; office staff triage leads into jobs; supervisors push status and
photo updates; buyers submit offers on listings and agents approve, counter or decline them;
the owner sees analytics across both divisions.

## About the design files

The files in `design-reference/` are a **design reference created in HTML** — a working
prototype that shows intended look and behaviour. **They are not production code to copy.**

`Prop3000 Portal.dc.html` opens directly in a browser. It is a single self-contained
prototype with a **dark "Demo role" bar across the top**: click `Public site`, `Client`,
`Admin`, `Agent`, `Supervisor` or `Owner` to jump into any workspace. Every flow described
below is clickable in it — submit an offer, counter it as the agent, accept the counter as
the client, convert a lead to a job, drag a job's progress slider.

Its internals (a template + logic class, inline styles, Leaflet maps, in-memory arrays) are
prototype scaffolding. **Ignore the implementation; take the design.**

The job is to **recreate these designs inside the existing PROP3000 codebase** using its
established patterns — not to ship this HTML.

## Fidelity

**High fidelity.** Colours, typography, spacing, copy, status vocabulary and interaction
behaviour are all final and should be matched closely. Exact hex values are listed in
§Design tokens; the prototype is the tiebreaker for anything not written down.

Photography is **not** final: the prototype uses drop-in image placeholders and diagonal
hatch fills wherever a real photo belongs. Use the client's real photos (see §Assets).

## The target codebase

The repo already contains the routes, database and UI primitives. **This is a restyle-and-
complete job, not a greenfield build.**

| Layer | What's there |
|---|---|
| Framework | TanStack Start + TanStack Router (file routes in `src/routes/`), React 19, Vite 8 |
| Styling | Tailwind v4 with an oklch token system in `src/styles.css` (`--primary`, `--accent`, `--brick`, `--success`…) |
| Components | shadcn/ui in `src/components/ui/` (button, card, badge, table, select, slider, progress, sonner, chart…) |
| Data | Supabase (`@supabase/supabase-js`), schema + RLS in `supabase/migrations/` |
| Forms | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Maps | `mapbox-gl` via `src/components/MapCanvas.tsx` and `LazyMap.tsx` (token: `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN`) |
| Charts | `recharts` via `src/components/ui/chart.tsx`, plus `src/components/portal/Charts.tsx` |
| Toasts | `sonner` |
| Icons | `lucide-react` |

Constraints:
- **Use the existing stack.** No new UI kit, no CSS-in-JS, no Leaflet (the prototype's
  Leaflet/OpenStreetMap maps become Mapbox through `LazyMap`).
- **No inline styles.** Everything through Tailwind utilities and the `styles.css` tokens.
- **Statuses come from the DB enums** (§Status vocabulary). One `prettyStatus()` helper and
  one `<StatusBadge>` component, used everywhere.
- `AGENTS.md`: this branch syncs to Lovable — don't rewrite pushed history.

### Route → design mapping

| Existing file | Design screen |
|---|---|
| `src/routes/index.tsx` | Home |
| `src/routes/developers.tsx` | Developers / Our Services |
| `src/routes/investments.tsx` | Investments / cash sale |
| `src/routes/listings.index.tsx` | Listings map + filter list |
| `src/routes/listings.$id.tsx` | Listing detail + RouteFinder + offer form |
| `src/routes/request.tsx` | Request a quote form |
| `src/routes/sell.tsx` | Sell for cash form |
| `src/routes/book.tsx` | Book a date form |
| `src/routes/contact.tsx` | Contact |
| `src/routes/auth.tsx` | Sign in + demo accounts |
| `src/routes/_authenticated/client.tsx` | Client portal (quotes, requests, bookings) |
| `src/routes/_authenticated/offers.tsx` | Client "My offers" |
| `src/routes/_authenticated/admin.tsx` | Lead triage + submissions + booking diary |
| `src/routes/_authenticated/agent.tsx` | Offer console |
| `src/routes/_authenticated/supervisor.tsx` | Supervisor job cards |
| `src/routes/_authenticated/owner.tsx` | Owner analytics |
| `src/components/site/SiteHeader.tsx` / `SiteFooter.tsx` / `SiteLayout.tsx` | Public chrome |
| `src/components/portal/PortalShell.tsx` | Portal chrome (navy bar, role chip, tabs, alerts) |
| `src/components/site/RouteFinder.tsx` | Route finder on listing detail |
| `src/components/PhotoUpload.tsx` | Photo upload on forms and job cards |

---

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| Industrial Navy | `#123C7A` | primary — buttons, headings, active states, chart series 1 |
| Deep Navy | `#0A2550` | hero background, portal top bar, footer |
| Safety Orange | `#F7941D` | accent — primary CTA, active underline, progress fill, pins |
| Brick Red | `#D8232A` | Investments division, destructive, cash-sale CTAs |
| Success Green | `#1E9E5A` | approve actions, confirmed/complete states |
| WhatsApp Green | `#25D366` | WhatsApp buttons only |
| Page background | `#F3F5F8` | app background |
| Surface | `#FFFFFF` | cards, inputs |
| Border | `#D9DFE8` | card and input borders |
| Divider | `#E8ECF2` | in-card rules |
| Ink | `#0F1B2E` | body text |
| Ink muted | `#4A5568` | secondary text |
| Ink subtle | `#5A6679` | labels, meta |
| Ink faint | `#8592A6` | timestamps |
| On-navy body | `#C6D2E4` | text on deep navy |
| On-navy muted | `#9FB2CD` / `#7C93B8` | footer body / footer labels |
| Navy hairline | `#1B3A68` | borders on navy |

`src/styles.css` already carries equivalents in oklch (`--primary`, `--primary-deep`,
`--accent`, `--brick`, `--success`). Reconcile the rendered colour to the hex values above
and keep the token names.

### Type

- **Barlow** — body, inputs, paragraphs. 400/500/600/700, plus 600 italic for the
  "Building Your Future" tagline.
- **Barlow Condensed** — all headings, buttons, numbers, prices. 600/700, `uppercase`.
- **Barlow Semi Condensed** — small caps labels, meta, table headers. 600,
  `uppercase`, `letter-spacing: 0.10–0.20em`.

| Role | Size / weight |
|---|---|
| Hero H1 | Condensed 700, `clamp(42px, 6.6vw, 84px)`, line-height .94, uppercase |
| Page H1 | Condensed 700, `clamp(30px, 4.6vw, 58px)`, line-height 1, uppercase |
| Section H2 | Condensed 700, 34–40px, uppercase |
| Card title | Condensed 600/700, 21–25px, line-height 1.05–1.15, uppercase |
| Price (detail) | Condensed 700, 42px, brick red |
| Price (card) | Condensed 700, 26–27px, navy |
| Stat value | Condensed 700, 36px |
| Body | Barlow 400, 15–18px, line-height 1.55–1.6 |
| Micro label | Semi Condensed 600, 11–13px, uppercase, tracked |
| Button | Condensed 700, 15–20px, uppercase, `letter-spacing: .05–.06em` |

### Spacing, radius, shadow, motion

- Radius: **3px** buttons/inputs/badges, **4px** cards. Nothing is pill-shaped except the
  floating WhatsApp button (40px) and the notification count bubble.
- Section padding: 44–64px vertical, 20–24px horizontal. Card padding 18–22px. Grid gap
  14–20px. Card grids: `repeat(auto-fit, minmax(min(100%, 300px), 1fr))`.
- Shadows are restrained: cards `0 2px 10px rgba(11,36,80,.06)`; popovers
  `0 16px 40px rgba(10,37,80,.22)`; toast `0 14px 34px rgba(10,37,80,.34)`; hero photo
  frames `0 14px 34px rgba(0,0,0,.34)`.
- Accent edges carry meaning: a **4–5px top or left border** in the status colour on cards,
  a **3px bottom border** under the active nav item, a **6px bottom border** under the two
  division panels (navy for Developers, brick for Investments).
- Motion: page/section enter `opacity 0 → 1, translateY(10px) → 0`, 300–400ms ease-out
  (the repo's `--animate-fade-up` and `Reveal.tsx` already do this). Popovers/toasts 160–200ms.
  Nothing else animates.
- Hero and services photo frames are **7px white borders, rotated −3° to +3°**, overlapping.

---

## Status vocabulary

Never invent a status. These are the DB enums; render with a shared `prettyStatus()`
(`in_progress` → "In Progress") and a shared `<StatusBadge>`.

| Entity | Values |
|---|---|
| Service request (lead) | `new` → `contacted` → `quoted` → `converted`, or `declined` |
| Property submission | `new` → `reviewing` → `viewing_booked` → `offer_made` → `accepted`/`declined` → `purchased` |
| Job | `quoted` → `approved` → `in_progress` → `complete`, plus `on_hold`, `cancelled` |
| Quote | `draft` → `quoted` → `approved`/`declined` |
| Booking | `requested` → `confirmed` → `completed` (or `cancelled`) — **only these** |
| Listing | `draft` → `published` → `under_offer` → `sold` |
| Offer | `pending` → `approved`/`declined`/`countered` |
| Role | `client`, `admin`, `owner`, `supervisor` (+ agent capability) |

### Status colours (badge background / text)

| Meaning | States | bg / fg |
|---|---|---|
| Waiting | `new`, `pending`, `reviewing`, `requested`, `in_progress`, `offer_made`, `under_offer` | `#FFF0D6` / `#8A5A00` |
| In motion | `contacted`, `quoted`, `countered`, `viewing_booked` | `#EAF0F9` / `#123C7A` |
| Good | `approved`, `converted`, `accepted`, `complete`, `confirmed`, `published`, `purchased` | `#E2F3E9` / `#166B3E` |
| Bad | `declined`, `on_hold` | `#FBE3E4` / `#B21D23` |
| Neutral | `draft`, `completed`, `cancelled`, `sold` | `#EEF1F5` / `#5A6679` |

Progress-bar percentages tied to job status: `quoted` 0, `approved` 10, `in_progress` 55,
`on_hold` hold current, `complete` 100.

---

## Formatting rules

- **Money**: ZAR, `R 1 250 000` — `en-ZA`, non-breaking-ish space separators, no decimals,
  space after the R. One helper, used everywhere.
- **Dates**: `17 Sep` in lists, `12 Sep 08:14` for received timestamps, hourly booking slots
  `08:00`–`16:00`.
- **References** are shown, always uppercase-prefixed: `SRQ-3324` service request,
  `PSB-881` property submission, `BKG-501` booking, `JOB-4412` job, `Q-1191` quote,
  `OFR-2041` offer, `LST-104` listing.
- **Contact details** (use verbatim, nothing invented): WhatsApp **081 253 4300** →
  `https://wa.me/27812534300`, office **021 705 1867**, **info@prop3000.co.za**,
  Cape Town, Mon–Fri 08:00–17:00 · Sat 08:00–13:00.
- Every WhatsApp link carries a prefilled `?text=` message naming the reference where one
  exists.

---

## Public screens

### Site header (`SiteHeader.tsx`)
Sticky, white, **3px navy bottom border**, soft shadow. Left: the real logo image at 52px
height (`brand/prop3000-logo.png`), clicking it goes home. Centre: nav —
DEVELOPERS · INVESTMENTS · LISTINGS · REQUEST · SELL · BOOK · CONTACT — Barlow Condensed 600
16px uppercase, inactive `#3B4658`, hover orange, **active item navy text with a 3px orange
bottom border**. Right: green WhatsApp button reading "WhatsApp 081 253 4300", then an
outlined navy "Sign in" that fills navy on hover. Wraps to stacked rows on narrow widths.

### Home (`index.tsx`)
1. **Hero** on deep navy `#0A2550`. Two columns, collapsing below ~380px per column.
   Left: brick-red eyebrow chip "CAPE TOWN · SINCE 2016"; H1 "WE BUILD IT, FIX IT —" with
   "OR BUY IT FOR CASH." in orange; body paragraph (max 52ch); three CTAs — orange "REQUEST A
   QUOTE", brick "SELL FOR CASH", white-outlined "BROWSE LISTINGS"; then three green-ticked
   badges: **No agent fees · Fast turnaround · Serious cash buyers**. Right: two overlapping
   white-framed rotated photos.
2. **Two division panels**, side by side. Left white with a **6px navy bottom border**:
   "PROP3000 DEVELOPERS" / "BUILDING YOUR FUTURE" / trades paragraph / outlined "OUR
   SERVICES". Right navy with a **6px brick bottom border** and orange eyebrow:
   "WE BUY PROPERTIES FAST FOR CASH" / paragraph / orange "GET A CASH OFFER".
3. **Published listings** — heading plus "ALL 6 ON THE MAP →" link; three listing cards
   (3:2 photo with a brick status flag at top-left, suburb label, condensed title, navy
   price, stand + beds).
4. **Brick-red CTA band** — "NEED A QUICK CASH SALE?" / "No delays. No hassles. Serious cash
   buyers." + white "SUBMIT MY PROPERTY" and green "WHATSAPP US TODAY".

### Developers (`developers.tsx`)
Navy banner: eyebrow "PROP3000 DEVELOPERS", H1 "OUR SERVICES", italic orange tagline
"Building your future". Body: a grid of 13 service cards, each white with a **4px orange
left border** — Renovations, Building, Scheming, Plastering, Plumbing, Electrical, Electrical
Gates, Gate Motors, Paving, Painting, Waterproofing, Cabinet Making, Built-In Cupboards.
Then a navy strip "NOT ON THE LIST? SEND IT ANYWAY." + orange "REQUEST A QUOTE". Right
column: three overlapping rotated white-framed photos.

### Investments (`investments.tsx`)
Stacked banner bands, matching the client's flyer: brick band "NEED A **QUICK CASH SALE?**"
(the emphasis in `#FFD24A`), then navy band "WE BUY PROPERTIES **FAST** FOR **CASH!**" with
"No delays. No hassles." beneath. Body left: "WE SPECIALISE IN:" as five full-width navy rows
with white ticks — Fixer-uppers · Distressed properties · Vacant plots & land · Incomplete
building projects · Late estate properties. Under it the three green-ticked promises, then
brick "GET MY CASH OFFER" and outlined "BOOK A VIEWING". Body right: two rotated photos, and
a white card "HOW A CASH SALE WORKS" — four numbered navy squares:
1 Submit the property · 2 We view it · 3 Cash offer · 4 You decide.

### Listings (`listings.index.tsx`)
Header row: eyebrow, H1 "{n} PROPERTIES FOR SALE", and three filters — text search
(suburb/address/postal), price band (Any · Under R700 000 · R700 000–R1m · Over R1m), type
(Any · House · Townhouse · Vacant land · Incomplete build). Filtering is live and drives both
map and list.

Two columns: **map** (min 430px, height `min(72vh, 640px)`, 4px radius, navy overlay chip
"CLICK A PIN TO OPEN THE LISTING") and a **result list**. Pins are navy price labels
(`R 890 000`) anchored bottom-centre; clicking a pin opens that listing. The map auto-fits
the filtered set, falling back to a Cape Town view when empty.

Each result card: 130px hatch thumbnail + body — suburb label and status badge on one row,
condensed title, "House · 620 m² stand · 3 bed · 1 bath" meta, then navy price with outlined
"VIEW" and orange "MAKE AN OFFER". The card for the currently-selected listing takes an
orange border. "Make an offer" pre-fills the offer field at **92% of asking**.

### Listing detail (`listings.$id.tsx`)
Left column: 4:3 main photo, a 3-up thumbnail strip, a 300px map pinned to the property, and
the **RouteFinder** card — "Type any Cape Town address to get the driving distance and time";
input + navy "GET ROUTE"; on success it shows From / Distance / Driving time and draws an
orange route line, refitting the map. Unrecognised input shows the toast "Address not
recognised — try a Cape Town suburb like Bellville or Muizenberg."

Right column: meta line (suburb · type · status), H1 title, street address, brick-red price
42px with "ASKING" label, a 4-cell spec strip (Floor / Stand / Beds / Baths), an amber
condition callout (`#FFF4E4`, 4px orange left border, "CONDITION" label), then the
**offer card** — 2px navy border: "SUBMIT AN OFFER", amount input (Condensed 700 24px),
message textarea, orange "SUBMIT OFFER".

After submitting, the same card becomes a confirmation: green "OFFER SUBMITTED",
"R 820 000 ON LST-104", reference and pending status, the reassurance that the agent
approves/declines/counters and that **Prop3000 never takes payment or handles transfer on
the portal**, plus navy "TRACK MY OFFER" and green "WHATSAPP THE AGENT".

### The three forms (`request.tsx`, `sell.tsx`, `book.tsx`)
One shared layout, max-width ~820px: eyebrow, H1, intro paragraph, then fields. Shared block
first — Full name, Mobile, Email, address (label varies). Then per form:

- **Request a quote** — service-type chips (all 13 trades, multi-select; selected = navy fill,
  white text) and a Budget select (Under R20 000 · R20 000–R50 000 · R50 000–R150 000 ·
  R150 000+ · Not sure yet).
- **Sell for cash** — Property type (House · Townhouse/sectional title · Vacant plot or land ·
  Incomplete building project), Condition (Fixer-upper · Distressed/damaged · Incomplete
  build · Late estate property · Good condition), optional Asking price.
- **Book a date** — Booking type (Site visit · Renovation start · Property viewing ·
  Consultation), Date, and a **time-slot grid 08:00–16:00 hourly**, selected slot navy.

All three then have a description textarea, a photo upload row (note: "Photos — compressed on
your phone before upload"), and a brick-red submit with the reassurance line
"No account needed · No agent fees · No obligation".

On success the form is replaced by a confirmation card: green "SUBMITTED · STATUS NEW",
"REFERENCE {ref}", a sentence explaining what happens next, a green "SEND IT ON WHATSAPP TOO"
(prefilled with the reference) and "TRACK IT IN MY PORTAL".

Submission is **anonymous-friendly** — the RLS policies `anyone can submit request`,
`anyone can submit property` and `anyone can book` already allow `client_id IS NULL`.

### Contact (`contact.tsx`)
H1 "CONTACT PROP3000" and a bordered grid of five cells, each with a tracked micro label, a
Condensed 700 26px value and a small note: WhatsApp 081 253 4300 ("Fastest route to a human"),
Office 021 705 1867 (hours), Email info@prop3000.co.za, Area Cape Town ("Northern & Southern
suburbs, Cape Flats, Helderberg"), Divisions "Developers · Investments".

### Auth (`auth.tsx`)
Narrow card with a **5px navy top border**: H1 "SIGN IN", sub "Staff and clients use the same
door — your role decides where you land.", email + password, navy "SIGN IN", a
"Continue with Google" button, then a "DEMO ACCOUNTS" divider and five rows, each with a
**4px orange left border**, showing name, email and role: Thandi Client / Office Admin /
Riaan Agent / Sipho Supervisor / Owner. Footer line: all demo accounts use the password
`Prop3000#2026`.

### Floating WhatsApp button
Fixed bottom-right, green pill, "WHATSAPP US", `0 8px 22px rgba(10,37,80,.28)`. Public pages only.

---

## Portal screens

### Portal shell (`PortalShell.tsx`)
Deep-navy header: "PROP3000" wordmark (the 3000 in orange), an **orange role chip**, then
"Name · email". Right: "ALERTS" button with a brick-red count bubble, and "SIGN OUT". Below,
a row of tabs on the navy — active tab gets a navy-lighter fill and a **3px orange bottom
border**. Tabs by role:

- Client: My portal · My offers
- Admin: Lead triage · Jobs · Bookings
- Agent: Offer console · Listings
- Supervisor: My jobs
- Owner: Analytics · Leads · Offers · Jobs

Content area on `#F3F5F8`: Condensed 700 38px page title plus a one-line subtitle that
carries a live count ("3 new service requests waiting to be actioned").

**Notifications popover** — anchored top-right, navy header bar, scrollable list; each row a
coloured dot, bold title, body line, and "{when} · Email + in-app". Feed from the
`notifications` table; a new row is written on every state change (offer submitted /
countered / approved, quote ready, job status change).

**Toasts** (sonner): deep navy, green dot, 15px text, bottom-centre, ~3.2s. Every mutation
confirms with one, and says who was notified — e.g. "Offer OFR-2041 approved — buyer notified."

### Client portal (`client.tsx`)
**My quotes** — one card per quote, 4px status-coloured left border: reference + job ref,
title, status badge, then **line items** with amounts, a **VAT 15%** row, and a
"TOTAL" row (Condensed 700 30px navy). While status is `quoted` the card shows green
"APPROVE QUOTE", outlined brick "DECLINE" and green "QUERY ON WHATSAPP". Approving flips the
quote and its job.

**My requests & bookings** — compact cards, reference + date, status badge, title, address.

### Client offers (`offers.tsx`)
Only the signed-in client's offers. Each card: reference + submitted date, listing, buyer
line, amount (Condensed 700 32px) with "asking X · ±gap", the message in quotes, status badge,
and an **offer-events audit trail** ("Submitted R 820 000 · 02 Sep 10:12", "Countered
R 380 000 by Riaan Agent · 30 Aug 09:05"). When status is `countered` the card shows
"Agent countered at **R 380 000**" with green "ACCEPT" and outlined brick "DECLINE";
accepting sets the offer to `approved` at the counter amount and surfaces the agent's
contact details.

### Admin (`admin.tsx`)
Four stat cards (New leads / Quoted / Active jobs / Bookings today), each with a 4px coloured
top border, Condensed 700 36px value and a note line.

**Lead triage** — one card per `service_requests` row, 4px status left border: reference +
received timestamp, client name, "service · address", "phone · email · budget {band}", the
description paragraph. Action row: three triage toggles **CONTACTED / QUOTED / DECLINED**
(active = navy fill), then a supervisor select, a quote-amount input, and navy
**"CONVERT TO JOB"** — which creates the job (status `quoted`, the entered amount, the chosen
supervisor), flips the lead to `converted`, writes the first `job_status_history` row, and
notifies the client that a quote is ready.

**Property submissions** — cards with reference, address, "type · condition", asking price,
client, status badge, and two actions: brick "MAKE CASH OFFER" (→ `offer_made`) and outlined
"BOOK VIEWING" (→ `viewing_booked`).

**Booking diary** — table with a navy header row (Date · slot / Type / Client / Address /
Status / Action) and per-row green "CONFIRM", outlined "COMPLETE", grey "ASSIGN".

### Agent (`agent.tsx`)
Four stat cards (Offers pending / Countered / Approved / Stock value), then the **offer
console** — the same offer cards as the client view, but with agent actions while `pending`:
green "APPROVE", outlined navy "COUNTER", outlined brick "DECLINE". "Counter" expands an
inline panel on `#EAF0F9`: "COUNTER AT (ZAR)", amount input, navy "SEND COUNTER", plain
"CANCEL". Every action appends an `offer_events` row and notifies the buyer. Approving
connects the buyer to the agent ("Approved — buyer connected to Riaan Agent, 081 253 4300");
the sale itself is finalised off-platform.

### Supervisor (`supervisor.tsx`) and Jobs (`dashboard.tsx` / admin Jobs tab)
Job cards, 4px status-coloured top border, in a `minmax(330px, 1fr)` grid:
reference + client, title, address, status badge; a Quote row (Condensed 700 24px navy);
a **progress bar** (10px, orange fill) with percentage and — for supervisor/admin — a
0–100 step-5 range slider; **status buttons** APPROVED / IN PROGRESS / ON HOLD / COMPLETE
(active navy); a **photo grid** (4 columns, plus a dashed "+" tile that uploads into the
private `job-photos` bucket); a **site-note input** with a navy "LOG" button; and the
**status history** list — status in navy, note, timestamp right-aligned.

Supervisors see only their own jobs (`supervisor_id = auth.uid()`, which RLS already
enforces). Clients see job progress read-only — no sliders, no status buttons, no upload tile.

### Owner (`owner.tsx`)
Four stat cards — Quoted pipeline, Work won (with lead-conversion %), Listing stock value,
Acquisition spend — then four recharts panels:

1. **Lead trend · 6 months** — vertical bars with the value above each; current month orange,
   prior months `#C3CFDF`.
2. **Revenue by stage** — horizontal bars: Requested `#C3CFDF`, Quoted navy, In progress
   orange, Complete green.
3. **Job status mix** — donut/pie with a legend: In progress orange, Quoted navy,
   Complete green, On hold brick.
4. **Demand by trade** — horizontal orange bars with a label column and count.

Owner is **read-only analytics** — no mutation controls.

---

## Interactions & behaviour

- **Navigation** is real routing; the prototype's "Demo role" bar is scaffolding — replace it
  with actual auth + the `_authenticated` route guard and role-based redirect
  (client → `/client`, admin → `/admin`, agent → `/agent`, supervisor → `/supervisor`,
  owner → `/owner`).
- **Offer lifecycle** is the flagship flow and must round-trip: client submits (`pending`) →
  agent approves / declines / counters → on `countered` the client accepts (→ `approved` at
  the counter amount) or declines → every transition writes an `offer_events` row and a
  `notifications` row for the counterparty.
- **Lead lifecycle**: `new` → `contacted`/`quoted` → **convert** → job + quote + history +
  client notification.
- **Job lifecycle**: supervisor changes status, drags progress, uploads photos, logs notes;
  each status change appends history and notifies the client.
- **Filters** are client-side over the fetched listing set and drive map and list together.
- **Loading**: use `src/components/ui/skeleton.tsx` for card and table lists; the map is
  lazy-mounted client-side via `LazyMap` (Mapbox is browser-only) and shows
  "Map is not configured yet." when the token is missing.
- **Errors**: destructive sonner toast with the same layout as the success toast; forms show
  zod messages inline under the field.
- **Validation**: name and mobile required; email valid; SA mobile pattern; offer amount a
  positive integer; booking requires type, date and slot; photos ≤ 6 per submission.
- **Responsive**: every grid is `auto-fit` + `minmax(min(100%, Npx), 1fr)`, so there are no
  fixed widths to break. Header nav wraps; the listings map stacks above the list; wide
  tables (booking diary) scroll horizontally with a min-width.

## State management

Server state via **TanStack Query** against Supabase — one query key per entity
(`['leads']`, `['jobs']`, `['offers', role]`, `['listings', filters]`, `['quotes']`,
`['bookings']`, `['submissions']`, `['notifications']`). Mutations invalidate their entity
plus `['notifications']`. Local UI state only for: filter values, the selected listing, the
offer draft, the counter-amount draft, per-lead quote/supervisor drafts, per-job note drafts,
form state (react-hook-form), notification popover open, selected booking slot.

## Assets

| Asset | Where |
|---|---|
| Prop3000 Developers logo | `brand/prop3000-logo.png` (trimmed from the client's flyer) — the header mark |
| Client brand/build spec | `brand/build-spec.md` |
| Photography | **Not supplied.** Every photo position in the prototype is a labelled placeholder ("Fixer-upper exterior", "Renovation in progress", "Artisan at work", "Electrical work", "Paving / gate install", "Distressed house", "Vacant plot", "Main property photo"). Ask the client for real job and listing photos; until then use the hatch fill treatment from the prototype rather than stock imagery. |
| Icons | `lucide-react`, already installed |
| Fonts | Barlow / Barlow Condensed / Barlow Semi Condensed (Google Fonts) — confirm they're actually loaded in `__root.tsx`, not just named in `styles.css` |

## Screenshots

`screenshots/` holds one capture per screen, in route order. They are a quick visual index —
the live prototype in `design-reference/` is the authority, since the screenshots are cropped
to the top of each page at a narrow viewport and don't show scroll content or interactive
states (counter panels, confirmations, notification popover, toasts).

| File | Screen |
|---|---|
| `01-home.png` | Home |
| `02-developers.png` | Developers / Our Services |
| `03-investments.png` | Investments / cash sale |
| `04-listings.png` | Listings map + filters |
| `05-listing-detail.png` | Listing detail + RouteFinder + offer form |
| `06-form-request.png` | Request a quote |
| `07-form-sell.png` | Sell for cash |
| `08-form-book.png` | Book a date |
| `09-contact.png` | Contact |
| `10-auth.png` | Sign in + demo accounts |
| `11-portal-client.png` | Client portal — quotes, requests, bookings |
| `12-portal-client-offers.png` | Client — my offers |
| `13-portal-admin.png` | Admin — lead triage + submissions |
| `14-portal-admin-bookings.png` | Admin — booking diary |
| `15-portal-agent.png` | Agent — offer console |
| `16-portal-supervisor.png` | Supervisor — job cards |
| `17-portal-owner.png` | Owner — analytics |

## Files in this bundle

```
CLAUDE_CODE_PROMPT.md                    ← paste into Claude Code to start
README.md                                ← this file
screenshots/                             ← 17 captures, one per screen
brand/prop3000-logo.png
brand/build-spec.md
design-reference/Prop3000 Portal.dc.html  ← open in a browser; the design source of truth
design-reference/support.js               ← runtime the prototype needs; not for production
design-reference/image-slot.js            ← photo-placeholder helper; not for production
design-reference/assets/prop3000-logo.png
```

## Definition of done

- Every route in the mapping table matches the prototype at desktop and mobile widths.
- No inline styles, no Leaflet, no hard-coded colour outside `styles.css` tokens.
- All statuses render through the shared `prettyStatus()` + `<StatusBadge>`.
- Offer, lead and job lifecycles round-trip against Supabase and write their history and
  notification rows.
- Role boundaries hold: a supervisor sees only their jobs, the owner cannot mutate, clients
  see only their own records.
- `npm run lint` and `npm run build` both pass.
