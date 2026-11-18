# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ESA is a Nuxt 4 app for running the EPICS program: tracking partners, projects, students, and semesters, assigning
students to project teams via a constraint solver, and provisioning Discord channels/roles and GitHub repos for the
resulting teams. It started from a Nuxt + Better Auth + Prisma + SQLite template (see `README.md`), so template
boilerplate and program-specific code coexist.

## Commands

```bash
pnpm install
pnpm dev            # nuxt dev (app on :3000)
pnpm build          # nuxt build -> .output
pnpm prisma:reset   # migrate reset -f && migrate dev && generate && db seed
npx prettier --write .
```

There is no test runner and no lint script. `server/services/CPSAT/test.ts` is a standalone harness run with
`npx tsx server/services/CPSAT/test.ts` (its README's `cd algorithms/CPSAT` path is stale).

Any schema change means re-running `pnpm prisma:reset`, which wipes `dev.db` and re-seeds it. The Prisma client is
generated into `prisma/generated/` (checked in, not `node_modules`) and configured via `prisma.config.ts`, not a
`generator` block URL — the datasource URL comes from `DATABASE_URL` at runtime.

The CP-SAT solver needs Python 3.8+ with `ortools` installed on the host (`pip install ortools`). Team generation
fails at runtime without it; nothing else in the app depends on Python.

## Architecture

**Request path:** `server/api/**` (Nitro file-routed handlers) → `server/services/*Service.ts` → `prisma` from
`server/utils/prisma.ts`. Handlers stay thin: parse params/body, map errors to `createError`, delegate. Business
logic and all Prisma access belong in services.

**Service convention.** Each entity service exports `XRead` / `XCreate` / `XUpdate` interfaces plus a default object
of CRUD functions (`studentService.getStudentById`, etc.). `XRead` types spell out the shape by hand — including
nested relations that the service's `include` always fetches — rather than deriving from Prisma types. Nested
creates are accepted as `Omit<ChildCreate, 'parentId'>[]` and passed through as `{create: ...}`. Follow this shape
when adding an entity; `studentService.ts` is the clearest reference.

**Imports.** `#server/*` resolves to `server/*` and `@@/*` to the repo root (Prisma enums come from
`@@/prisma/generated/client`) — use these Nuxt-generated aliases instead of relative paths in server code.

**Data model** (`prisma/schema.prisma`): `Partner` → `Project` → `Team`, where a `Team` is one project in one
`Semester` on one meeting day (Wednesday/Thursday). Students connect through three per-semester join models:
`Enrollment` (major/year/class/meeting day), `Choice` (ranked project preferences), and `Membership` (team
assignment, with an `isMentor` flag). Semester is first-class and most queries filter on it. Better Auth tables
(`user`, `session`, `account`, `verification`) are separate — a logged-in user is not linked to a `Student`.

**Team formation** (`server/api/team-formation/generate.post.ts`) loads non-mentor students for a semester+day,
translates Prisma rows into the CP-SAT wire types (which key on project _names_, not ids, and use their own enum
spellings), shells out to `server/services/CPSAT/team_generator.py` via `ortools.ts`, then maps names back to ids.
It post-processes: students with no valid choices get placed into undersized teams, undersized teams borrow from
oversized ones, and the request 400s if minimum team size still can't be met. It writes `Membership` rows as a side
effect — calling it twice for a semester will duplicate memberships.

**Integrations.** `discordBotService.ts` and `githubService.ts` hold module-level singletons and mutable status
(`running`/`stopped`/`error`) that `/api/discord/*` and `/api/github/*` start, stop, and query. Both degrade
gracefully at runtime when `DISCORD_BOT_TOKEN` / `GITHUB_TOKEN` are absent, but `GithubManagement.ts` statically
`import`s `@octokit/rest` at module top-level and Nitro bundles all of `server/api/**` into one module graph, so a
missing package anywhere in it 500s _every_ API route — check for an uninstalled top-level import first if routes
fail with `Cannot find package '...'`. `server/plugins/discordBot.ts` also auto-starts a bot at Nitro startup,
duplicating `discordBotService` — be aware both paths exist before changing bot lifecycle.

**Frontend** (`app/`) implements the Database page from `docs/design/ui.md`, gated by `app/middleware/auth.global.ts`
(no session → `/auth`, session on `/auth` → `/`). Auth is Better Auth email-OTP only, no passwords. Major records
(Partner/Project/Student) get full `DataTable.vue` treatment: pagination, sort, filter, row-select, and staged
add/edit/delete via `useStagedChanges.ts` and a shared Confirm/save envelope (`useStagedSave.ts`). Minor records
(Team, Contact, Choice, Enrollment, Membership) have no list endpoints — always nested inside a major record's
response, edited via `useRecordModals()` modals or row-expansion, never fetched standalone. `database.vue` gates
tab/semester switching through `confirmDiscard` so a `UTabs` panel unmount never silently destroys staged changes.
See `app/composables/` and `app/utils/` for shared building blocks before adding a new one.

## Docs

`docs/design/ui.md` is the spec for the UI as built (shell, table/staging/modal patterns, per-page behavior) — read
it before building frontend pages. `docs/design/team_generation.md` documents the team-formation/CP-SAT design.
`docs/better_auth.md` and `docs/file_upload_and_serve.md` are template docs carried over from the upstream starter.

## Conventions

Prettier config is authoritative: no semicolons, single quotes, 100 columns, ES5 trailing commas. Much of
`server/` predates this and is inconsistent (semicolons, 4-space continuations) — match the file you are editing
rather than reformatting it wholesale. `vueIndentScriptAndStyle` is on, so `<script setup>` content in `app/*.vue`
files is indented one level under the tag, as in `auth.vue`/`app.vue`.

- **Nuxt UI v4 + Tailwind only.** Compose pages from `@nuxt/ui` components and Tailwind utility classes. Do not add
  another component/UI library or hand-roll a component (a data table, a combobox, a stepper) buildable by composing
  existing Nuxt UI primitives — extend the shared components in `app/components/` instead.
- **`useOverlay()` for imperatively-triggered dialogs**, not inline `v-model:open`, for anything opened from
  multiple places (confirmations, record-search pickers, minor-record creation modals): `overlay.create(MyModal)`,
  then `await instance.open(props).result`, with the child emitting `close` with the payload — see `useConfirm.ts`.
- **Types come from the server, not re-declared.** Import `XRead`/`XCreate`/`XUpdate` as `import type {...} from
'#server/services/xService'` — see any `*Tab.vue` for the pattern.
- Auto-imports apply throughout `app/`: components and composables don't need explicit imports (Nuxt UI components
  and `useOverlay` are also auto-registered by `@nuxt/ui`) — except a type used inside `defineProps<T>()`/
  `defineEmits<T>()`, which `@vue/compiler-sfc` resolves from local imports, not auto-import, so keep those explicit.
