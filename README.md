# PROP3000 Portal

PROP3000 Portal is a full-stack web application developed for Prop3000 Developers and Prop3000 Investments. The platform combines the company's public-facing website with a role-based portal used to manage property enquiries, service requests, jobs, quotes, bookings, property listings and offers.

The application is built with **TanStack Start and React 19**, hosted using **Cloudflare Workers**, and is currently being migrated from Supabase to **Firebase Authentication, Cloud Firestore and Firebase Storage**.

---

## Live Environments

| Environment | Cloudflare Worker | URL |
|---|---|---|
| Production | `p3000portal` | https://p3000portal.prop3000.workers.dev/ |
| Staging | `p3000portal-staging` | https://p3000portal-staging.prop3000.workers.dev/ |

The staging environment is used to test application and Firebase changes before they are promoted to production.

Production and staging are designed to use separate Firebase projects so that development and testing data cannot interfere with the live environment.

---

## Product Overview

The portal supports both public users and authenticated users.

### Public Website

Public functionality includes:

- Prop3000 Developers service information
- Prop3000 Investments information
- Property listings and listing detail pages
- Service quote requests
- Property sale submissions
- Booking requests
- Contact information
- Map-based property functionality through Mapbox
- Portal authentication

### Role-Based Portal

Authenticated users are assigned one of five roles:

| Role | Purpose |
|---|---|
| Client | Track requests, quotes, bookings and property offers |
| Admin | Manage leads, jobs, bookings and office workflows |
| Agent | Manage listings and property offers |
| Supervisor | Manage assigned jobs, progress and job history |
| Owner | View business-wide analytics and operational information |

Role information is stored in Firebase using the authenticated user's Firebase UID.

---

## Technology Stack

| Area | Technology |
|---|---|
| Application framework | TanStack Start |
| UI | React 19 |
| Routing | TanStack Router |
| Server state | TanStack Query |
| Build tooling | Vite 8 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| UI components | Radix UI / shadcn-style components |
| Authentication | Firebase Authentication |
| Application data | Cloud Firestore |
| File storage | Firebase Storage |
| Legacy / migration data layer | Supabase |
| Maps | Mapbox GL |
| Charts | Recharts |
| Validation | Zod |
| Notifications | Sonner |
| Hosting | Cloudflare Workers |
| Firebase tooling | Firebase CLI |
| Security testing | Firebase Rules Unit Testing |
| Code quality | ESLint / Prettier |

---

## Application Architecture

PROP3000 separates application hosting from managed backend services.

TanStack Start produces a server-side application bundle and public client assets during the build process. The resulting output is deployed to **Cloudflare Workers**, which executes the application server bundle and serves the static assets.

Firebase provides these managed backend services used by the portal:

- **Firebase Authentication** - user authentication
- **Cloud Firestore** - application data
- **Firebase Storage** - uploaded files and images
- **Firebase Security Rules** - authorization and data-access boundaries

Cloudflare deployment settings are stored in the root `wrangler.jsonc`.

The deployment structure is:

```text
develop
   |
   v
p3000portal-staging
   |
   v
Staging Firebase project


main
   |
   v
p3000portal
   |
   v
Production Firebase project
```

The application is currently undergoing a phased migration from Supabase to Firebase. Authentication and Firebase infrastructure are being migrated independently from the remaining application data flows so that each part of the application can be tested before Supabase is removed completely.

For more detail, see:

```text
docs/firebase-migration.md
```

---

## Project Structure

```text
src/
├── assets/
├── components/
├── hooks/
├── integrations/
├── lib/
├── routes/
│   ├── _authenticated/
│   │   ├── admin.tsx
│   │   ├── agent.tsx
│   │   ├── client.tsx
│   │   ├── dashboard.tsx
│   │   ├── offers.tsx
│   │   ├── owner.tsx
│   │   ├── supervisor.tsx
│   │   └── route.tsx
│   ├── auth.tsx
│   ├── book.tsx
│   ├── contact.tsx
│   ├── developers.tsx
│   ├── index.tsx
│   ├── investments.tsx
│   ├── listings.$id.tsx
│   ├── listings.index.tsx
│   ├── request.tsx
│   └── sell.tsx
├── router.tsx
├── server.ts
└── styles.css
```

