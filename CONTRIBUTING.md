# Contributing to the Prop3000 Portal

This guide explains how the team works in this repo, so anyone can pick up a branch.

## Getting started

Requirements: Node.js 22+ and npm.

```sh
git clone https://github.com/khumonxtrxs/prop3000-portal.git
cd prop3000-portal
npm install
cp .env.example .env   # then fill in the values (ask the team lead)
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload on http://localhost:8080 |
| `npm run build` | Production build (also regenerates `src/routeTree.gen.ts`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run format` | Prettier |
| `npm run emulators` | Local Firebase emulators (needs Java) |
| `npm run test:rules` | Security rule tests, with the emulators running |
| `npm run seed:demo-users` | Creates or updates the five Firebase demo accounts and their `user_roles/{uid}` documents |
| `npm run seed:demo-data` | The demo accounts plus every demo lead, job, quote, booking, listing and offer |

## Where things are

| Path | Contents |
|---|---|
| `src/routes/` | TanStack Start file routes (see `src/routes/README.md`) |
| `src/components/site/` | Public site chrome (header, footer, layout, route finder) |
| `src/components/portal/` | Portal shell and charts |
| `src/components/ui/` | shadcn/ui primitives |
| `src/lib/` | Helpers, server functions, company constants (`prop3000.ts`) |
| `src/integrations/firebase/` | Firebase client, Firestore helpers (`db.ts`) and server-side REST reads (`rest.ts`) |
| `src/lib/db-types.ts` | Row types for every collection |
| `firestore.rules`, `storage.rules` | Who may read and write what. Test with `npm run test:rules` |
| `docs/legacy-supabase-schema/` | The original Postgres schema, kept as a record; `seed.sql` is still the demo-data source |
| `design_handoff_prop3000_portal/` | **Design source of truth.** Open `design-reference/Prop3000 Portal.dc.html` in a browser. Spec is in its `README.md` |

## Branching

`main` stays stable. Nobody pushes work straight to `main`; everything goes through a pull request.

Each piece of work gets its own branch off `main`:

| Prefix | Use for | Example |
|---|---|---|
| `feature/` | New screens or behaviour | `feature/design-tokens` |
| `fix/` | Bug fixes | `fix/listing-map-pins` |
| `chore/` | Tooling, config, dependencies | `chore/eslint-config` |
| `docs/` | Documentation only | `docs/setup-guide` |

Planned branches, in order. Branches 4-8 are the Firebase migration, delivered together in
`feature/firebase-migration`; 9 onwards are the design handoff:

1. `feature/project-setup` (the portal source, design handoff and repo tooling)
2. `feature/remove-lovable` (runs standalone, no Lovable packages)
3. `feature/firebase-setup` (Firebase SDK, security rules, emulators)
4. `feature/firebase-auth` (sign-in, roles, route guards on Firebase Auth)
5. `feature/firestore-public-writes` (request, sell and book forms write to Firestore)
6. `feature/firestore-listings` (listings, detail and offers)
7. `feature/firestore-portal` (the five dashboards)
8. `chore/drop-supabase` (remove the Supabase client and packages)
9. `feature/design-tokens` (colours and fonts in `src/styles.css`)
10. `feature/site-chrome` (`SiteHeader`, `SiteFooter`, `SiteLayout`)
11. `feature/public-pages` (home, developers, investments, contact)
12. `feature/forms` (request, sell, book)
13. `feature/listings` (listings map and listing detail)
14. `feature/portal-dashboards` (client, admin, agent, supervisor, owner)

## Workflow

1. `git switch main && git pull`
2. `git switch -c feature/<short-name>`
3. Make the change and keep it to one topic.
4. Before you open a PR, run `npm run lint`, `npx tsc --noEmit` and `npm run build`.
5. Stage and commit with a clear message, e.g. `feature(design-tokens): match navy/orange palette to handoff`.
6. Push and open a pull request into `main` on GitHub. CI must pass and one teammate must review it. Merging into `main` deploys to production.

Never force-push or rewrite history that has already been pushed (see `AGENTS.md`).

## Rules from the design handoff

- Use the existing stack: Tailwind v4 tokens, shadcn/ui, Mapbox via `LazyMap`, recharts, sonner. No new UI libraries.
- No inline styles and no hard-coded colours outside `src/styles.css`.
- Statuses come from the DB enums. Render them with the shared `prettyStatus()` and `<StatusBadge>`.
- Money is ZAR, formatted `R 1 250 000`.
- Use only the real contact details in `src/lib/prop3000.ts`.
- Never commit `.env` or any keys.

## Environment and services

The portal runs on **Firebase** (a course requirement), hosted on **Cloudflare Workers**. How it
moved off Supabase is recorded in [docs/firebase-migration.md](docs/firebase-migration.md).

**Firebase**
1. Create a project in the [Firebase console](https://console.firebase.google.com), then add a
   **Web app** to it. Copy the config values into the `VITE_FIREBASE_*` variables in `.env`.
2. Enable **Authentication > Sign-in method > Email/Password** and **Google**.
3. Create **Firestore Database** and **Storage** in the console, in a region near South Africa
   (`europe-west1` is the usual pick).
4. Deploy the rules whenever `firestore.rules` or `storage.rules` changes:
   ```sh
   npx firebase deploy --only firestore:rules,storage:rules --project <project-id>
   ```
5. Add your deployed domain under **Authentication > Settings > Authorised domains**, or Google
   sign-in fails in production.

**Local emulators** (no cloud project needed, and safe to experiment in):
```sh
npm run emulators          # auth 9099, firestore 8081, storage 9199, UI on http://localhost:4000
```
Set `VITE_FIREBASE_EMULATORS=true` in `.env` so the app connects to them. Java SE 21 must be installed.
Firestore uses 8081 because the dev server already holds 8080.

`.firebaserc` is git-ignored, so everyone can point at their own project. That's why the deploy
command above passes `--project` explicitly.

**Test the rules before deploying them.** With the emulators running, in a second terminal:
```sh
npm run test:rules
```
33 tests cover the boundaries that matter: anonymous people can submit a lead but read nothing,
clients see only their own records, supervisors only their own jobs, draft listings stay hidden,
buyers can't approve their own offers, and nobody can grant themselves a role. Add a test with
every rule change.

**Demo data.** With the emulators running, load the five demo accounts and all the demo records:
```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 npm run seed:demo-data
```
The data is read from `docs/legacy-supabase-schema/seed.sql`. To seed a hosted project, set
`FIREBASE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` (a service-account key file, never committed).

On Windows, `npm run emulators` goes through `scripts/emulators.mjs`, which points Java at a short
temp directory and strips `JAVA_TOOL_OPTIONS`. Without that the Firestore emulator fails with
"Unable to establish loopback connection" and Storage fails with "Unexpected rules runtime error".

**Mapbox**
Create a public `pk.` token for `VITE_MAPBOX_PUBLIC_TOKEN`. For `MAPBOX_ACCESS_TOKEN`, use a secret token or the same public token. Without tokens the map shows "Map is not configured yet."

**Deploying**
`npm run build` produces a Cloudflare Workers build in `.output/` by default (deploy with `npx wrangler deploy` using `.output/server/wrangler.json`). For a plain Node server instead:
```sh
NITRO_PRESET=node-server npm run build
node .output/server/index.mjs
```
Set the same environment variables on the host.

## Known baseline issues (from the original export)

- `npx tsc --noEmit`: 3 errors. The error `unknown` vs `Error` type shows up in `src/routes/__root.tsx`, `listings.$id.tsx` and `listings.index.tsx`. `npm run build` is unaffected.
