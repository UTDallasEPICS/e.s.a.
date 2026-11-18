# Staging — Design Reference

This document is the implementation reference for the staged-changes editing model introduced in
`docs/design/ui.md` §2.3.1. That section describes the model's _behavior_ (what a user sees); this
document describes its _machinery_ — the composables that implement it, their full API surface, and
worked examples of how a tab wires rows and nested children through them.

The model spans four composables, each with a distinct job:

| Composable            | Job                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `useStagedChanges()`  | The store itself — one per table, holding every pending row/edit/deletion and its children    |
| `useSemesterFilter()` | Gates semester and tab switches so they can't silently discard a dirty store                  |
| `useStagedSave()`     | The Confirm envelope shared by all three Database tabs — delete confirmation, ordering, reset |
| `useRowStaging()`     | Ambient `{staging, saving}` injection for components rendered inside a row's expansion        |

None of them talk to the network directly. `useStagedChanges` is pure client-side state; the owning
tab reads its `payload()` on Confirm and decides for itself what API calls that payload implies (see
`ProjectsTab.vue`'s `createProject`/`updateProject`/`deleteProject` for the fullest example).

---

## Table of contents

1. [`useStagedChanges()` (`app/composables/useStagedChanges.ts`)](#1-usestagedchanges-appcomposablesusestagedchangests)
   1. [Internal shape](#11-internal-shape)
   2. [`rows` — row lifecycle (DataTable-only)](#12-rows-row-lifecycle-datatable-only)
   3. [`fields` — a row's own fields](#13-fields-a-rows-own-fields)
   4. [`children` — nested minor records](#14-children-nested-minor-records)
   5. [Top-level: `isDirty`, `reset`, `payload`](#15-top-level-isdirty-reset-payload)
   6. [The revert rule](#16-the-revert-rule)
   7. [Other exports](#17-other-exports)
2. [`useSemesterFilter()` (`app/composables/useSemesterFilter.ts`)](#2-usesemesterfilter-appcomposablesusesemesterfilterts)
3. [`useStagedSave()` (`app/composables/useStagedSave.ts`)](#3-usestagedsave-appcomposablesusestagedsavets)
4. [`useRowStaging()` (`app/composables/useRowStaging.ts`)](#4-userowstaging-appcomposablesuserowstagingts)
5. [Worked examples](#5-worked-examples)
   1. [Rows: `DataTable.vue`](#51-rows-datatablevue)
   2. [Children: Projects tab + row expansion](#52-children-projects-tab-row-expansion)
6. [Behavior rules recap (from ui.md §2.3.1)](#6-behavior-rules-recap-from-uimd-231)
7. [Known limitations](#7-known-limitations)
8. [Cross-references](#8-cross-references)

---

## 1. `useStagedChanges()` (`app/composables/useStagedChanges.ts`)

One call to `useStagedChanges()` creates one store, scoped to one `DataTable` instance (one per tab —
Projects, Students, Partners). The returned object groups its API by audience rather than exposing a
flat set of functions:

```ts
const staging = useStagedChanges()
// staging.rows      — DataTable's own row-lifecycle machinery (nothing outside DataTable.vue calls it)
// staging.fields     — a row's own fields; used by DataTable's generic columns and by expansion
//                       components editing fields that aren't rendered as a column
// staging.children   — nested minor records (Team, Contact, Choice, Enrollment, Membership, …); the
//                       group shared across tabs and row-expansion components
// staging.isDirty / staging.reset / staging.payload — top-level, because SemesterGuard (§2) expects
//                       {isDirty, reset} directly on the object passed to guard()
```

### 1.1 Internal shape

Nothing outside the composable touches these types directly, but every method below is defined in
terms of them:

```ts
type StageState = 'new' | 'deleted' | 'edited' | 'clean'

interface ChildStage {
  id: string
  isNew: boolean
  deleted: boolean
  fields: Record<string, any> // edited fields for an existing child; the whole draft if new
  original?: Record<string, any> // the fetched record this child edits; unset if new
}

interface RowStage {
  isNew: boolean
  deleted: boolean
  fields: Record<string, any>
  children: Record<string, Record<string, ChildStage>> // keyed by collection name, then child id
  original?: Record<string, any>
}
```

A store is `reactive<Record<string, RowStage>>({})` keyed by row id. A row (or child) that has never
been touched simply has no entry — `stageFor(id)` lazily creates one (`RowStage`/`ChildStage`) the
first time something stages a change against it, which is why every "read" method (`state`, `get`,
`isEdited`) has to tolerate a missing entry and report the clean/registered value instead.

Staged-new rows and children get a temporary id of the form `new:<kind>:<n>` (`nextId()`), where
`<kind>` is `'row'` for a row or the collection name for a child (e.g. `new:Teams:3`). `isNewId()`
tests for this prefix; it's how the store tells a staged-new record apart from an existing one
without a separate flag threaded through every call site.

### 1.2 `rows` — row lifecycle (DataTable-only)

This group is `DataTable.vue`'s own machinery. Nothing outside that component calls it — a tab or an
expansion component only ever reaches `fields` or `children`.

| Method                 | Signature                                           | Behavior                                                                                                                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add(draft)`           | `(draft: Record<string, any>) => string`            | Stages a new row from a blank draft (the `newRow()` factory a tab passes to `DataTable`). Returns its temp id.                                                                                                                                                               |
| `markDeleted(ids)`     | `(ids: string[]) => void`                           | Marks each existing row deleted; a staged-new row among them is dropped instead (nothing to delete server-side).                                                                                                                                                             |
| `undo(id)`             | `(id: string) => void`                              | Drops a staged-new row, or reverts an existing row's fields/deletion mark **and clears its staged children** — a row can be "edited" purely by nested changes, so undoing it has to clear those too for the row to actually go clean.                                        |
| `state(id)`            | `(id: string) => StageState`                        | `'clean'` with no stage; else `'deleted'`, `'new'`, or `'edited'` (edited only if the row or any of its children actually differs — see `hasRowChanges`).                                                                                                                    |
| `register(id, record)` | `(id: string, record: Record<string, any>) => void` | Caches the fetched record behind an existing row so `fields.get`/`fields.set`/`rows.merge` never need it passed in again. No-op for a staged-new id. DataTable calls this for every row on every render of `data` (a `watch`, not a computed, since registering is a write). |
| `merge<T>(id)`         | `(id: string) => T`                                 | The fetched row with staged edits applied, for display/sort/filter: the draft itself if new, else `{...original, ...fields}`. Throws if the row was never registered.                                                                                                        |
| `drafts()`             | `() => {id, fields}[]`                              | Every staged-new row, in insertion order — what `DataTable` renders pinned to the top of page 1.                                                                                                                                                                             |

### 1.3 `fields` — a row's own fields

Used by `DataTable`'s generic cell rendering, and by expansion components editing a field that isn't
a table column at all (e.g. a Project's `description`, edited directly in the expanded row).

| Method                  | Signature                                         | Behavior                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `get(id, field)`        | `(id: string, field: string) => any`              | The staged value if set, else the registered original (or the draft field, for a new row).                                                                                     |
| `set(id, field, value)` | `(id: string, field: string, value: any) => void` | Stages an edit. **Setting a value back to the registered original clears the edit** — see §1.6.                                                                                |
| `isEdited(id, field)`   | `(id: string, field: string) => boolean`          | True only for an _existing_ row with that field staged (never true for a new row — the whole row is already green, so no field gets its own yellow outline; see ui.md §2.3.5). |

### 1.4 `children` — nested minor records

The group actually shared across tabs and row-expansion components: every Team, Contact, Choice,
Enrollment, and Membership editor goes through this group, keyed by `(rowId, collection, childId)`.
"Collection" is a caller-chosen string naming the bucket — `'Teams'`, `'Memberships'`, `'Contacts'`,
`'Choices'` — not a schema concept; nothing enforces what strings a tab uses, so consistency across a
tab's own components is on the caller (see `ProjectsTab.vue`'s `'Teams'`/`'Memberships'`).

| Method                                          | Signature                                                               | Behavior                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add(rowId, collection, draft)`                 | `(...) => string`                                                       | Stages a new child under a row. Returns its temp id.                                                                                                                                                                                                                                                                                        |
| `markDeleted(rowId, collection, childId)`       | `(...) => void`                                                         | Marks an existing child deleted, or drops a staged-new one.                                                                                                                                                                                                                                                                                 |
| `undo(rowId, collection, childId)`              | `(...) => void`                                                         | Drops a staged-new child, or reverts an existing one's edits/deletion mark.                                                                                                                                                                                                                                                                 |
| `register(rowId, collection, records, key)`     | `(rowId, collection, records: C[], key: (record: C) => string) => void` | Rebuilds the bucket from a fresh fetch, in `records`' order, **reusing each already-known `ChildStage` by id** so staged edits survive a refetch; any still-staged-new child (not yet saved, so absent from `records`) is carried to the end in its prior relative order. No-op for a staged-new row (its children live only in its draft). |
| `get(rowId, collection, childId, field)`        | `(...) => any`                                                          | Staged value, else the registered original.                                                                                                                                                                                                                                                                                                 |
| `set(rowId, collection, childId, field, value)` | `(...) => void`                                                         | Stages an edit. A `childId` with the `new:` prefix that has no stage yet is created as a staged addition — how a Partner with no contact yet gets one from an inline contact-proxy column (ui.md §3.3.1).                                                                                                                                   |
| `isEdited(rowId, collection, childId, field)`   | `(...) => boolean`                                                      | True only for an existing (not staged-new) child with that field staged.                                                                                                                                                                                                                                                                    |
| `merge<C>(rowId, collection)`                   | `(rowId, collection) => MergedChild<C>[]`                               | Fetched children with staged edits applied, **followed by** staged-new ones, in `register`'s cached order. Deleted children stay in the list (tinted red, per ui.md §2.3.1) rather than disappearing.                                                                                                                                       |

`MergedChild<C>`, what `children.merge` returns per entry:

```ts
interface MergedChild<C> {
  id: string
  record: C // the merged fetched+staged record, or the draft itself if new
  state: StageState // 'new' | 'deleted' | 'edited' | 'clean'
  isNew: boolean
  deleted: boolean
}
```

`registerRow`/`registerChildren` must run **before** any render that calls `merge` — `DataTable`
guarantees this for rows via its `immediate: true` watch on `data`; a tab must do the same for its own
children (see `ProjectsTab.vue`'s `watch(projects, ...)` in §4 below). Reading `merge` for a row/child
that was never registered either throws (`rows.merge`) or just returns an empty bucket
(`children.merge` — a genuinely childless row and an unregistered one look the same, which is fine
since `register` always runs first).

### 1.5 Top-level: `isDirty`, `reset`, `payload`

| Member      | Type / signature       | Behavior                                                                                                                                                                                                                                                                                                                  |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isDirty`   | `ComputedRef<boolean>` | True if any row is new/deleted, has an edited field, or has a dirty child anywhere in its `children` map (`hasRowChanges`).                                                                                                                                                                                               |
| `reset()`   | `() => void`           | **Cancel.** Drops every staged-new row; for an existing row, clears its deletion mark, its fields, and every staged child — but the row's (and its children's) **registered `original` stays cached**, since Cancel doesn't refetch and dropping the cache would leave fields reading `undefined` until the next refresh. |
| `payload()` | `() => StagedPayload`  | **Confirm.** Splits every row into `created`/`updated`/`deleted` — see below.                                                                                                                                                                                                                                             |

```ts
interface StagedRecord {
  id: string
  fields: Record<string, any>
  children: Record<string, ChildStage[]> // only collections with at least one dirty child
}

interface StagedPayload {
  created: StagedRecord[] // staged-new rows, each with any minor records drafted in its expansion
  updated: StagedRecord[] // existing rows with edited fields and/or dirty children
  deleted: string[] // ids of existing rows marked for deletion
}
```

A row appears in exactly one bucket: `created` if new, else `deleted` if marked, else `updated` if
`hasRowChanges` is true, else it's omitted entirely. Within `updated`/`created`, each `StagedRecord`'s
`children` only lists collections that actually have a dirty child (`isChildDirty` — new, deleted, or
with edited fields), so a tab's save logic never has to filter out no-op entries itself.

### 1.6 The revert rule

`isReverted(value, original)` treats `null`, `undefined`, and `''` as the same "blank" — a cleared
text input models absence as `''`, a nullable fetched field models it as `null`, and a field reverted
to either should stop reading as edited. Both `fields.set` and `children.set` call this before staging
a value: setting a field back to its original (or to any of the three blank forms when the original is
also blank) deletes the staged entry rather than storing a no-op edit. This is what makes "a row with
no changed fields left stops being blue" (ui.md §2.3.1) work without a tab ever checking for it.

### 1.7 Other exports

| Export                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `STAGE_TINTS`             | `Record<StageState, string>` — the green/blue/red/none Tailwind classes for `'new'`/`'edited'`/`'deleted'`/`'clean'`. Used by `DataTable`'s row `meta.class.tr` and by every expansion component that tints its own cards (`ProjectRowExpansion`, `PartnerContactList`, `StudentSemesterCard`, …) — the single source for the four highlight colors so they stay consistent everywhere (ui.md §2.3.1). |
| `groupChildren(children)` | `(children?: ChildStage[]) => {added, edited, deleted}` — splits a collection's staged children into the three things a save has to do with them. `edited` excludes children whose `fields` ended up empty. Callers still choose their own ordering (e.g. enrollments/memberships must delete before they create) — this just does the splitting, not the ordering.                                    |
| `StagedChanges`           | `ReturnType<typeof useStagedChanges>` — the type every consumer (`DataTable`, `useStagedSave`, `useRowStaging`) imports rather than re-deriving.                                                                                                                                                                                                                                                       |

---

## 2. `useSemesterFilter()` (`app/composables/useSemesterFilter.ts`)

The semester dropdown and the active Database tab are **gated, not restored**: moving either while a
tab has staged changes would refetch that tab's list out from under its own staging store (each tab's
`useFetch` is reactive to `semesterId`), silently orphaning the staged work. The naive fix — let the
value change, then put it back if the user declines — refetches twice and flashes the wrong dataset
behind the confirmation dialog. So the id (and the active tab) only ever moves **after** the user has
been asked and agreed.

```ts
interface SemesterGuard {
  isDirty: Readonly<Ref<boolean>>
  reset: () => void
}
```

`StagedChanges` satisfies `SemesterGuard` as-is (its `isDirty`/`reset` are exactly this shape), which
is why a tab registers its own store directly: `guard(staging)`.

```ts
interface SemesterFilterContext {
  semesterId: Readonly<Ref<string | undefined>>
  request: (next: string | undefined) => Promise<boolean>
  confirmDiscard: (description: string) => Promise<boolean>
  guard: (guard: SemesterGuard) => void
}
```

| Member                        | Behavior                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `semesterId`                  | The **committed** id — only `request` moves it. A tab reads this reactively for its own fetch's query param.                                                                                                                                                                                                                               |
| `guard(entry)`                | Registers a `SemesterGuard` to be asked before a filter/tab move. Deregisters itself automatically via `onScopeDispose` when the owning component unmounts — a tab never has to un-guard by hand.                                                                                                                                          |
| `request(next)`               | Asks (via `confirmDiscard`) only if `next !== semesterId.value`. Resolves `true` and moves `semesterId` if there's nothing dirty or the user confirms; resolves `false` and leaves the id untouched if they decline.                                                                                                                       |
| `confirmDiscard(description)` | Filters the registered guards to the dirty ones; if any exist, opens the shared Confirmation Modal (`useConfirm()`) with title "Discard staged changes?" and the given cascade sentence. Resolves `false` on decline (nothing is touched). On confirm (or if nothing was dirty), calls `reset()` on every dirty guard and resolves `true`. |

`provideSemesterFilter()` is called once, in `database.vue`, and `provide()`s the context under
`SEMESTER_FILTER_KEY`; every tab calls `useSemesterFilter()` to inject it. `database.vue`'s tab
switcher calls `confirmDiscard('Switching tabs will discard everything you have staged.')` before
actually changing the active tab, because `UTabs` unmounts the inactive panel by default — without
this gate that unmount would destroy a tab's staged changes with no prompt at all (ui.md §2.3.2).

```ts
// database.vue (sketch)
const { request, confirmDiscard } = provideSemesterFilter()

async function onSemesterChange(next: string | undefined) {
  await request(next) // no-op if declined; semesterId only moves on confirm
}

async function onTabChange(next: string) {
  if (await confirmDiscard('Switching tabs will discard everything you have staged.')) {
    activeTab.value = next
  }
}
```

```ts
// ProjectsTab.vue (actual)
const { semesterId, guard } = useSemesterFilter()
const staging = useStagedChanges()
guard(staging) // this tab's store is now asked before any semester/tab move
```

---

## 3. `useStagedSave()` (`app/composables/useStagedSave.ts`)

The envelope every tab's Confirm button shares — the delete confirmation, the `saving` flag, the outer
create → update → delete ordering, and one error toast. It deliberately does **not** try to generalize
the requests themselves: what a tab does with one `StagedRecord` is irreducibly different (Projects
remaps team ids it just created for pending memberships; Students deletes an old membership before
creating its replacement when a student is moved to another team) — that domain logic stays in the
tab, passed in as `create`/`update`/`delete`.

```ts
interface StagedSaveOptions {
  staging: StagedChanges
  entity: string // lowercase singular, e.g. "project"
  cascade: string // the cascade sentence shown under the title
  affected?: (ids: string[]) => { label: string; count: number }[]
  refresh: () => Promise<unknown>
  create: (record: StagedRecord) => Promise<void>
  update: (record: StagedRecord) => Promise<void>
  delete: (id: string) => Promise<void>
}

function useStagedSave(options: StagedSaveOptions): {
  saving: Ref<boolean>
  onSave: (payload: StagedPayload) => Promise<void>
}
```

`onSave(payload)` (wired to `DataTable`'s `@save`) does, in order:

1. If `payload.deleted.length`, opens the Confirmation Modal — title `` `Delete ${plural(n, entity)}?` ``,
   the given `cascade` description, and `affected?.(payload.deleted)` as the bulleted cascade counts.
   Returns early (nothing is sent) if the user declines.
2. Sets `saving.value = true`.
3. Runs every `create`, then every `update`, then every `delete` — awaited in sequence, not
   `Promise.all`, so one tab's per-record ordering guarantees (teams before memberships, etc.) hold
   across records too.
4. On success: `staging.reset()`, then `await refresh()`.
5. On any thrown error: a `color: 'error'` toast titled "Save failed" with `errorMessage(error)`
   (`utils/errors.ts` — the message buried in a `$fetch` rejection). Note the store is **not** reset
   on failure — whatever was staged (including whatever step didn't finish) stays staged so the user
   doesn't lose the edit and can retry Confirm.
6. `saving.value = false` in a `finally`.

```ts
// ProjectsTab.vue (actual)
const { saving, onSave } = useStagedSave({
  staging,
  entity: 'project',
  cascade: 'This will also delete all associated teams and choices.',
  affected: (ids) => {
    const selected = projects.value.filter((p) => ids.includes(p.id))
    return [{ label: 'Team', count: selected.reduce((n, p) => n + p.Teams.length, 0) }]
  },
  refresh,
  create: createProject,
  update: updateProject,
  delete: deleteProject,
})
```

`<DataTable @save="onSave" :saving="saving" ... />` wires the toolbar's Confirm spinner and disabled
state (ui.md §2.3.2, "Saving" row) directly to this `saving` ref.

---

## 4. `useRowStaging()` (`app/composables/useRowStaging.ts`)

Every component rendered inside a row's expansion (`ProjectRowExpansion`, `ProjectTeamCard`,
`StudentSemesterCard`, `PartnerContactList`, …) needs the same `{staging, saving}` pair the owning tab
already has. Since `staging` and `saving` are the same object for every node in that subtree, they're
provided/injected rather than threaded through every prop list; `rowId`, the row's record, and which
card is being rendered vary per component instance and stay ordinary props (injection can't express a
per-instance value; a per-row `provide` would be worse than just passing the prop).

```ts
/** Row-expansion components only ever touch a row's own fields or its nested children — never the
 *  row-lifecycle group, which is DataTable.vue's own machinery. Narrowing the injected type keeps
 *  that distinction visible at every injection site. */
type RowFieldStaging = Pick<StagedChanges, 'fields' | 'children'>

interface RowStagingContext {
  staging: RowFieldStaging
  saving: Readonly<Ref<boolean>>
}

function provideRowStaging(context: RowStagingContext): void
function useRowStaging(): RowStagingContext // throws if no ancestor provided it
```

The tab component calls `provideRowStaging({ staging, saving })` once, after setting up its own
`staging` and the `saving` from `useStagedSave` (see `ProjectsTab.vue`'s last line, §5.2 below); every
expansion component then calls `useRowStaging()` instead of receiving `staging`/`saving` as props.

---

## 5. Worked examples

### 5.1 Rows: `DataTable.vue`

`DataTable` owns the full lifecycle of top-level rows (Project/Student/Partner) through `staging.rows`,
and renders each cell through `staging.fields`/`staging.children` depending on whether the column is a
plain field or a proxy onto a nested record.

**Registering fetched rows** — a watch, not a computed, since registering is a write:

```ts
watch(
  () => props.data,
  (rows) => {
    for (const row of rows) props.staging.rows.register(props.rowKey(row), row)
  },
  { immediate: true }
)
```

**Rendering existing rows** merges each one through `rows.merge`, and reads its highlight state through
`rows.state`:

```ts
const existingRows = computed(() =>
  props.data.map((record) => {
    const id = props.rowKey(record)
    const state = props.staging.rows.state(id)
    return {
      id,
      record: props.staging.rows.merge(id),
      state,
      isNew: false,
      deleted: state === 'deleted',
    }
  })
)
```

**Rendering staged-new rows** reads `rows.drafts()` directly — no merge needed, the draft _is_ the
record — and these are pinned ahead of the paginated/sorted/filtered existing rows (ui.md §2.3.1):

```ts
const draftRows = computed(() =>
  props.staging.rows
    .drafts()
    .map(({ id, fields }) => ({ id, record: fields, state: 'new', isNew: true, deleted: false }))
)
const visibleRows = computed(() =>
  pageIndex.value === 0 ? [...draftRows.value, ...pagedRows.value] : pagedRows.value
)
```

**A cell** reads/writes through `fields` unless the column declares `editable.child`, in which case it
proxies onto a nested record via `children` instead (this is how Projects' Meeting Day column edits
that semester's `Team.meetingDay` — ui.md §3.1.1):

```ts
function valueFor(col, row) {
  const target = col.editable?.child?.(row.record)
  if (target) return props.staging.children.get(row.id, target.collection, target.id, target.field)
  return props.staging.fields.get(row.id, col.accessorKey)
}

function setValueFor(col, row, value) {
  const target = col.editable?.child?.(row.record)
  if (target)
    return props.staging.children.set(row.id, target.collection, target.id, target.field, value)
  props.staging.fields.set(row.id, col.accessorKey, value)
}
```

**Toolbar actions** call straight through to `rows`:

```ts
function onAdd() {
  const id = staging.rows.add(newRow()) /* expand it, jump to page 1 */
}
function onDelete() {
  staging.rows.markDeleted([...selected.value])
  selected.value = new Set()
}
function onUndo() {
  for (const id of selected.value) staging.rows.undo(id)
}
function onConfirm() {
  emit('save', staging.payload())
}
function onCancel() {
  staging.reset()
  emit('cancel')
}
```

### 5.2 Children: Projects tab + row expansion

`ProjectsTab.vue` creates the store, registers two child collections off the fetched list, and hands
`{staging, saving}` down to its expansion tree via `provideRowStaging`:

```ts
const { semesterId, guard } = useSemesterFilter()
const staging = useStagedChanges()
guard(staging) // asked before a semester/tab switch discards this tab's work

const {
  data: projects,
  refresh,
  status,
} = useFetch<ProjectRead[]>('/api/projects', {
  key: 'projects',
  query: computed(() => ({ semesterId: semesterId.value })),
  default: () => [],
})

// Register every project's Teams, and (flattened across those teams) every Membership, so
// ProjectRowExpansion/ProjectTeamCard never have to look up the fetched original themselves.
watch(
  projects,
  (list) => {
    for (const project of list) {
      staging.children.register(project.id, 'Teams', project.Teams ?? [], (t) => t.id)
      staging.children.register(
        project.id,
        'Memberships',
        (project.Teams ?? []).flatMap((t) => t.Memberships ?? []),
        (m) => m.id
      )
    }
  },
  { immediate: true }
)

const { saving, onSave } = useStagedSave({ staging /* ... */ })
provideRowStaging({ staging, saving })
```

```html
<DataTable
  :data="rows"
  :columns="columns"
  :staging="staging"
  :saving="saving"
  expandable
  @save="onSave"
>
  <template #expanded="{ row, rowId, deleted }">
    <ProjectRowExpansion :row-id="rowId" :row="row" :disabled="deleted" />
  </template>
</DataTable>
```

`ProjectRowExpansion.vue` never receives `staging` as a prop — it injects it, then reads/writes the
project's `description` field and its `Teams`/`Memberships` children:

```ts
const { staging, saving } = useRowStaging()

// A field that isn't a table column at all:
function descriptionValue() {
  return staging.fields.get(props.rowId, 'description') ?? ''
}
function setDescription(v: string) {
  staging.fields.set(props.rowId, 'description', v)
}

// Every team on the project — fetched (with staged edits) + staged-new, in one merged list:
const allTeamCards = computed(() =>
  staging.children
    .merge(props.rowId, 'Teams')
    .sort((a, b) => semesterSortKey(b.record.semesterId) - semesterSortKey(a.record.semesterId))
)

async function addTeam() {
  const draft = await openTeamModal({
    /* ... */
  })
  if (draft) staging.children.add(props.rowId, 'Teams', draft) // stages a new Team card, tinted green
}

async function addMember(teamId: string, isMentor: boolean) {
  const student = await openMemberModal({
    /* ... */
  })
  if (student) {
    staging.children.add(props.rowId, 'Memberships', { teamId, studentId: student.id, isMentor })
  }
}

// A "move" is two staged halves at once — remove from the source team, add to the destination:
async function moveMember(member: MergedChild<MemberLike>) {
  const destination = await openMoveModal({
    /* ... */
  })
  if (!destination) return
  if (member.isNew) staging.children.undo(props.rowId, 'Memberships', member.id)
  else staging.children.markDeleted(props.rowId, 'Memberships', member.id)
  staging.children.add(props.rowId, 'Memberships', {
    teamId: destination,
    studentId: member.record.studentId,
    isMentor: !!member.record.isMentor,
  })
}
```

Rendering a card reads its tint straight from the merged entry's `state`:

```html
<div v-for="card in teamCards" :key="card.id" :class="STAGE_TINTS[card.state]">
  <ProjectTeamCard
    :row-id="rowId"
    :row="row"
    :card="card"
    @add-member="addMember"
    @move-member="moveMember"
  />
</div>
```

Any of these `children` calls — `add`, `markDeleted`, `undo`, `set` — marks the _parent project row_
as edited too (`hasRowChanges` walks every child bucket), which is why adding a team or moving a member
turns the project's own row blue even though no field on the row itself changed (ui.md §3.1.3). Nothing
is sent to the server until the table's Confirm calls `staging.payload()` and the tab's `createProject`/
`updateProject` walk `record.children.Teams`/`record.children.Memberships`.

---

## 6. Behavior rules recap (from ui.md §2.3.1)

ui.md §2.3.1 states these as user-facing rules of the editing model. Each one is a direct consequence
of a specific piece of store mechanism, not a separate thing DataTable or a tab has to enforce itself:

| Rule (ui.md §2.3.1)                                                                                                                      | Mechanism                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setting an edited field back to its original value clears that field's outline; a row with no changed fields left stops being blue       | `isReverted()` (§1.6) — `fields.set`/`children.set` **delete** the staged entry instead of storing a no-op edit, so `isEdited`/`hasRowChanges` see nothing left there.                                                                       |
| Highlight precedence is deletion > edit > addition; marking a staged-new row for deletion just drops it from the store                   | `rows.state()`/`childState()` check `deleted`, then `isNew`, then "has changes" in that order; `markRowsDeleted`/`markChildDeleted` call `dropRow`/delete-from-bucket instead of setting `deleted` whenever the target is already `isNewId`. |
| A deletion-marked row is read-only; Delete only ever marks — pressing it again does nothing further; unmarking goes through Undo instead | `DataTable.renderCell`'s `disabled = row.deleted \|\| props.saving`; `markRowsDeleted`/`markChildDeleted` unconditionally set `deleted = true` on an existing record and never toggle it back — only `rows.undo`/`children.undo` do.         |
| Cancel unmarks and reverts everything at once                                                                                            | `reset()` (§1.5) walks every stage in one pass, clearing `fields`, `deleted`, and every child bucket together — there's no per-field or per-row Cancel.                                                                                      |
| Staged new rows are pinned to the top of the first page and exempt from sorting/column filters                                           | `DataTable`'s `visibleRows` prepends `rows.drafts()` ahead of `pagedRows`, only when `pageIndex === 0`; `drafts()` reads straight off the store, bypassing `filteredRows`/`sortedRows` entirely.                                             |
| Expansion editors write into the **same** store, so a nested change turns the parent row blue too                                        | Every expansion component reaches the _same_ `StagedChanges` instance via `useRowStaging()` — there is one store per table, never one per row, so `hasRowChanges` sees a dirty child bucket as part of its own row.                          |

## 7. Known limitations

A few of ui.md §3.4's "known limits" for the Database tabs are direct consequences of what the store
can and can't express, rather than independent bugs. Recorded here next to the mechanism that causes
them:

| Limit (ui.md §3.4)           | Why, in store terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy columns on a new row   | A column's `editable.child(row.record)` (`DataTableEditable.child`) resolves a `DataTableChildTarget` by searching the row's **fetched** nested arrays (e.g. `row.Teams`). A staged-new row's `record` is just its draft object — no such nested array exists to search — so `child()` returns `undefined` and `isEditableOn` renders the cell read-only. The store itself has no opinion here: it only mediates once a caller hands it a concrete `(collection, id, field)` target: it never resolves that target itself. |
| Team change is delete+create | There's no `PUT /api/memberships/:id`, so "move a student to another team" is modeled as `children.markDeleted` on the source membership plus a separate `children.add` on the destination — two independent `ChildStage` entries, not one edit. `moveMember`-style helpers (§5.2) re-collapse that pair into a single card for display, but the store still ships it to the server as a delete and a create, in that order.                                                                                               |

---

## 8. Cross-references

- `docs/design/ui.md` §2.3.1–§2.3.2 — the user-facing behavior this machinery implements.
- `docs/design/ui.md` §3.4.1 — the full list of shared composables/utils, including the ones this
  document doesn't cover in depth (`useSemesterCards.ts`, `useDirectory.ts`, `useRecordModals.ts`).
- `app/composables/useStagedChanges.ts`, `useSemesterFilter.ts`, `useStagedSave.ts`,
  `useRowStaging.ts` — source, each with its own header comment explaining the "why" behind its shape.
