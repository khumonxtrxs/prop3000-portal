# Notes for contributors and AI coding agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. It covers setup, branch naming and the pull request workflow.

- **History:** never force-push, rebase, amend or squash commits that are already pushed. Teammates build on them.
- **Branches:** work on a `feature/`, `fix/`, `chore/` or `docs/` branch off `main`, never directly on `main`. Keep each branch working (`npm run build` passes).
- **Stack:** TanStack Start file routes in `src/routes/` (see `src/routes/README.md`), Tailwind v4 tokens in `src/styles.css`, shadcn/ui in `src/components/ui/`, Firebase in `src/integrations/firebase/` (Auth, Firestore, Storage; rules in `firestore.rules` and `storage.rules`), Mapbox through `LazyMap`.
- **Design:** `design_handoff_prop3000_portal/` is the source of truth for layout, colour, copy and status vocabulary.
- **Secrets:** never commit `.env` or keys. Add any new variable to `.env.example`.
