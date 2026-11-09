# ESA UI Design — v1.2

This document describes the UI **as built**. It supersedes `UIDesign-v1.0.md`, which was a forward-looking spec;
where the implementation diverged from that plan, the divergence is recorded here as the current design.

The **staged-changes editing model** (§2.3.1) replaces v1.0's Item Panel and Creation Panel outright. It is
implemented; §3.4 records the limits that remain.

Stack: Nuxt 4 + Nuxt UI v4 + Tailwind. All components live in `app/`; no other UI library is used.

---

## Table of contents

1. [App Overview](#1-app-overview)
   1. [Shell (`app/app.vue`)](#11-shell-appappvue)
   2. [Routes](#12-routes)
   3. [Authentication](#13-authentication)
   4. [Account Activation](#14-account-activation)
2. [Shared Components](#2-shared-components)
   1. [Navbar (`components/Navbar.vue`)](#21-navbar-componentsnavbarvue)
   2. [Semester Filter (`components/SemesterFilter.vue`)](#22-semester-filter-componentssemesterfiltervue)
   3. [Data Table (`components/DataTable.vue`)](#23-data-table-componentsdatatablevue)
      1. [Staged changes](#231-staged-changes)
      2. [Toolbar (above the table)](#232-toolbar-above-the-table)
      3. [Column headers](#233-column-headers)
      4. [Expansion and selection columns](#234-expansion-and-selection-columns)
      5. [Cells and inline editing](#235-cells-and-inline-editing)
      6. [Pagination (below the table)](#236-pagination-below-the-table)
   4. [Confirmation Modal (`components/ConfirmationModal.vue` + `composables/useConfirm.ts`)](#24-confirmation-modal-componentsconfirmationmodalvue-composablesuseconfirmts)
   5. [Record Search Input (`components/RecordSearchInput.vue`)](#25-record-search-input-componentsrecordsearchinputvue)
   6. [Utilities](#26-utilities)
   7. [Icon Reference](#27-icon-reference)
3. [Database (`pages/database.vue`)](#3-database-pagesdatabasevue)
   1. [Projects Tab](#31-projects-tab)
      1. [Table](#311-table)
      2. [New Project Row](#312-new-project-row)
      3. [Expanded Row — Description and Teams](#313-expanded-row-description-and-teams)
      4. [Team Creation Modal](#314-team-creation-modal)
      5. [Member Creation Modal](#315-member-creation-modal)
      6. [Move Student Modal](#316-move-student-modal)
   2. [Students Tab](#32-students-tab)
      1. [Table](#321-table)
      2. [New Student Row](#322-new-student-row)
      3. [Expanded Row — Semester Info](#323-expanded-row-semester-info)
      4. [Team Preference Modal](#324-team-preference-modal)
      5. [Semester Info Creation Modal](#325-semester-info-creation-modal)
   3. [Partners Tab](#33-partners-tab)
      1. [Table](#331-table)
      2. [Expanded Row — Contacts and Projects](#332-expanded-row-contacts-and-projects)
      3. [Contact Creation Modal](#333-contact-creation-modal)
   4. [Implementation notes and known limits (Database)](#34-implementation-notes-and-known-limits-database)
      1. [Shared composables and utils](#341-shared-composables-and-utils)
4. [Team Formation (`pages/team-formation.vue`)](#4-team-formation-pagesteam-formationvue)
   1. [Step 1 — Semester](#41-step-1-semester)
   2. [Team Export](#42-team-export)
   3. [Step 2 — Bid Files](#43-step-2-bid-files)
      1. [Students With No Bid](#431-students-with-no-bid)
   4. [Step 3 — Manage Teams](#44-step-3-manage-teams)
      1. [Toolbar](#441-toolbar)
      2. [Team settings (⚙)](#442-team-settings-)
      3. [All teams](#443-all-teams)
      4. [Workbench](#444-workbench)
      5. [Versions](#445-versions)
      6. [Phones](#446-phones)
5. [User Management (`pages/users.vue`)](#5-user-management-pagesusersvue)
   1. [Active Users card](#51-active-users-card)
   2. [Inactive Users card](#52-inactive-users-card)
   3. [Business rules (`server/services/userService.ts`)](#53-business-rules-serverservicesuserservicets)

---

## 1. App Overview

### 1.1 Shell (`app/app.vue`)

`UApp` wrapping a full-height column: a sticky, blurred header over a `<main>` that renders `<NuxtPage />`.

| Element      | Component                            | Behavior                                                     |
| ------------ | ------------------------------------ | ------------------------------------------------------------ |
| Logo         | `NuxtLink` + `UIcon` (cube, primary) | "ESA" wordmark; navigates to `/`                              |
| Navigation   | `Navbar.vue`                         | See §2.1                                                      |
| Theme toggle | `UButton` (ghost, neutral)           | Toggles `useColorMode()` between light/dark; icon is sun/moon |

Container width is widened globally to `--ui-container: 95%` (`app/assets/css/main.css`), so pages using
`UContainer` span nearly the full viewport.

| Shell state | Trigger                   | Appearance                              |
| ----------- | ------------------------- | --------------------------------------- |
| Light       | `colorMode !== 'dark'`    | White surfaces, sun icon on the toggle   |
| Dark        | `colorMode === 'dark'`    | `gray-900` surfaces, moon icon on toggle |

### 1.2 Routes

| Route             | File                        | Status                                                                                                       |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`               | `pages/index.vue`           | **Template boilerplate** — user list, profile-picture upload modal, logout. Not part of the ESA design.        |
| `/auth`           | `pages/auth.vue`            | Implemented (§1.3)                                                                                            |
| `/database`       | `pages/database.vue`        | Implemented (§3)                                                                                              |
| `/team-formation` | `pages/team-formation.vue`  | Implemented (§4)                                                                                              |
| `/automation`     | `pages/automation.vue`      | Placeholder — a single neutral `UAlert` reading "This page is not yet implemented."                            |
| `/users`          | `pages/users.vue`           | Implemented, admin-only (§5)                                                                                    |
| `/inactive`       | `pages/inactive.vue`        | Implemented (§1.4) — shown in place of any route while `session.user.active` is false                          |

### 1.3 Authentication

`app/middleware/auth.global.ts` runs on every navigation:

| Session | `user.active` | Target route              | Result                      |
| ------- | -------------- | -------------------------- | ---------------------------- |
| Present | —              | `/auth`                     | Redirect to `/`              |
| Present | `false`        | anything but `/inactive`    | Redirect to `/inactive`      |
| Present | `false`        | `/inactive`                  | Allowed                      |
| Present | `true`         | `/inactive`                  | Redirect to `/`              |
| Present | `true`         | `/users`, not `ADMIN`        | 403 "Admins only"            |
| Present | `true`         | anything else                | Allowed                      |
| Absent  | —              | `/auth`                     | Allowed                      |
| Absent  | —              | anything else                | Redirect to `/auth`          |

**Login page** (`pages/auth.vue`) — a centered `UCard` titled "Login" containing a two-step `UForm` with a Zod
schema that widens once the OTP has been sent. Email-OTP only; there is no password field.

| State                        | Fields shown              | Submit button | On success                                   | On error                          |
| ---------------------------- | ------------------------- | ------------- | -------------------------------------------- | --------------------------------- |
| `isEmailSent === false`      | Email `UInput`            | "Send OTP"    | Success toast; advances to the OTP state      | Error toast with the auth message |
| `isEmailSent === true`       | 6-digit `UPinInput` (otp) | "Login"       | External navigation to `/`                    | Error toast with the auth message |

Logging in requires an email that already exists in the `user` table. The OTP arrives by Nodemailer, or can be read
from the `verification` table in Prisma Studio.

### 1.4 Account Activation

A new `user` row starts with `active = false` (`prisma/schema.prisma` default) until an admin activates it from
`/users` (§5). `role` and `active` are both registered as Better Auth `user.additionalFields`
(`server/utils/auth.ts`) with `input: false`, so they ride along on `session.user` but a signed-in user can never
set either on themselves through `updateUser`.

| Layer    | Enforcement                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| Frontend | `auth.global.ts` (above) redirects any inactive session to `pages/inactive.vue` — a centered card explaining the account needs admin approval, with a Log Out button — and bounces an active session away from `/inactive`. |
| Server   | `server/middleware/authMiddleware.ts` runs on every request; for a session where `user.active === false` it 403s any `/api/**` route other than `/api/auth/**`, so sign-in/sign-out/session calls keep working while every other endpoint (including the ones a page's SSR fetch would hit) is blocked regardless of what the frontend redirect does. |

Because the Nitro middleware checks the session directly, an inactive user cannot reach any data endpoint by
calling it directly, even if a client-side redirect were bypassed.

---

## 2. Shared Components

### 2.1 Navbar (`components/Navbar.vue`)

A `UNavigationMenu` plus a trailing Logout button.

| Item            | Icon                  | Target            |
| --------------- | --------------------- | ----------------- |
| Database        | circle-stack          | `/database`       |
| Team Formation  | user-group            | `/team-formation` |
| Automation      | bolt                  | `/automation`     |
| User Management | shield-check          | `/users`          |
| Logout          | arrow-right-on-rect.  | Calls `authClient.signOut()`, then navigates to `/auth` with a full reload |

User Management is only shown when `session.value.user.role === 'ADMIN'`; the route itself is also gated
(§1.3) so a non-admin who navigates there directly gets a 403 rather than an empty page — see §5.

### 2.2 Semester Filter (`components/SemesterFilter.vue`)

`v-model` is a `semesterId | undefined`. The component is **fully controlled** — an explicit `modelValue` prop plus
an `update:modelValue` emit, not `defineModel` — because `defineModel` keeps a local value, and a caller that
declines a change (§2.3.2, §3) needs the dropdown to keep showing the semester the page actually adopted rather
than snapping to whatever was picked before the decline. Backed by `useSemesters()` (`composables/useSemesters.ts`),
which fetches `/api/semesters` under the shared key `semesters` so every mounted instance shares one cache and one
refresh.

| Sub-element          | Component                | Visible when          | Action / result                                                                 |
| -------------------- | ------------------------ | --------------------- | ------------------------------------------------------------------------------- |
| Semester Selection   | `USelectMenu` (w-48)     | Always                | Sets the model; placeholder "All Semesters" when unset. Labels read `Fall 2025`. |
| Semester Clear       | `UButton` ✗ (ghost)      | A semester is selected| Resets the model to `undefined`                                                  |
| Delete Semester      | `UButton` − (error/soft) | A semester is selected| Opens the Confirmation Modal; on confirm `DELETE /api/semesters/:id`, refreshes the list, clears the selection. Failures surface as an error toast. |
| Add Semester         | `UButton` + (soft)       | Always                | Opens the Create Semester Modal; on confirm `POST /api/semesters` then refresh   |

| State                        | Condition                                                     | Effect                                                                 |
| ---------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Deletable                    | `teamCount + enrollmentCount + choiceCount === 0`              | Delete enabled; tooltip "Delete this semester"                          |
| Locked                       | The semester has any teams, enrollments, or choices            | Delete **disabled**; tooltip explains those records must be removed first |
| Dangling selection recovered | The selected semester disappears from the shared semester list | A watcher clears the model so the filter cannot point at a deleted row  |

**Create Semester Modal** (`components/CreateSemesterModal.vue`) — a `UModal` opened imperatively via
`useOverlay()`; emits `close` with a `SemesterCreate` or `null`.

| Field  | Input                                          | Validation (Zod)                                                     |
| ------ | ---------------------------------------------- |----------------------------------------------------------------------|
| Season | `URadioGroup` horizontal — Spring/Summer/Fall  | Enum; defaults to `FALL`                                             |
| Year   | `UInputNumber`                                 | Integer; defaults to the current year; no commas should be displayed |

Footer: Cancel (✗) closes with `null`; Confirm (✓) submits the form.

### 2.3 Data Table (`components/DataTable.vue`)

> See `docs/design/data_table.md` for the full component reference: every prop/emit/slot, the column
> configuration API (`DataTableColumn`, filters, `editable` types, `editable.child` proxy columns),
> rendering details for every cell/row/toolbar state, and worked examples.

A generic `UTable` composition used only for the three **major records** — Partner, Project, Student. Everything
else (Team, Contact, Choice, Enrollment, Membership) renders as a plain list or `UAccordion` 
card inside the parent record's expanded row.

The parent tab supplies data plus a lightweight column definition; the table owns all rendering. The full
`DataTableColumn` shape (filters, the four `editable` types, `editable.child` proxy columns, `required`) and the
component's props/emits are in `data_table.md` §2–§5 — not repeated here. The table body sits in a `max-h-[70vh]`
scroll container with a sticky header.

#### 2.3.1 Staged changes

> See `docs/design/staging.md` for the full API surface of the composables behind this section
> (`useStagedChanges`, `useSemesterFilter`'s guards, `useStagedSave`) and worked examples of staging
> both rows and nested children.

**There are no creation or edit panels.** Creating, editing, and deleting all happen in the table itself, and every
pending change is **staged locally** in one per-table store. The table issues **no API call until Confirm is
pressed**; Cancel throws the entire store away and the table reverts to its fetched data.

| Change kind | How it is staged                                                                 | Row appearance                                              |
| ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Addition    | Add appends a blank draft row; the user fills it in inline and in its expansion   | Light green row highlight                                    |
| Edit        | Any cell or expansion field on an existing row is changed                        | Blue row highlight; each changed field gets a yellow outline |
| Deletion    | Rows are selected, then Delete is pressed                                        | Red row highlight — the row **stays in view**                |

The four highlight colours are the standard Nuxt UI semantic tints, used consistently everywhere a staged change
is shown — including inside expansions: green = being added, blue = being edited, red = marked for deletion,
yellow = this specific field changed.

Rules:

- Setting an edited field back to its original value clears that field's outline; when a row has no changed fields
  left it stops being blue, and when the store empties, Confirm/Cancel disappear on their own.
- Highlight precedence is deletion > edit > addition. Marking a staged **new** row for deletion simply drops it
  from the store rather than colouring it red.
- A deletion-marked row is read-only: its inline inputs and expansion editors are disabled until it is unmarked.
  Delete only ever marks; unmarking a row (or reverting an edit, or dropping an addition) goes through Undo
  instead — selecting it and pressing Delete again does nothing further. Cancel unmarks and reverts everything at
  once.
- Staged new rows are pinned to the top of the first page and are exempt from sorting and column filters, so a
  half-filled row can never be filtered out of view.
- Expansion editors (teams, contacts, choices, semester info — §3) write into the **same** store, so a change made
  inside a row's expansion turns that row blue and is persisted by the same Confirm.

Confirm emits one payload (`StagedPayload` — `created`/`updated`/`deleted`, defined in `staging.md` §1.5)
describing everything staged; the parent translates it into its own API calls (see each tab in §3) and refreshes
afterwards.

#### 2.3.2 Toolbar (above the table)

Add / Delete / Undo / Confirm / Cancel, each issuing no request of its own — only Confirm and Cancel ever talk to
the network, via the `save`/`cancel` payload above. The exact icon and enablement condition for each button is in
`data_table.md` §6.1.

Because Confirm and Cancel are the only write paths, switching the semester filter or switching tabs with staged
changes is a destructive act. Both are **gated**, not restored: `database.vue`'s `provideSemesterFilter()`
(`composables/useSemesterFilter.ts`) asks through the Confirmation Modal first, via `request(next)` for the
semester and `confirmDiscard(description)` for a tab switch, and only moves the semester id or the active tab once
the user confirms — declining leaves both exactly where they were, with no intermediate state to flash or restore.
Switching tabs matters here too: `UTabs` unmounts the inactive panel by default, which would otherwise destroy a
tab's staged changes with no prompt at all.

#### 2.3.3 Column headers

Each header is a small stack: label, then (when configured) a sort control, a filter control, and a filter-clear
button. Sorting, filtering, and pagination are all client-side over the already-fetched rows — see `data_table.md`
§6.2 for each control's component and exact behavior.

#### 2.3.4 Expansion and selection columns

An `expandable` table gets a chevron column that toggles the parent's `#expanded` slot beneath a row (multiple
rows may be open at once); every table gets a checkbox column with a tri-state header checkbox (all/some/none
selected). See `data_table.md` §6.5.

#### 2.3.5 Cells and inline editing

A column renders one of four editors (`text` / `select` / `switch` / `record-search`, the last being
`RecordSearchInput` — §2.5) or, without `editable`, a plain formatted/stringified value. A cell's outline —
none / yellow (edited) / red (invalid) — and whether it's disabled follow the same state a row's highlight does;
the full per-state table, including that a non-`editable` column stays display-only even on a staged new row, is
in `data_table.md` §6.3.

#### 2.3.6 Pagination (below the table)

A rows-per-page `USelectMenu` (10/25/50) and a `UPagination` beneath the table, both client-side over the
already-fetched, filtered, sorted rows. `data_table.md` §6.6 has the full control table and the table's overall
Loading/Empty/Clean/Dirty/Invalid/Saving states.

### 2.4 Confirmation Modal (`components/ConfirmationModal.vue` + `composables/useConfirm.ts`)

`useConfirm()` lazily creates one shared overlay instance and returns a function:
`await useConfirm()({ title, description?, affected?, confirmLabel? }) → boolean`.

| Element        | Source                          | Notes                                                                    |
| -------------- | ------------------------------- | ------------------------------------------------------------------------ |
| Title          | `title`                         | Usually "Delete N projects?"                                              |
| Description    | `description`                   | The cascade sentence, e.g. "This will also delete all associated teams…"   |
| Affected list  | `affected: {label, count}[]`    | Bulleted `3 Contacts`, `1 Project` — pluralized automatically; hidden when empty |
| Cancel / Confirm | Footer buttons                | Resolve `false` / `true`; Confirm is red and its label is overridable      |

The modal has no domain knowledge — each caller computes its own cascade counts before opening it.

### 2.5 Record Search Input (`components/RecordSearchInput.vue`)

A generic async-search `USelectMenu` (`ignoreFilter` + `v-model:search-term`) for picking a linked major record.
Props: `search(query) → Promise<T[]>`, `displayLabel(item)`, `placeholder`. The model is the selected record.

| State           | Condition                                     | Appearance                                                    |
| --------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Idle            | Menu opened, nothing typed yet                | Empty list — the search only runs on a search-term change      |
| Loading         | A search promise is in flight                 | `USelectMenu` spinner                                          |
| Results         | Search resolved                               | Up to the caller's cap (callers slice to 10)                   |
| Selected        | Model set                                     | Shows `displayLabel(model)`                                    |

Out-of-order responses are discarded via a monotonic token, so a slow early query cannot overwrite a newer result.

### 2.6 Utilities

| Module                 | Purpose                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `utils/icons.ts`       | `ACTION_ICONS` — the single source for the +/−/✓/✗ action icons used across every toolbar and modal    |
| `utils/csvExport.ts`   | `rowsToCsv` / `downloadCsv` — quotes cells containing `"`, `,`, or newlines and triggers a blob download |
| `utils/bidCsv.ts`      | `parseCsv` (quote-aware) and `validateBidRows` for the Team Formation bid upload (§4.3)                 |

### 2.7 Icon Reference

| Action        | Icon          | Heroicon                |
| ------------- | ------------- | ----------------------- |
| Add           | Plus (+)      | `i-heroicons-plus`      |
| Delete        | Minus (−)     | `i-heroicons-minus`     |
| Confirm       | Checkmark (✓) | `i-heroicons-check`     |
| Cancel/Clear  | X (✗)         | `i-heroicons-x-mark`    |
| Sort unset/asc/desc | ↕ / ↑ / ↓ | `arrows-up-down`, `arrow-up`, `arrow-down` |
| Expand/collapse row | ▸ / ▾     | `chevron-right`, `chevron-down` |
| Undo a staged change | Uturn arrow | `i-heroicons-arrow-uturn-left` |
| Make primary        | Star      | `i-heroicons-star`      |
| Export / Upload     | ↓ tray / ↑ tray | `arrow-down-tray`, `arrow-up-tray` |
| Generate            | Sparkles  | `i-heroicons-sparkles`  |

---

## 3. Database (`pages/database.vue`)

A `UContainer` with a header row — "Database" plus one `SemesterFilter` — over a `UTabs` with three tabs. The page
owns both the semester id and the active tab, through `provideSemesterFilter()` (§2.3.2, §3.4); a tab no longer
holds either itself.

| Tab      | Component          | Semester filter narrows the list to…                                  |
| -------- | ------------------ | ---------------------------------------------------------------------- |
| Projects | `ProjectsTab.vue`  | Projects with at least one team in that semester                        |
| Students | `StudentsTab.vue`  | Students enrolled that semester **or** mentoring a team that semester   |
| Partners | `PartnersTab.vue`  | Partners owning a project with a team that semester                     |

Each tab fetches its own list with a reactive `semesterId` query param — read from `useSemesterFilter()` — and
re-fetches whenever the id moves. No semester selected means no filtering. Because the id only moves after the page
has asked and the user has confirmed (§2.3.2), a tab never refetches out from under an open confirmation dialog.

### 3.1 Projects Tab

#### 3.1.1 Table

| Column       | Field                          | Sort | Filter                                        | Edit                           | Present when            |
| ------------ | ------------------------------- | ---- | ---------------------------------------------- | ------------------------------- | ------------------------ |
| Name         | `name`                          | ✓    | search                                        | text                           | Always                   |
| Type         | `type`                          | -    | multiselect: Software / Hardware / Both       | select (same options)          | Always                   |
| Status       | `status`                        | -    | multiselect: New / Returning / Complete / Withdrawn / Hold | select (same options) | Always            |
| GitHub Link  | `repoURL`                       | -    | search                                        | text                           | Always                   |
| Partner      | `partner.name`                  | ✓    | search                                        | record-search (§2.3.5)         | Always                   |
| Meeting Day  | derived — that semester's team  | ✓    | —                                              | select — Wednesday / Thursday  | A semester is selected   |

Description moved off the table and into the expanded row (§3.1.3), alongside the team detail.

Meeting Day reflects the project's team for the selected semester. When the project has no team that semester the
cell reads `—` and is not editable — a team must first be added from the expanded row (§3.1.3/§3.1.4). When a team
exists, editing this cell stages an update to that team's `meetingDay`.

| Action  | Result                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Add     | Appends a green draft row, pre-expanded. Name/Type/Status/GitHub Link/Partner are typed inline; Description and any initial Teams are set in the expansion. Nothing is sent. |
| Edit    | Editing any cell or expansion field turns the row blue and outlines the changed field yellow. Nothing is sent.                                |
| Delete  | Marks the selected rows red. Nothing is sent.                                                                                                |
| Confirm | If any deletions are staged, first opens the Confirmation Modal listing the total affected **Teams**. Then, in order: `POST /api/projects` per created row (partner id and nested teams in the payload) → `PUT /api/projects/:id` per edited row (with nested team/membership changes) → `DELETE /api/projects/:id` per deleted row → refresh |
| Cancel  | Discards every staged project, edit, and deletion, including expansion changes                                                                |

#### 3.1.2 New Project Row

A staged row is filled in through the same controls used for editing an existing project.

| Field       | Where          | Input                                   | Notes                                                       |
| ----------- | -------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Name        | Inline cell    | `UInput`                                | Required — Confirm blocked while blank                        |
| Type        | Inline cell    | `USelectMenu`                           | Defaults to Software                                           |
| Status      | Inline cell    | `USelectMenu`                           | Defaults to New                                                |
| GitHub Link | Inline cell    | `UInput`                                |                                                                 |
| Partner     | Inline cell    | `RecordSearchInput` over all partners   | Required; fetched under key `partners-all`                     |
| Description | Expansion      | `UTextarea`, edited directly in place    |                                                                 |
| Teams       | Expansion      | Team Creation Modal (§3.1.4)             | Optional; each staged team is listed green                     |

#### 3.1.3 Expanded Row — Description and Teams

The expanded row is a Description field (`UTextarea`, edited directly in place — there is no separate edit mode)
over a **Teams** heading with an "Add Team" button, over the project's team cards.

| Semester filter | Teams shown                                                | Card behavior                                                              |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Unset            | Every team, sorted most-recent-semester first                | Multi-open `UAccordion`, collapsible; label reads `Fall 2025 — Wednesday`      |
| Set               | Only that semester's team, if one exists                     | A single, **non-collapsible** card — no accordion chrome                       |

Every action here stages a change on the parent project row — no request is made until the table's Confirm.

| Element               | Action                                                                                                    | Staged appearance                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Add Team               | Opens the Team Creation Modal and appends the result                                                     | New team card tinted green                |
| Delete Team            | Marks that team for deletion; the card stays in place and its members are locked                          | Team card tinted red                      |
| Mentors list           | One bordered row per membership with `isMentor = true`; "Add Mentor" + button                             | —                                          |
| Students list          | One bordered row per membership with `isMentor = false`; "Add Student" + button                           | —                                          |
| Add Mentor / Student   | Opens the Member Creation Modal and appends the picked student to that list                                | Member row tinted green                   |
| Move (per member)      | Opens the Move Student Modal; on confirm, stages that membership as deleted from this team and stages a new membership on the chosen destination team | Member row tinted red here; a new green row appears on the destination team's card |
| Remove (per member)    | Marks that membership for deletion; the row stays in view                                                  | Member row tinted red                     |
| Undo (on a staged row) | Available on any green, blue, or red item — drops a staged addition, reverts an edit, or unmarks a deletion | Returns to normal                          |

Any staged team or membership change — including a Move, which touches two team cards at once — turns the parent
project row blue. Nothing is written until the table's Confirm.

#### 3.1.4 Team Creation Modal

| Field       | Input                                                  |
| ----------- | -------------------------------------------------------- |
| Semester    | `USelectMenu` over all semesters                        |
| Meeting Day | `URadioGroup` horizontal — Wednesday / Thursday           |

Zod-validated. Confirm **stages** `{ semesterId, meetingDay }` on the project (as a nested create) and closes;
it issues no request. Cancel discards the modal's input only.

#### 3.1.5 Member Creation Modal

Titled "Add Mentor" or "Add Student" depending on which button opened it. Body is a single `RecordSearchInput`
that searches the all-students list by netID or full name, excludes students already on that team (staged
additions included), and caps at 10 results. Confirm is disabled until a student is picked; it **stages**
`{ studentId, isMentor }` on that team and issues no request.

#### 3.1.6 Move Student Modal

Opened from a member row's Move button. Body is a single `USelectMenu` listing the project's **other** teams
(excluding the member's current team), labeled `Fall 2025 — Wednesday`, sourced from the same team list as §3.1.3
including any staged-new teams. Confirm is disabled until a destination is picked.

Confirm stages both halves of the move at once and issues no request:

| Staged change                | Where it appears                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| Membership marked for deletion | The member's row on the **source** team's card, tinted red                                |
| New membership staged          | A new row on the **destination** team's card, tinted green, carrying the same `isMentor` value |

Cancelling the Move Student Modal discards the move only; the member's row on the source card is unaffected.

### 3.2 Students Tab

#### 3.2.1 Table

| Column       | Field                    | Sort | Filter                                 | Edit                            | Present when              |
| ------------ | -------------------------- | ---- | ----------------------------------------- | ---------------------------------- | --------------------------- |
| NetID        | `netID`                    | ✓    | search                                    | text                               | Always                       |
| First Name   | `firstName`                | ✓    | search                                    | text                               | Always                       |
| Last Name    | `lastName`                 | ✓    | search                                    | text                               | Always                       |
| Email        | `email`                    | ✓    | search                                    | text                               | Always                       |
| Discord      | `discord`                  | ✓    | search                                    | text                               | Always                       |
| Is Mentor?   | `isMentor`                 | ✓    | multiselect: Mentor / Student              | switch                             | Always                       |
| Meeting Day  | `enrollment.meetingDay`    | ✓    | —                                        | select — Wednesday / Thursday      | A semester is selected       |
| Gender       | `enrollment.gender`        | ✓    | —                                        | select — Male / Female / Other     | A semester is selected       |
| Major        | `enrollment.major`         | ✓    | —                                        | text                               | A semester is selected       |
| Year         | `enrollment.year`          | ✓    | —                                        | select — Freshman…Senior          | A semester is selected       |
| Class        | `enrollment.class`         | ✓    | —                                        | select — EPCS_2200 / EPCS_3200     | A semester is selected       |

All five semester-specific columns read from the student's **Enrollment** record for the selected semester — not
from any Membership. A student who only mentors that semester (no enrollment) shows `—` in all five and they are
not editable there; an enrollment must exist first, created via Add Semester Info in the expansion (§3.2.5).
Editing one of these cells stages the same change as editing the matching field on that semester's card in the
expansion (§3.2.3) — the two surfaces share one staged edit.

| Action  | Result                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add     | Appends a green draft row, pre-expanded; semester info is added in its expansion. Nothing is sent.                                                      |
| Edit    | Row turns blue, changed field outlined yellow. Nothing is sent.                                                                                        |
| Delete  | Marks the selected rows red. Nothing is sent.                                                                                                          |
| Confirm | If deletions are staged, first opens the Confirmation Modal listing affected **Enrollments**, **Choices**, and **Memberships**. Then `POST /api/students` per created row (with nested enrollments/memberships/choices) → `PUT /api/students/:id` per edited row → `DELETE /api/students/:id` per deleted row → refresh |
| Cancel  | Discards every staged student, edit, and deletion                                                                                                      |

#### 3.2.2 New Student Row

| Field      | Where       | Input         | Notes                                       |
| ---------- | ----------- | ------------- | ------------------------------------------- |
| NetID      | Inline cell | `UInput`      | Required — Confirm blocked while blank      |
| First Name | Inline cell | `UInput`      | Required                                    |
| Last Name  | Inline cell | `UInput`      | Required                                    |
| Email      | Inline cell | `UInput`      | Sent as `undefined` when blank              |
| Discord    | Inline cell | `UInput`      | Sent as `undefined` when blank              |
| Is Mentor? | Inline cell | `USwitch`     | Defaults off; drives the Role field in §3.2.5 |
| Semester Info | Expansion | Semester Info Creation Modal (§3.2.5) | Optional; each staged entry is listed green |

#### 3.2.3 Expanded Row — Semester Info

A **Semester Info** heading with an "Add Semester Info" button over a multi-open `UAccordion` of per-semester
cards, filtered to the selected semester when one is set and sorted most-recent first.

Cards are derived from the student's records: every enrollment produces a `Student` card, and every mentor
membership produces a `Mentor` card, so a student who mentors and enrolls in the same semester gets two. Labels
read `Fall 2025 — Student` / `Fall 2025 — Mentor`.

Every action in a card stages a change on the parent student row; nothing is sent until the table's Confirm. No
field in a card is gated behind an Edit button — every editable field is directly editable in place.

| Card body element      | Present on   | Behavior                                                                                          | Staged appearance                    |
| ----------------------- | ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Add Semester Info (+)   | Header       | Opens the Semester Info Creation Modal; the result is appended as a new card                          | Card tinted green                       |
| Delete Semester Info    | Both roles   | Marks the underlying enrollment or mentor membership for deletion; the card stays                     | Card tinted red, contents locked        |
| Enrollment fields       | Student only | Meeting Day / Gender / Major / Year / Class, each editable in place                                    | Changed field outlined yellow — the same staged edit as the matching column in §3.2.1 |
| Team                    | Both roles   | `RecordSearchInput` over teams with a team that card's semester (searches by project or partner name), editable directly — no separate edit control. Picking a team when previously unassigned stages a new Membership; picking a different team stages an update to the existing one; clearing it stages that Membership's deletion. | Field outlined yellow when changed; an unassigned-to-assigned change is still just an edit on this card, not a separate staged row |
| Team Preferences        | Student only | Ranked list `#1 Project Name`, ordered by rank                                                         | —                                        |
| Add Preference (+)      | Student only | Opens the Team Preference Modal; appends the pick to the list                                          | Preference row tinted green              |
| Move Up / Move Down     | Student only | Reorders the list locally and stages the resulting ranks                                               | Reordered rows outlined yellow           |
| Remove (−)              | Student only | Marks that choice for deletion; the row stays in view                                                  | Preference row tinted red                |

#### 3.2.4 Team Preference Modal

Titled "Add Team Preference". A single `RecordSearchInput` over projects that have a team in that card's semester,
excluding projects the student already chose (staged picks included), searching by project **or** partner name,
capped at 10. The new choice is appended at `max(existing ranks) + 1`. Confirm is disabled until a project is
picked, and **stages** the choice rather than sending it.

#### 3.2.5 Semester Info Creation Modal

| Field       | Input                                     | Shown when                                |
| ----------- | -------------------------------------------- | -------------------------------------------- |
| Semester    | `USelectMenu`                                | Always                                        |
| Meeting Day | `USelectMenu` — Wednesday / Thursday          | Always                                        |
| Role        | `URadioGroup` — Student / Mentor              | Only if the student's mentor flag is set       |
| Major       | `UInput`                                     | Role = Student                                |
| Year        | `USelectMenu` — Freshman…Senior               | Role = Student                                |
| Class       | `USelectMenu` — EPCS_2200 / EPCS_3200         | Role = Student                                |
| Gender      | `USelectMenu` — Male / Female / Other         | Role = Student                                |
| Team        | `RecordSearchInput` over projects with a team that semester | Optional for either role — leave blank to create the card unassigned and set it later from the card (§3.2.3) |

Confirm **stages** the entry as a new card and issues no request. What the table's Confirm later sends depends on
the role:

| Role staged | Request issued on Confirm                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Student     | `POST /api/enrollments` with student, semester, meeting day, major, year, class, gender; plus `POST /api/memberships` if a team was picked  |
| Mentor      | `POST /api/memberships` with `isMentor: true`, resolved to the picked project's team for that semester; nothing is sent if left unassigned  |

For a **new** student row, these are sent as nested creates inside the row's `POST /api/students`.
### 3.3 Partners Tab

#### 3.3.1 Table

Rows are partners flattened with their **primary contact** (the contact flagged primary, else the first one), so
the contact columns are editable proxies onto a different record.

| Column  | Field (row)     | Sort | Filter | Edit |
| ------- | --------------- | ---- | ------ | ---- |
| Name    | `name`          | ✓    | search | text |
| Contact | `primaryName`   | ✓    | search | text |
| Email   | `primaryEmail`  | ✓    | search | text |
| Phone   | `primaryPhone`  | ✓    | search | text |

| Action  | Result                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add     | Appends a green draft row (Name inline, contacts in the expansion). Nothing is sent.                                                                              |
| Edit    | Row turns blue, changed field outlined yellow — including the three contact-proxy columns. Nothing is sent.                                                       |
| Delete  | Marks the selected rows red. Nothing is sent.                                                                                                                    |
| Confirm | If deletions are staged, first opens the Confirmation Modal listing affected **Contacts** and **Projects**. Then each row's changes are split: partner fields → `POST`/`PUT /api/partners/:id`; contact fields → `PUT /api/contacts/:id` for the primary contact, or `POST /api/contacts` when the partner has none (nested into the partner create for a new row); then `DELETE /api/partners/:id` per deleted row → refresh |
| Cancel  | Discards every staged partner, edit, and deletion, including contact changes                                                                                     |

Editing a contact-proxy column and editing that same contact's card in the expansion are the same staged change —
whichever is touched last wins, and both surfaces show the yellow outline.

#### 3.3.2 Expanded Row — Contacts and Projects

**Contacts** — a heading with "Add Contact" over a list of bordered cards. Fields are edited in place; every
action stages a change on the parent partner row and issues no request.

| Card state        | Contents                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Display           | Name, Email, Phone as ghost inputs (`—` placeholder when blank), a "Primary" `UBadge` when applicable, plus the action buttons |
| Edited            | Same, with each changed field outlined yellow                                                                          |
| Staged addition   | Whole card tinted green                                                                                                |
| Marked for deletion | Whole card tinted red, inputs disabled                                                                               |

| Button       | Visible when                    | Result                                                                    |
| ------------ | ------------------------------- | --------------------------------------------------------------------------- |
| Add Contact  | Header                          | Opens the Contact Creation Modal; the result is appended as a green card     |
| Make Primary | Contact is not primary          | Stages `isPrimary: true` on that contact (and clears it on the previous primary) |
| Delete       | Card is clean or edited         | Marks the contact for deletion; the card stays in view                      |
| Undo         | Card is staged green, blue, or red | Drops a staged addition, reverts an edit, or unmarks a deletion          |

**Projects** — a plain read-only list of the partner's project names, narrowed to projects with a team in the
selected semester when a filter is set. Projects are created from the Projects tab, not here.

#### 3.3.3 Contact Creation Modal

| Field | Input    | Notes                                    |
| ----- | -------- | ---------------------------------------- |
| Name  | `UInput` | Required                                 |
| Phone | `UInput` | Sent as `undefined` when blank            |
| Email | `UInput` |                                          |

Confirm **stages** the contact under the parent partner and closes; the `POST /api/contacts` (or the nested create
on a new partner) happens on the table's Confirm.

### 3.4 Implementation notes and known limits (Database)

The staged-changes model is **built** — `docs/design/staging.md` is the composable-level reference (the
store's full API, the semester/tab discard gate, the shared Confirm envelope). `RecordPanel.vue` is
deleted.

Staged changes survive neither a tab switch nor a semester change without an explicit Discard: both are gated
through `useSemesterFilter()` (§2.3.2, §3), so the user is asked before either happens, and a decline leaves the
staged work and the current tab/semester untouched. What remains:

| Limit                       | Behavior today                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Item Panel                  | Not planned. Record detail lives in expandable rows, and clicking a record name does nothing.                     |
| Proxy columns on a new row  | `editable.child` resolves against the fetched record, so a column cannot proxy a **staged-new** child. On a brand-new project row Meeting Day stays read-only; set the day in the Team Creation Modal instead. |
| Accordion tinting           | `UAccordion` exposes no per-item hook for its trigger, so in the semester-unset view a staged-green or -red team tints its body but not its header. |
| Staged primary contact      | The Partners contact-proxy columns target the **fetched** primary, so after a staged Make Primary those columns keep editing the previous primary until Confirm. |
| Team change is delete+create| There is no `PUT /api/memberships/:id`, so re-pointing a student at another team stages a delete plus a create. The Students tab re-collapses that pair into one card; the Projects tab's Move does the same across two cards. |
| Primary not promoted        | `contactService.deleteContact` does not promote a replacement primary, so deleting a partner's primary contact leaves the partner with none (the table then falls back to the first contact for display). |
| Clearing a record search    | `RecordSearchInput` has no `clearable`, so a card that needs an unset action renders its own ✗ button beside it.  |

Choice reordering deliberately stages a new rank on **only** the moved choice: `choiceService.updateChoice`
already shifts siblings, so rewriting every rank would fight it.

The proxy-column, staged-primary-contact, and delete+create rows above are mechanism-level consequences
of how `useStagedChanges`'s `children`/`fields` resolve targets, not independent quirks — see
`docs/design/staging.md` §7 for why each one falls out of the store's design.

#### 3.4.1 Shared composables and utils

Code that used to be duplicated across the three tabs now lives in one place:

| Module                                    | Purpose                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `composables/useSemesterFilter.ts`         | `provideSemesterFilter()` / `useSemesterFilter()` — the gated semester id and active tab (§2.3.2, §3)  |
| `composables/useStagedSave.ts`             | `useStagedSave()` — the Confirm envelope shared by all three tabs: delete confirmation, `saving`, create→update→delete ordering, `staging.reset()`, refresh, one error toast |
| `composables/useRecordModals.ts`           | `useRecordModals()` — awaited `useOverlay()` openers for the six minor-record modals, normalizing an ESC/outside-click dismissal to `null` |
| `composables/useRowStaging.ts`             | `provideRowStaging()` / `useRowStaging()` — ambient `{staging, saving}` for components rendered inside a row's expansion |
| `composables/useSemesterCards.ts`          | The Students tab's per-semester card derivation (§3.2.3): `cardsFor`, `membershipSlot`, `setTeam`, `choiceEntries`, `moveChoice`, `deleteCard`, `undoCard`, plus the `StudentRow`/`SemesterCard`/`ChoiceEntry` types |
| `composables/useDirectory.ts`              | `useAllPartners()` / `useAllProjects()` / `useAllStudents()` — keyed fetches any component can call without issuing a new request |
| `composables/useSemesters.ts`              | Gained `useSemesterLookup()` — `semesterLabel(id)`, `semesterSortKey(id)`, `semesterOptions`, `teamLabel(team)` |
| `composables/useStagedChanges.ts`          | Gained `STAGE_TINTS` (the green/blue/red tint classes) and `groupChildren(children)`                  |
| `utils/labels.ts`                          | Display formatting: `titleCase`, `plural`, `formatSemester`, `semesterOrder`, `studentLabel`, `projectLabel` |
| `utils/options.ts`                         | Every enum option list (`MEETING_DAY_OPTIONS`, `GENDER_OPTIONS`, …), `ENROLLMENT_FIELDS`, `dayLabel`  |
| `utils/columns.ts`                         | `textColumn()` / `enumColumn()` — builders for the two `DataTableColumn` shapes that repeat across tabs |
| `utils/search.ts`                          | Client-side typeahead filters (`searchPartners`, `searchStudents`, `searchProjects`) for `RecordSearchInput` |
| `utils/errors.ts`                          | `errorMessage()` — the message buried in a `$fetch` rejection                                          |
| `utils/recordDrafts.ts`                    | The draft types each minor-record modal resolves with (`ContactDraft`, `TeamDraft`, `SemesterInfoDraft`) |

New components backing the modals and row expansions: `ModalFooter.vue`, `ContactFormModal.vue`,
`TeamFormModal.vue`, `MemberPickerModal.vue`, `MoveMemberModal.vue`, `ProjectPickerModal.vue`,
`SemesterInfoModal.vue`, `PartnerContactList.vue`, `ProjectTeamCard.vue`, `ProjectRowExpansion.vue`,
`StudentSemesterCard.vue`. The Projects tab in particular used to render its ~90-line team-card body twice — once
for the semester-set view, once inside the semester-unset `UAccordion` — and now renders both through the single
`ProjectTeamCard`, with only the wrapper differing.

---

## 4. Team Formation (`pages/team-formation.vue`)

A three-step page: **Semester → Bid Files → Manage Teams**. One step is on screen at a time.

**Rails.** A rail down the left shows the three steps (with the ≡ button that opens the ESA menu and the light/dark
switch); a rail down the right holds **Next** at the top and **Back** at the bottom. You can always click back to a
step you have reached. Next stays disabled, with the reason under it, until the data that step exists for is there:

| Step         | Next is blocked until…                    |
| ------------ | ----------------------------------------- |
| 1. Semester  | a semester is picked                      |
| 2. Bid Files | at least one meeting day has bids saved   |

Data saved on an earlier visit counts, so a returning user can step straight through. Picking a semester opens Bid
Files first, on purpose, so staff check the files before working on teams; when bids are already in, Manage Teams is
unlocked too.

**Your place is kept in the URL**, so a refresh or a shared link opens the same view:
`?semester=<id>&step=semester|bids|teams&day=wednesday|thursday&bench=<teamId>,<teamId>`. `bench` (the Workbench,
§4.4.4) is only written on Manage Teams. A link to a semester that no longer exists falls back to step 1. Board moves
themselves are saved to the database as they happen, not to the URL.

**Phones.** Below 640px wide the left rail becomes a slim bar across the top (≡ and the three steps) and the right
rail a bar along the bottom (Back on the left, Next on the right). Both stay on screen while scrolling. Team cards
go one per row and the Manage Teams toolbar wraps. Dragging doesn't work on most phones (the browser's drag and
drop has no touch support), so moves there are done by tapping two students and confirming the swap (§4.4.4).

**Words.** A **team** is still being worked on. A **project** is a team whose every student is locked; the page uses
that word wherever a fully locked team is shown.

**Colour.** Red means locked and green means unlocked, everywhere on the page. Rank badges use blue for a 1st/2nd
choice, amber for 3rd, and grey for anything lower or unranked. Amber numbers and ⚠ mark a team that breaks a rule
(§4.4.3).

**Labels.** Controls get a short label with an ⓘ (`components/InfoTip.vue`) beside it for the explanation. The tip
opens on hover, and on a click or tap (tap again, or anywhere else, to close it), so it works on phones too. The tip
text is also the button's label for screen readers.

### 4.1 Step 1 — Semester

A `UTable` of every semester, newest first, with one column per meeting day and a **Select** button per row. Each
day cell says where that day stands, read off its teams:

| Day cell                        | Meaning                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| No bids yet                     | No teams exist for that day (bid import creates them)      |
| Bids in, teams not built        | Teams exist but nobody is on one yet                       |
| `3 projects · 9 teams · 70 students` | Counts of fully locked projects, teams still being worked on, and students |

Click a row (or its **Select**) to work on that semester; the current one is in green. A day whose teams are all
projects shows a red lock. **Add semester** under the table opens the same create modal as the Database tab. The
table refreshes whenever you come back to step 1.

### 4.2 Team Export

**Export** on the Manage Teams "Working on" bar (§4.4) downloads `Wed Teams - Fall-2025.csv` (or `Thu …`) built
entirely client-side from the already-fetched data. It works at any point, so a draft can be shared on purpose, but
until the day's board is a final version (§4.4.5) it first asks "Version N isn't final" and names the file
`Wed Teams - Fall-2025 (draft).csv`. One row per membership on that semester's team for that day:

| Column                                                   | Source                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| Team                                                     | `F25 - Partner Name: Project Name`                             |
| Student                                                  | `Last, First`                                                  |
| Choice 1 … Choice 6                                      | The student's ranked choices for that semester, blank-padded to 6 |
| Student Major / Student Classification / Gender / Skills / Comments | The student's enrollment for that semester (skills joined with `; `) |
| Locked                                                   | `Yes` / `No`: whether that student is locked on the team       |

### 4.3 Step 2 — Bid Files

One row per meeting day (`components/BidDayUpload.vue`), so both days' files can be imported without switching
anything. A day still waiting for its file sorts to the top; otherwise Wednesday comes first.

| Row state          | Shown                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Bids already saved | `76 student(s) · file.csv · uploaded 10/21/2026`, a ⟳ **Replace bid file** button, and a chevron that opens the saved file in a read-only CSV viewer |
| Nothing saved yet  | A drop box ("Drop the {Day} bid file here or click to browse") and **Upload {Day} CSV**      |
| Replacing          | A warning explaining what a re-upload changes, a **Cancel** link, then the drop box          |

A re-upload is a partial update: students in the new file get their details updated and their choices replaced;
students not in the file are kept as they are; existing teams don't change until you generate again.

Selecting a file parses and validates it in the browser (`utils/bidCsv.ts`) **before** anything is sent. Validation
checks that each required column group is present under one of its accepted header spellings — Student Name, SSO
ID, Classification, Enrollment, School and Major, Gender — and then that every row has a Student Name. (The
per-row checks for netID uniqueness, classification, enrollment code, major, and gender are written but currently
commented out.)

| Validation state | Condition                                | Feedback                                                                    |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Missing columns  | A required column group has no match      | Error `UAlert` "Missing required columns" listing them; upload blocked        |
| Row errors       | ≥1 row failed                             | Error `UAlert` with the count, plus a scrollable (`max-h-64`) list of `Row N: message`; upload blocked |
| Valid            | No missing columns and no row errors      | Success `UAlert` "N row(s) validated successfully"; upload enabled           |

Uploading `POST`s the parsed rows to `/api/team-formation/bids` with the semester and that card's meeting day, then
refreshes the page's data. The file input is cleared afterwards so the same roster can't be re-sent by accident.
The result stays visible under the card:

| Result state       | Feedback                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Uploading          | Upload button shows its loading spinner and is disabled                                                       |
| Failed             | Error `UAlert` "Upload failed" with the server message                                                        |
| Imported           | Success `UAlert` — "N student(s) imported, M choice(s) recorded."                                             |
| Skipped rows       | Warning `UAlert` naming rows dropped because they have neither an SSO ID nor a name                           |
| No-bid placements  | Info `UAlert` plus a list of `Student (Major) → Project` for every student placed by major (§4.3.1)           |
| No-bid unplaced    | Warning `UAlert` naming no-bid students imported without a project because that day has no teams yet          |

#### 4.3.1 Students With No Bid

Some students never submitted a bid, so they are missing from the bid file. They still need a team. The importer
(`server/api/team-formation/bids.post.ts`, helpers in `server/utils/noBid.ts`) places each of them on a project
that fits their major, and the solver then treats them like any other bidder. This is a fixed rule, not a guess
from their preferences (they have none) and not AI.

**What counts as "no bid":** any bid-file row that ends up with zero usable project choices — a row you add by hand
with only a name and a major, or an existing row whose Choice 1–6 cells are all blank.

**How to add no-bid students (steps):**

1. Open the bid CSV for the lab day (Wednesday or Thursday) in a spreadsheet app or text editor.
2. Add one new row per no-bid student **below the last existing row**, keeping the file's header row and column
   order unchanged (the upload validator needs the SSO ID, Classification, Enrollment, School and Major, and Gender
   *columns* to exist, but their cells may stay empty).
3. Fill in only these cells and leave everything else blank:
   - **Student Name** — either `First` in the first column and `Last` in the unnamed second column (the layout the
     existing rows use), or `Last, First` in the Student Name cell.
   - **School and Major** — a major such as `Computer Science`, or the long form
     `Erik Jonsson School of Engineering and Computer Science :::: Computer Science`.
4. Save the file as CSV.
5. Go to **Team Formation** and click **Select** on the semester (step 1); it opens **Bid Files** (step 2). On the
   row for the **same day as the file**, click **Replace bid file** if bids are already saved, choose the file, and click
   **Upload**. Rows with no SSO ID are not skipped. If the row's email matches a stored student, it updates that
   student; otherwise it gets a stand-in netID of the form `nobid-first-last-<hash>` (hash of the email, or of the
   name when there is no email) so re-uploading updates the same student instead of duplicating them. A second row
   with the same name and no SSO ID or email is skipped and listed, rather than overwriting the first. A blank row
   for a student who also has a row with bids in the same file is ignored.
6. Read the **"N student(s) had no bid and were placed by major"** list under the card. It shows each student's
   major and the project they were placed on.
7. Go to **Manage Teams** (step 3) and set **Working on** to that day. Teams build on their own the first time a
   day with bids is opened; otherwise use ⚙ → **Regenerate**. After a build, a button
   **"No-bid students: where they ended up"** opens a list of each student's final project and a badge: *kept
   placement* if the solver left them where the importer put them, or *moved from …* if team sizes or a locked team
   forced a change. The button turns yellow when anyone was moved.
8. On the board, no-bid students carry a **no bid** tag and show as *not ranked*. The project they were placed on is
   not a preference, so the board never shows it as a 1st choice and **Improve** never suggests moves for them;
   place them by hand if the major-based pick isn't right.

**How the project is chosen** (`pickProjectForMajor`): only teams that already exist for the selected semester and
meeting day are candidates. A project whose type matches the major wins — Software projects for CS/SE/DS, Hardware
projects for EE/ME/BME/CE; next come "Both" projects; any other project is the last resort (this is also what
happens for `Systems` and `Other` majors). Ties go to the project with the fewest students already headed there, so
no-bid students spread across teams rather than piling onto one. The chosen project is saved as the student's
Choice 1, and the enrollment's `noBid` flag is set so the student can be recognised later (the Team Export prefixes
their Comments cell with `[No bid]`). Re-uploading the student with real bids clears the flag.

**Defaults for blank cells:** Classification → Freshman, Enrollment → EPCS 2200, Gender → Prefer not to say, Email →
none. Fill these in before uploading if you know them, since the solver's 3200 and gender rules use them.

### 4.4 Step 3 — Manage Teams

Everything about building and fixing one day's teams. Works on one meeting day at a time. Every move, lock and
regenerate saves straight to the database; there is no separate Save.

From top to bottom:

1. **Title and toolbar**: "3. Manage Teams" ⓘ, then Search, 3200, Not top 3, Version and ⚙ (§4.4.1).
2. **"Their preferences" bar**, only while one student is clicked (§4.4.4). It sticks to the top while you scroll.
3. **Working on bar**: the semester, a Wednesday/Thursday switch with each day's bid count, `16 teams · 76 bids`,
   and **Export** (§4.2). The page starts on a day that has bids.
4. **Messages**: build progress, errors, "Teams built", and the no-bid results (§4.3.1). This area takes no room
   when there's nothing to say.
5. **Workbench** (§4.4.4). When it's empty it is one line: "Workbench (0) ⓘ Click or drag a team here."
6. **All teams** grid (§4.4.3).

**Fits on one screen.** The step uses the full width between the rails, and the grid packs as many cards per row as
fit (each at least 12rem wide; 6 per row on a 1512px-wide laptop). On a 1512 × 827 window a 16-team day fits with
no scrolling while the Workbench is empty. Bringing teams up makes the page taller; that's expected. (A
side-by-side Workbench and grid was tried and dropped in favour of this stacked layout.)

**Teams build on their own.** The first time a day with bids but nobody on a team is opened, teams are built with
the default settings ("Building teams…"). After that, rebuilding is always a choice: ⚙ → **Regenerate**.

#### 4.4.1 Toolbar

| Control              | What it does                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Search** (⌘K)      | Fuzzy finder for any team or student on this day. A team goes up to the Workbench; a student also gets clicked, so their preferences bar and Spotlight show. A locked team can't go on the Workbench, so its card is scrolled to and flashed instead |
| **3200**             | 3200 view: grid cards list only their 3200 students plus "+N others", for checking 3200 coverage at a glance. The Workbench keeps full rosters |
| **Not top 3 · N**    | N is how many students on this day aren't on one of their top three picks (4th or lower, not ranked, or no bid). On: grid cards list only those students plus "+N in their top 3"; cards where everyone got a top-3 pick fade back and say so. Only one of 3200 / Not top 3 is on at a time |
| **Version N**        | Opens the Versions list (§4.4.5). Reads "Version N · Final" in green when the board is a final version |
| ⚙                    | Team settings (§4.4.2)                                                                              |

#### 4.4.2 Team settings (⚙)

A modal with two tabs and **Regenerate** at the bottom.

**Rules**

| Setting                    | Input                            | Default |
| -------------------------- | -------------------------------- | ------- |
| Team size                  | two `UInputNumber`s, min to max  | 4 to 6  |
| 3200s per team             | two `UInputNumber`s, min to max  | 1 to 4  |
| 3200s choose first         | `USwitch`                        | on      |
| Light extras: Returning students go back | `USwitch`          | on      |
| Light extras: No one alone by gender     | `USwitch`          | on      |

Settings live on the page only and reset on refresh. They also drive the warnings on the board (§4.4.3).

**Lock 3200s (N)**: "N students · M locked", then **Suggest** (pre-fills a 1st or 2nd choice for each unlocked
3200, for you to check), **Lock suggested**, **Lock all** and **Unlock all**, and a row per 3200 student with a team
picker and Lock, or a red "Locked: Project" with Unlock.

**Regenerate** `POST`s `{ semesterId, day, config }` to `/api/team-formation/generate`. Before re-solving, the board
is saved as a version called "Before regenerating", so a regenerate can be undone (§4.4.5). Everyone who isn't
locked is re-solved; locked students stay where they are (a locked team with spare seats can still receive new
students). Ties between equally good placements go to
students with 3200 experience, then to students with more semesters.

| State     | Appearance                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------ |
| Blocked   | "No {Day} teams for this semester. Add them in the Database tab first."                          |
| Failed    | Error `UAlert` "Team generation failed" with the server message (e.g. Python/ortools missing, or a team size that can't be met) |
| Succeeded | Success `UAlert` "Teams built", plus the no-bid results button when there are any (§4.3.1)        |

#### 4.4.3 All teams

A grid of every team for the day that isn't on the Workbench. Each card shows:

- the project name on one line (hover for the full name) and the padlock at the top right;
- `5/6 · 1 × 3200`, with **Improve** on the right, or a green **Project** badge when the whole team is locked;
- every student with their rank for this team, plus **3200** and **no bid** tags, and a small red lock beside a
  locked student when the team as a whole isn't locked.

Click a card (or drag it) to bring it up to the Workbench. Locked cards sort last and can't be dragged.

**Warnings.** A team that is too small, too big, or short on 3200s (against the ⚙ Rules) gets the offending number
in amber and a ⚠; hovering the ⚠ lists the reasons ("Too small: 4 of at least 5", "No 3200 student", …). The heading
adds "⚠ N teams need a look". A team with nobody on it is a project nobody is on and isn't flagged.

#### 4.4.4 Workbench

Teams brought up to work on at full size, side by side (each card at least 18rem wide). × puts one back; **Put all
back** clears it. Which teams are up is kept in the URL (`bench=`), so a refresh brings them back.

| Feature            | What it does                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Drag students      | Drag a student between Workbench teams. While dragging, each team shows that student's rank for it |
| here · there       | With two teams up, each student shows their rank here and on the other team. On phones the badges drop below the name |
| Compare / swap     | Click a student to see their major and full ranking. Click a student on another Workbench team to preview a swap: both students' rank before → after, plus warnings (team size, 3200 limits). Warnings never block; **Confirm swap** is staff's call |
| Spotlight          | With one student clicked, the teams they ranked move to the front of All teams in rank order with a "1st choice"-style badge, and the rest fade back |
| Their preferences  | A bar at the top lists the clicked student's ranked choices; click one to bring that team up. × clears it |
| Student padlock    | Locks or unlocks one student, 3200 or not (`POST /api/team-formation/lock`). Unlocking keeps them on the team. Locking the last open student locks the whole team, which then goes back to the grid as a project |
| Team **Lock**      | Locks every student on the team; it goes back to the grid as a project                        |
| Improve            | For each student, the best higher-ranked team they can actually get onto, by a straight move or a swap with someone no worse off. Never moves anyone to a team they ranked lower and never touches locked students. When there's no fix it says why. A fix brings both teams up |

The Workbench card also spells out any ⚠ warning under its counts. A moved student keeps their lock state.

#### 4.4.5 Versions

Each day keeps numbered versions of its board (`TeamVersion`, `server/services/teamVersionService.ts`).

| Action            | What happens                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Save              | Saves the board as the next version with an optional description ("Saved" if left blank)        |
| Automatic         | Regenerate saves "Before regenerating" first, and Go back saves "Before going back to Version N". Either is skipped when nobody is placed or the board is exactly the latest saved version, so versions don't pile up |
| Current           | The version that exactly matches the board gets a **Current** tag and a filled number            |
| ✎                 | Edit a version's description                                                                    |
| **Go back**       | Puts that version on the board                                                                   |
| **Make final**    | Puts that version on the board and locks every team, so they all become projects. If the board isn't that version, it is saved first as "Before making Version N final". Only one final version per day; the version gets a green **Final** badge |
| **Not final**     | Puts back the locks the version was saved with (it does not unlock everyone)                     |
| 🗑                | Deletes a version after a confirm. Deleting the current one leaves the board as it is            |

#### 4.4.6 Phones

See the Phones note at the top of §4. On Manage Teams specifically: the toolbar wraps and hides the ⌘K hint, cards
go one per row, and the ⚠ reason on grid cards needs hover, so on a phone bring the team up to the Workbench to read
it.


---

## 5. User Management (`pages/users.vue`)

Admin-only (§1.3, §2.1). Fetches the full user list from `GET /api/users` (`server/services/userService.ts`) and
splits it client-side into two `UCard` sections by `active` — there is no separate endpoint per group. Each row
shows the avatar (via `getImageLink`, same pattern as the old template list), name, email, and role/verification
badges, with action buttons on the right. There is no staged-changes envelope here (§2.3.1) — every button issues
its `PUT`/`DELETE /api/users/:id` immediately and then `refresh()`s the list; `busyId` disables/loading-spins only
the row currently in flight.

### 5.1 Active Users card

| Column / element | Shown                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Badges             | "Admin" (`role === 'ADMIN'`); "You" (`user.id === session id`)         |
| Promote to Admin   | Shown when `role === 'USER'`. `PUT { role: 'ADMIN' }`, no confirmation |
| Demote to User     | Shown when `role === 'ADMIN'`. Requires confirmation (§2.4) — "`Demote {name}?`" / "will lose admin access". Disabled (with a tooltip) for a self-row when this user is the only admin, so the round-trip to the server's identical check (§5.3) is avoided rather than surfaced as an error. `PUT { role: 'USER' }` |
| Deactivate         | Always shown for an active user. Disabled (with a tooltip) on the signed-in admin's own row. `PUT { active: false }` |

### 5.2 Inactive Users card

| Column / element | Shown                                                          |
| ----------------- | ------------------------------------------------------------------ |
| Badge              | "Verified" / "Pending" (`emailVerified`), same as the old placeholder list |
| Activate           | `PUT { active: true }`                                             |
| Delete             | `DELETE /api/users/:id` — no confirmation modal (not required by spec; the action only ever targets an already-inactive account) |

### 5.3 Business rules (`server/services/userService.ts`)

The table above shows what the UI disables proactively; the service enforces the same rules independent of the
client, returning a plain `Error` that each handler maps to a `400`/`404` `createError` (the pattern every other
service in `server/services/` follows — see `semesterService.deleteSemester` for the reference shape):

| Rule                                                                                     | Enforced in           |
| ------------------------------------------------------------------------------------------ | ----------------------- |
| An admin cannot deactivate their own account                                              | `updateUser`            |
| A role change is rejected unless the target is (or is being made, in the same call) active | `updateUser`            |
| An admin cannot demote themselves unless at least one other `ADMIN` row exists             | `updateUser`            |
| Only an inactive user can be deleted                                                       | `deleteUser`             |

Endpoints: `GET /api/users` (list, admin-only), `PUT /api/users/:id` (partial `{ active?, role? }`, admin-only),
`DELETE /api/users/:id` (admin-only). All three call `requireAdmin` (`server/utils/authz.ts`) first. Activation and
role are also the account-activation flow described in §1.4 — deactivating a user here is what puts their next
request behind `pages/inactive.vue` and the `active-user` Nitro middleware.

Note that `pages/index.vue` still contains the upstream template's user list and profile-picture upload; it is
boilerplate rather than a design element, and `pages/users.vue`'s avatar/badge rendering is the one part of it
that was reused here.