Other important project files include:

```text
firebase.json
firestore.rules
firestore.indexes.json
storage.rules
wrangler.jsonc
scripts/
supabase/
```

---

## Getting Started

### Requirements

Before running the project locally, install:

- Node.js 20 or later
- npm
- Java 21 for the Firebase emulators
- Docker and the Supabase CLI if working with the remaining Supabase data layer

Clone the repository:

```sh
git clone https://Prop3000@dev.azure.com/Prop3000/P3000portal/_git/P3000portal
cd P3000portal
```

Install dependencies:

```sh
npm install
```

Copy the environment template:

```sh
cp .env.example .env
```

On Windows, the file can also be copied manually.

Fill in the required environment variables before starting the application.

---

## Environment Configuration

The project uses environment variables for Firebase, Supabase and Mapbox.

Example:

```env
# Supabase
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=<project-id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=<project-id>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Use Firebase emulators locally when required
VITE_FIREBASE_EMULATORS=false

# Mapbox
VITE_MAPBOX_PUBLIC_TOKEN=
MAPBOX_ACCESS_TOKEN=
```

Never commit `.env`, service-account JSON files or private credentials.

Firebase web configuration values are client configuration values. Firestore and Storage access is protected using Firebase Security Rules.

Sensitive deployment credentials and service-account credentials are stored separately from the repository.

---

## Running Locally

Start the application:

```sh
npm run dev
```

The local development server runs at:

```text
http://localhost:8080
```

### Firebase Emulators

Start the local Firebase emulator suite:

```sh
npm run emulators
```

The configured emulator ports are:

| Service | Port |
|---|---:|
| Authentication | 9099 |
| Firestore | 8081 |
| Storage | 9199 |
| Emulator UI | 4000 |

To use the emulators, set:

```env
VITE_FIREBASE_EMULATORS=true
```

The Windows emulator launcher uses `scripts/emulators.mjs` to avoid Java temporary-directory issues.

---

## Supabase During Migration

Supabase is still present while the Firebase migration is completed.

For local Supabase development:

```sh
npx supabase start
```

To recreate the local database and apply the demo seed data:

```sh
npx supabase db reset
```

The long-term application architecture replaces Supabase authentication, database access and storage with Firebase.

The migration is performed incrementally so that each application workflow can be verified before the previous implementation is removed.

---

## Demo Accounts

Five shared demo users are provided for testing each portal role.

| Role | Email |
|---|---|
| Client | `client@prop3000.demo` |
| Admin | `admin@prop3000.demo` |
| Agent | `agent@prop3000.demo` |
| Supervisor | `supervisor@prop3000.demo` |
| Owner | `owner@prop3000.demo` |

Demo password:

```text
Prop3000#2026
```

Firebase demo users can be created or updated using:

```sh
npm run seed:demo-users
```

The script creates the Firebase Authentication users and matching:

```text
user_roles/{uid}
```

Firestore documents.

A Firebase service-account credential is required when running the script against a hosted Firebase project. The service-account key must never be committed to the repository.

---

## Build

Create a production build:

```sh
npm run build
```

Create a staging build:

```sh
npm run build:staging
```

The generated Cloudflare-compatible output is written to:

```text
.output/
```

The root `wrangler.jsonc` contains the persistent Cloudflare deployment configuration.

---

## Cloudflare Deployment

### Staging

Build the staging application:

```sh
npm run build:staging
```

Deploy it to the staging Worker:

```sh
npx wrangler deploy --config wrangler.jsonc --env staging
```

This deploys to:

```text
p3000portal-staging
```

### Production

Build the production application:

```sh
npm run build
```

Deploy production:

```sh
npx wrangler deploy --config wrangler.jsonc
```

This deploys to:

```text
p3000portal
```

