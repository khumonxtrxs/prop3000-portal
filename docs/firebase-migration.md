# Moving the portal from Supabase to Firebase, hosted on Cloudflare

Firebase is a course requirement, so the portal's data, auth and file storage move from Supabase
(Postgres) to Firebase (Firestore). Hosting stays on Cloudflare Workers, which `npm run build`
already targets.

**Status: done.** Phases 3-7 landed together in `feature/firebase-migration`, because sign-in and
data have to move at the same time (see "What actually happened" at the end). This document was
the plan; the end of it records where the build differed.

## What changes and what doesn't

| Layer | Now | After |
|---|---|---|
| Data | Postgres, 13 tables, SQL in `supabase/migrations/` | Firestore, 13 collections |
| Access control | 48 row-level-security policies | Firestore security rules |
| Auth | Supabase Auth (email/password + Google) | Firebase Auth (email/password + Google) |
| Files | Supabase Storage (`lead-photos`, `job-photos`) | Firebase Storage, same two folders |
| Hosting | none yet | Cloudflare Workers |
| UI, routes, styling | TanStack Start, Tailwind, shadcn/ui | unchanged |

Scope: 22 files import Supabase, with 47 query call sites and 10 auth call sites.

## Two constraints that shape the design

**1. `firebase-admin` does not run on Cloudflare Workers.** It needs Node networking that the
Workers runtime doesn't provide. So nothing at the edge may depend on it. Two consequences:

- **Demo accounts** are not created by a server function any more. A one-off script,
  `scripts/seed-demo-users.mjs`, runs on a laptop with `firebase-admin` and a service-account key,
  and creates the five demo users. The key never enters the repo or Cloudflare.
- **Server-side reads** (the public listings, which are server-rendered) use the **Firestore REST
  API** with the public API key. Security rules allow anyone to read published listings, so no
  token is needed. `listPublicListings` and `getPublicListing` keep their current signatures.

**2. Firestore has no joins.** Postgres queries that join, such as a job with its client's name,
become denormalized fields. When a job is created, the client's name and phone are copied onto
the job document. The trade-off is that a client renaming themselves doesn't update old records,
which is acceptable here and normal for Firestore.

## Data model

One collection per table, same names. Document ids are auto-generated, except `user_roles` and
`profiles`, which use the Firebase Auth uid so rules can read them cheaply.

| Collection | Notes |
|---|---|
| `profiles/{uid}` | email, full_name, phone |
| `user_roles/{uid}` | `{ roles: ["admin"] }`. Rules read this to authorise. |
| `service_requests` | anyone may create, including signed-out visitors |
| `property_submissions` | anyone may create |
| `bookings` | anyone may create |
| `jobs` | denormalized `client_name`, `client_phone`, `supervisor_name` |
| `job_status_history` | subcollection of the job |
| `job_photos` | subcollection of the job |
| `quotes` | `line_items` stays an array of maps |
| `listings` | public read when `status != "draft"` |
| `offers` | denormalized `listing_title`, `asking_price`, `buyer_name` |
| `offer_events` | subcollection of the offer |
| `notifications` | one document per user per event |

Statuses stay exactly as they are. The Postgres enums become TypeScript string unions in
`src/lib/status.ts`, and Firestore rules check membership on write, so no status string is
invented anywhere.

## Security rules replace the RLS policies

The rules mirror the current policies one for one:

- Signed-out visitors may **create** service requests, property submissions and bookings, and may
  **read** published listings. Nothing else.
- Clients read only documents where `client_id == request.auth.uid`.
- Supervisors read and update only jobs where `supervisor_id == request.auth.uid`.
- Office roles (admin, owner) read everything. The owner's read-only dashboard is a UI choice;
  in the rules the owner counts as office, exactly as it did in the Supabase policies.
- Agents manage listings and offers.

A helper in the rules reads `user_roles/{uid}` once per request, the same shape as the current
`has_role()` function. `scripts/test-rules.mjs` runs 26 tests against the emulator and all pass;
`npm run test:rules` is the command. Every rule change gets a test.

## Phases, one branch each

1. **`feature/remove-lovable`** — done, awaiting review. Independent of Firebase.
2. **`feature/firebase-setup`** — done. Firebase SDK, `src/integrations/firebase/client.ts`,
   collection names in `config.ts`, env variables, `firestore.rules`, `storage.rules`,
   `firebase.json`, the emulator wrapper and 26 passing rule tests. Nothing imports the client
   yet, so the app still runs on Supabase.
