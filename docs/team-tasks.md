# Where the project stands and who does what next

Last updated: 30 September 2026.

## Done

- The portal runs standalone: TanStack Start, Tailwind v4, shadcn/ui, Supabase, Mapbox. No editor
  or platform lock-in, and it builds for Cloudflare Workers.
- Local development works end to end against a Supabase stack in Docker (`npx supabase start`),
  with all 7 migrations applied.
- Firebase groundwork: SDK client, Firestore and Storage rules that mirror all 48 row-level-security
  policies, emulator config, and 26 passing rule tests (`npm run test:rules`).
- Design: brand tokens (colour, typography, radii, shadows, status colours), the site header and
  footer, and the home page match the client's screenshots.

## Remaining

### A. Screens still to match the design (Khumo)

| Screen | Route |
|---|---|
| Developers / Our Services | `/developers` |
| Investments / cash sale | `/investments` |
| Listings map and filters | `/listings` |
| Listing detail, route finder, offer form | `/listings/$id` |
| Request a quote | `/request` |
| Sell for cash | `/sell` |
| Book a date | `/book` |
| Contact | `/contact` |
| Sign in and demo accounts | `/auth` |
| Client portal and My offers | `/client`, `/offers` |
| Admin: lead triage, jobs, bookings | `/admin` |
| Agent offer console | `/agent` |
| Supervisor job cards | `/supervisor` |
| Owner analytics | `/owner` |

Shared pieces still needed: one `prettyStatus()` plus one `<StatusBadge>` used everywhere, and the
portal shell (navy bar, role chip, tabs, alerts popover).

### B. Firebase migration

Phases and branch order are in [firebase-migration.md](firebase-migration.md): auth, then public
form writes, then listings and offers, then the dashboards, then dropping Supabase.

### C. Functionality to verify once the screens are done

The offer lifecycle is the flagship flow: a buyer submits, the agent approves, declines or
counters, the buyer accepts or declines a counter, and every step writes an audit entry and
notifies the other side.

## Task 2 marking rubric: 210 marks, and where we stand

From the INSY7315 module manual, section 9.4 and Annexure C. Task 2 is 70% of the task weighting.

| Rubric row | Marks | Where we are | Owner |
|---|---|---|---|
| Front end: visual design and branding | 10 | Tokens, header, footer and home match the client's screenshots. 14 screens to go. | Khumo |
| Front end: UX and feedback | 10 | Toasts, loading skeletons and inline form errors exist but are not applied consistently yet. | Khumo |
| Front end: responsiveness and accessibility | 15 | **Not started.** Needs a mobile/tablet/desktop pass, keyboard navigation, focus states, alt text and contrast checks. | Khumo |
| Back end: programming skills | 25 | Modular: routes, server functions, hooks, shared lib helpers. Error handling in place. | Khumo |
| Back end: database | 20 | 13 tables, relationships, indexes, 48 RLS policies. Firestore rules mirror them. Needs an ERD in the documentation. | Khumo |
| Back end: APIs | 20 | Server functions for listings, maps and admin. Needs consistent status codes and error handling. | Khumo |
| Back end: security | 20 | Strong: RLS, Firestore rules, 26 rule tests, zod validation, no secrets in the repo. | Khumo |
| Back end: data flow and logic | 20 | Lead → job → quote and the offer lifecycle are specified; the dashboards still need building. | Khumo |
| Hosting: deployment and connectivity | 20 | **Not started.** Nothing is live yet. | Kenan |
| Hosting: stability and rationale | 15 | **Not started.** Needs the live environment plus a written rationale for the technology choices. | Kenan |
| GitHub: branching and workflow | 15 | Branch naming and workflow are documented; the rubric rewards `feature` → `develop` → `main`. | Leah |
| GitHub: CI/CD and pipelines | 20 | **Not started.** Needs automated tests and automated deployment on merge. | Kenan |

### Three things the submission rules force

1. **The submission is a GitHub link.** Section 9.6: "ONLY the group's GitHub link containing all
   source code within the GitHub link and README file". The repo currently lives on Azure DevOps.
   Either move to GitHub or push every branch there as the submission remote, and do it early so
   the commit and branch history is visible to the marker.
