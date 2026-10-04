# Contributing to the Prop3000 Portal

This guide explains how the team works in this repo, so anyone can pick up a branch.

## Getting started

Requirements: Node.js 20+ and npm.

```sh
git clone https://Prop3000@dev.azure.com/Prop3000/P3000portal/_git/P3000portal
cd P3000portal
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
| `npx supabase db reset` | Fresh local DB with all migrations and demo seed data |
| `npm run emulators` | Local Firebase emulators (needs Java) |
| `npm run test:rules` | Security rule tests, with the emulators running |
| `npm run seed:demo-users` | Creates or updates the five Firebase demo accounts and their `user_roles/{uid}` documents |

## Where things are

| Path | Contents |
|---|---|
| `src/routes/` | TanStack Start file routes (see `src/routes/README.md`) |
| `src/components/site/` | Public site chrome (header, footer, layout, route finder) |
| `src/components/portal/` | Portal shell and charts |
| `src/components/ui/` | shadcn/ui primitives |
| `src/lib/` | Helpers, server functions, company constants (`prop3000.ts`) |
| `src/integrations/supabase/` | Supabase clients and auth middleware |
| `supabase/migrations/` | Database schema and RLS policies |
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

Planned branches, in order. Branches 4-8 are the Firebase migration; 9 onwards are the design handoff:

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
6. Push and open a pull request into `main` on Azure DevOps. Get one teammate to review it.

Never force-push or rewrite history that has already been pushed (see `AGENTS.md`).

## Rules from the design handoff

- Use the existing stack: Tailwind v4 tokens, shadcn/ui, Mapbox via `LazyMap`, recharts, sonner. No new UI libraries.
- No inline styles and no hard-coded colours outside `src/styles.css`.
- Statuses come from the DB enums. Render them with the shared `prettyStatus()` and `<StatusBadge>`.
- Money is ZAR, formatted `R 1 250 000`.
- Use only the real contact details in `src/lib/prop3000.ts`.
- Never commit `.env` or any keys.

## Environment and services

The portal is moving from Supabase to **Firebase** (a course requirement), hosted on **Cloudflare
Workers**. The plan and its branch order are in [docs/firebase-migration.md](docs/firebase-migration.md).
Supabase still serves the app until that migration lands, so both sets of variables are live for now.

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
26 tests cover the boundaries that matter: anonymous people can submit a lead but read nothing,
clients see only their own records, supervisors only their own jobs, draft listings stay hidden,
and nobody can grant themselves a role. Add a test with every rule change.

On Windows, `npm run emulators` goes through `scripts/emulators.mjs`, which points Java at a short
temp directory and strips `JAVA_TOOL_OPTIONS`. Without that the Firestore emulator fails with
"Unable to establish loopback connection" and Storage fails with "Unexpected rules runtime error".

**Supabase** (until the migration finishes)

**Supabase**
1. Create a project at [supabase.com](https://supabase.com). The team lead owns it; share keys privately, never in git.
2. Apply the schema, RLS policies and storage buckets from `supabase/migrations/`:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   Update `project_id` in `supabase/config.toml` to the same `<project-ref>`.
3. Copy the URL, publishable (anon) key and service role key from **Project Settings > API** into `.env`.
4. **Google sign-in:** under **Authentication > Providers > Google**, add a Google OAuth client ID and secret. Under **Authentication > URL Configuration**, add `http://localhost:8080` and your deployed URL to the redirect allow list.
5. The demo accounts (`Prop3000#2026`) are created automatically the first time someone clicks a demo login on `/auth`.

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