3. **`feature/firebase-auth`** — `useAuth`, `/auth`, the `_authenticated` guard and role-based
   redirects move to Firebase Auth. Includes the demo-user seeding script and Google sign-in.
4. **`feature/firestore-public-writes`** — the three public forms (request, sell, book) and the
   photo upload write to Firestore and Firebase Storage.
5. **`feature/firestore-listings`** — listings, listing detail and offers, including the
   server-rendered public listing reads over the REST API.
6. **`feature/firestore-portal`** — the five dashboards: client, admin, agent, supervisor, owner.
7. **`chore/drop-supabase`** — remove `@supabase/supabase-js`, `src/integrations/supabase/`,
   and move `supabase/migrations/` to `docs/legacy-supabase-schema/` as a record of the schema.

Then the design branches from `CONTRIBUTING.md` continue on top.

## Deploying to Cloudflare

```sh
npm run build              # Workers bundle in .output/, with wrangler.json
npx wrangler deploy        # first run prompts a Cloudflare login
```

Set the `VITE_FIREBASE_*` variables in the Cloudflare dashboard under the Worker's settings. They
are public by design: Firebase config is not secret, and the security rules do the protecting.
The service-account key stays on the laptop that runs the seed script.

Add the Workers URL to **Firebase Console > Authentication > Settings > Authorised domains**, or
Google sign-in is rejected in production.

## Risks

- **Rules are the only thing between the browser and the data.** They need emulator tests before
  the first deploy. A missing rule is a data leak, not a broken page.
- **Free tier limits.** Firestore's free tier allows 50k document reads a day, which is ample for
  a demo but easy to burn with a dashboard that re-reads on every render. The dashboards use
  TanStack Query caching, which already limits this.
- **No transactions across collections by default.** Converting a lead to a job writes a job, a
  quote, a history entry and a notification. That becomes a Firestore batched write so it can't
  half-succeed.

## What actually happened

**Why one branch, not five.** Supabase only returns rows to a user signed in to Supabase. Moving
sign-in to Firebase on its own (phase 3) left every dashboard empty, because the data was still in
Supabase. So sign-in, the forms, listings, dashboards and the Supabase removal shipped together.

**Where the build differs from the plan above:**

- **Roles** are `user_roles/{uid}` = `{ roles: [...] }`, as the rules expect. The first seed script
  wrote `{ role: "admin" }`, which the rules never matched; that is fixed.
- **Sign-up** no longer depends on a trigger. On first sign-in, `useAuth` creates the profile and
  `{ roles: ["client"] }`. The rules allow a user to create exactly that document for themselves
  and nothing more.
- **Timestamps** are ISO-8601 strings, as Postgres returned them, so no screen had to change how it
  reads or sorts dates. Filtered queries sort in the browser, so no composite indexes are needed.
- **Reference numbers** (`SR-4F2A9C`, `OF-…`) are generated in the app (`newReference()` in
  `src/integrations/firebase/db.ts`) instead of by Postgres column defaults.
- **The offer trigger** (`notify_offer_status`) is now `src/lib/offers.ts`: the buyer is notified
  when they make an offer, and in the same batch as the agent's decision.
- **Joins**: offers carry a copy of the listing's title, address, price and agent contact.
- **Batched writes** keep multi-document changes all-or-nothing: converting a lead to a job, a
  supervisor's status change plus its history entry, and an agent's decision plus the buyer's
  notification.
- **Server-side listing reads** use the Firestore REST API with the public key
  (`src/integrations/firebase/rest.ts`), as planned.
- **Demo data** is loaded by `npm run seed:demo-data`, which reads the existing
  `docs/legacy-supabase-schema/seed.sql` so there is still a single source of demo data. Demo users
  keep their fixed uids from that file, so every relation still lines up.

**Rule changes**, each with a test (33 in total now):

- A buyer can no longer change their own offer. The Supabase policy allowed it, which meant a buyer
  could approve their own offer; only agents decide now.
- A client accepting or declining a quote can change only its status, not the amounts.
- A user may only notify themselves; staff may notify anyone. Before, anyone signed in could
  write a notification to anyone.
- Jobs may be created as `approved` (what the lead desk does), and quotes as `draft` or `sent`
  (the old rule allowed a `quoted` status that quotes never have).
- Public listing reads are written as a list of visible statuses so that the signed-out "published
  listings" query is provably allowed.
- Lead photos live in dated subfolders (`lead-photos/requests/2026/…`), which the Storage rule now matches.