2. **The pipeline row says GitHub.** The CI/CD marks describe "GitHub Actions or pipeline". Building
   it as a GitHub Actions workflow in `.github/workflows/` is the least ambiguous way to earn them.
3. **The README is marked.** Section 9.6 allows the presentation material to live in the README.
   The repo currently has the Azure placeholder README with TODOs, which reads as unfinished work.

## DevOps: Leah and Kenan

None of this needs the frontend work to be finished, so it can start now. Each item is a branch and
a pull request of its own. Together these rows are 70 of the 210 marks.

### Kenan — hosting and pipelines (55 marks)

1. **Get the repo onto GitHub** — create the group repository, push `main` and every feature branch
   with full history, and add Leah and Khumo as collaborators. Keep Azure DevOps as a mirror if the
   team prefers, but GitHub is what gets submitted.
2. **`chore/ci-pipeline`** — `.github/workflows/ci.yml`, running on every pull request into `main`
   and `develop`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Cache `~/.npm`.
3. **`chore/rules-tests-ci`** — run the security rule tests in the same workflow with
   `npx firebase emulators:exec --project demo-prop3000 "node --test scripts/test-rules.mjs"`.
   The runner has Java pre-installed. This is the "automated tests run on code changes" evidence.
4. **`chore/deploy-cloudflare`** — deploy on merge to `main`: `npm run build` then
   `npx wrangler deploy`, with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub secrets.
   This is the "automated deployment to hosting" evidence, and it makes the site live.
5. **`chore/deploy-firebase-rules`** — `firebase deploy --only firestore:rules,storage:rules` on
   merge, using a service account stored as a secret.
6. **Hosting rationale** — half a page on why Cloudflare Workers and Firebase: edge deployment, free
   tier limits, how the database connects, and what happens if a deploy fails. The rubric asks for
   the reasoning, not just the URL.

### Leah — repository health, quality and documentation (15 marks plus evidence for the rest)

1. **Create `develop`** off `main` and make it the default branch for feature work. The rubric names
   `feature`, `develop` and `main` explicitly, and the top band is "rigorous branching and merge
   discipline".
2. **Branch protection on `main` and `develop`** — require a pull request, one approving review and
   a passing CI check. Never allow direct pushes.
3. **`.github/pull_request_template.md`** — the definition of done: lint, type check and build pass,
   screenshots for UI changes, rule tests updated when rules change.
4. **Rewrite the README** — what the product is, the stack, how to run it locally, the live URL, a
   screenshot or two, the team members, and a link to the presentation material. This is submitted
   as part of the mark.
5. **`chore/secret-scanning`** — a CI step that fails the build if a key is committed (gitleaks or
   similar), plus `npm audit --omit=dev` as a warning.
6. **Onboarding check** — clone into a clean folder, follow `CONTRIBUTING.md` exactly, fix whatever
   does not work. The most valuable hour anyone can spend on this repo.
7. **Releases** — tag each merge to `main` (`v0.1.0`, `v0.2.0`) with short release notes. Cheap
   evidence of merge discipline for the branching row.

### Shared

- Review each other's pull requests, so nothing merges unreviewed. The marker can see this.
- Never force-push or rewrite pushed history.

## What to do with `feature/project-setup`

It carries the whole portal, so it is the branch everything else is built on. In order:

1. **Set up GitHub and the branch protection first** (Kenan and Leah, above). Merging before the
   protection exists means the rules never get exercised, and the marker sees no workflow.
2. **Push it and open a pull request into `develop`.** It is large because it is the initial import;
   the 26 commits are sliced by area so it can be reviewed a piece at a time. `develop` then merges
   into `main` once CI is green, which is the branching pattern the rubric asks for.
3. **Reviewers check three things**, not every line: that no `.env` file or key is included, that
   `npm ci && npm run build` works on a clean clone, and that `.env.example` lists every variable
   the app reads.
4. **Merge it into `main`.** Do not squash: the commit slices are the review trail.
5. **After the merge**, everyone starts their branches from the updated `main`:
   `git switch main && git pull && git switch -c <type>/<name>`.
6. **`feature/firebase-setup` goes next**, since it branches off project-setup and the rule tests
   are the gate for all later Firestore work.