The generated `.output/server/wrangler.json` is build output and should not be used as the permanent deployment configuration. The repository-level `wrangler.jsonc` is the source-controlled deployment configuration.

---

## Testing and Code Quality

### Lint

```sh
npm run lint
```

### Type Checking

```sh
npx tsc --noEmit
```

### Production Build

```sh
npm run build
```

### Firebase Security Rules

Run the Firebase emulators:

```sh
npm run emulators
```

Then, in another terminal:

```sh
npm run test:rules
```

The project contains **26 automated Firestore security-rule tests** covering important authorization boundaries, including:

- anonymous public submissions
- client-owned data
- role escalation prevention
- supervisor job access
- listing visibility
- offer ownership
- agent actions
- administrative access
- unhandled collections

Security-rule changes should always be accompanied by a passing rules test suite.

---

## Firebase Security

Firestore and Storage access is controlled through:

```text
firestore.rules
storage.rules
```

The security model prevents users from obtaining access simply by modifying client-side application code.

Examples of enforced boundaries include:

- clients can access their own records
- users cannot assign themselves privileged roles
- supervisors can access assigned jobs
- unpublished listings remain restricted
- offers are restricted to the relevant parties
- administrative operations are limited by role

Firebase Security Rules are tested locally before deployment.

---

## Screenshots

Screenshots of the public website and authenticated portal should be stored under:

```text
docs/screenshots/
```

Recommended screenshots include:

- Home page
- Property listings
- Property listing detail
- Portal login
- Client portal
- Admin portal
- Agent portal
- Supervisor portal
- Owner dashboard

Example:

```markdown

```

---

## Entity Relationship Diagram

The project database model and relationships are documented through the project ERD.

Recommended location:

```text
docs/database/prop3000-erd.webp
```

Example:

```markdown
[![PROP3000 ERD](docs/database/prop3000-erd.webp)](docs/database/prop3000-erd.webp)
```

---

## Development Workflow

Development work is completed on topic-specific branches.

Common prefixes include:

```text
feature/
fix/
chore/
docs/
```

Changes should be kept to one clear topic per branch.

Before opening a pull request, contributors should run:

```sh
npm run lint
npx tsc --noEmit
npm run build
```

If Firebase security rules were modified, also run:

```sh
npm run test:rules
```

The repository contains a pull request template under:

```text
.github/pull_request_template.md
```

which provides the project's Definition of Done and review checklist.

For detailed development instructions, see:

```text
CONTRIBUTING.md
```

---

## Hosting Strategy

PROP3000 uses Cloudflare Workers for application hosting and Firebase for managed backend services.

TanStack Start generates a server-side application bundle that can be executed by Cloudflare Workers together with the application's static assets. This removes the requirement to manage a traditional dedicated web server while still allowing server-rendered application functionality.

Firebase provides authentication, Firestore data storage and file storage independently from the application hosting platform.

Separate staging and production environments reduce deployment risk by allowing application changes to be tested against real hosted infrastructure before they reach the production system.

---

## Team

| Team Member | Role | Responsibilities |
|---|---|---|
| Khumo | Tech Lead and Reviewer | Repository management, architecture decisions, pull request review and final integration |
| Leah | Application Developer | Application screens, portal dashboards, user-facing functionality and Firebase migration |
| Kenan | Platform and Quality | Hosting, CI/CD, environments, Firebase setup, testing, seed data and documentation |

---

## Documentation

Relevant documents include:

```text
docs/firebase-migration.md
CONTRIBUTING.md
```

Additional platform, environment, hosting and testing documentation is added as the project progresses.

---

## Contributing

See:

```text
CONTRIBUTING.md
```

for:

- local development setup
- environment configuration
- branching conventions
- Firebase emulator setup
- security-rule testing
- seed data
- deployment guidance
- design implementation rules

---

## Project Status

PROP3000 is under active development.

Current platform work includes:

- Cloudflare production hosting
- Cloudflare staging hosting
- Firebase Authentication
- Cloud Firestore
- Firebase Security Rules
- Firebase demo-user seeding
- Supabase-to-Firebase migration
- Staging and production environment separation
