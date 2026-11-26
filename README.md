# EPICS Super App (ESA)

ESA tracks EPICS students, semester enrollments, projects, assignments, and program insights. The local redesign is available at `/database-redesign`.

## Run locally

1. Install the pinned dependencies with `pnpm install --frozen-lockfile`.
2. Use `.env.example` to configure your local environment. For the existing local copy, keep its database and environment settings.
3. Run `pnpm dev --host 127.0.0.1 --port 5173` and open `http://127.0.0.1:5173/database-redesign`.

Use your ESA account at `/auth`. AI search requires an administrator session and a server-side OpenRouter key set as `NUXT_OPENROUTER_API_KEY`. Keep credentials in the local environment. `pnpm prisma:reset` erases and reseeds the configured database, so use it only for a disposable database.

## Where to edit

| Area | Location |
| --- | --- |
| Redesign navigation, theme, and pinned results | `app/pages/database-redesign.vue` |
| Dashboard, student and project pages, charts, and PDF export | `app/components/database-redesign/` |
| Imported records, semester profiles, and local edits | `app/components/verified-data.json`, `data.ts`, and `contentStore.ts` in `app/components/` |
| Shared project status rules | `app/components/projectSemesterStatus.ts` |
| Admin-gated AI search | `server/api/ai/ask.post.ts` |
| AI request validation, planning, and calculations | `server/utils/ai/` |
| Database schema, migrations, and seed data | `prisma/` |

The redesign starts from verified imported records. The content store applies edits made in the browser. AI requests send that current workspace state to the local server, which validates it and combines it with database metadata. The model interprets the question, and the server calculates the result from recorded data. A student can count once in each semester they enrolled in, so semester enrollments and unique students use different denominators.

## Checks

- `pnpm check:views` compiles the redesigned views.
- `pnpm test` checks report calculations, filters, authorization, and result rendering models. Database-backed tests use the configured local test records, so run them against a local development database.
- The import scripts and live AI audits in `scripts/` are maintenance tools. Some use local data preparation files or an OpenRouter key.

## Beginner File Walkthrough

See the [file-by-file guide](docs/code-walkthrough/README.md) for purpose, inputs, outputs, pseudocode, and notes for markup, styles, and schema files.

## Local records on this branch

The redesign starts with an empty workspace. The dev and build commands create
`app/components/verified-data.json` from the empty example only when the local
file is missing. Staff with an approved ESA import can place that file there
before starting the app. Do not commit real imports or the local database.

The academic reporting tests and live audits expect the verified roster data
and the matching local development database. Use `pnpm check:views` to check
Vue compilation on a fresh checkout with the empty workspace.
