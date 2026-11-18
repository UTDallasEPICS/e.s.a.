# DataTable — Component Reference

`app/components/DataTable.vue` is the generic `UTable` composition behind every major-record tab
(Projects, Students, Partners — `docs/design/ui.md` §2.3, §3). This document is the **component-level
reference**: its full prop/emit/slot surface, the column-configuration API, and how each part renders.

It complements two other docs rather than repeating them:

- `docs/design/ui.md` §2.3 describes the **user-facing behavior** — what a user sees and does.
- `docs/design/staging.md` describes the **staging machinery** (`useStagedChanges` and friends) that
  `DataTable` reads and writes through. This document treats that store as a given; read staging.md
  for how `staging.rows`/`staging.fields`/`staging.children` actually work.

This document is for someone adding or modifying a `DataTable`-backed tab: what to pass in, what each
column option does, and how a cell ends up looking the way it does.

---

## Table of contents

1. [Overview](#1-overview)
2. [Props](#2-props)
3. [Emits](#3-emits)
4. [Slots](#4-slots)
5. [Column configuration](#5-column-configuration)
   1. [`DataTableFilter`](#51-datatablefilter)
   2. [`DataTableEditable<T>`](#52-datatableeditablet)
   3. [`record-search` columns](#53-record-search-columns)
   4. [Proxy columns: `editable.child`](#54-proxy-columns-editablechild)
   5. [Column builders (`app/utils/columns.ts`)](#55-column-builders-apputilscolumnsts)
6. [Rendering and UI details](#6-rendering-and-ui-details)
   1. [Toolbar](#61-toolbar)
   2. [Column headers](#62-column-headers)
   3. [Cells](#63-cells)
   4. [Row highlighting](#64-row-highlighting)
   5. [Expand and select columns](#65-expand-and-select-columns)
   6. [Row ordering, filtering, sorting, pagination](#66-row-ordering-filtering-sorting-pagination)
   7. [Overall table states](#67-overall-table-states)
7. [How values are resolved (for column authors)](#7-how-values-are-resolved-for-column-authors)
8. [Minimal usage example](#8-minimal-usage-example)
9. [Related components](#9-related-components)
10. [Known limits](#10-known-limits)

---

## 1. Overview

`DataTable` is a Vue 3 generic component (`generic="T extends Record<string, any>"`) that owns:

- **Rendering** — column headers, cells, row highlighting, the expand/select columns.
- **Client-side data shaping** — sort, filter, and pagination, all computed over already-fetched rows;
  no column config can trigger a network request.
- **The editing toolbar** — Add / Delete / Undo / Confirm / Cancel, wired to a `StagedChanges` store
  passed in as a prop.

It does **not** own: fetching (`data` is a prop, refreshed by the parent tab), what a Confirm actually
sends to the server (the parent's `@save` handler decides), or anything about a row's expansion content
beyond rendering the `#expanded` slot.

Only Partner, Project, and Student use it — the three **major records**. Minor records (Team, Contact,
Choice, Enrollment, Membership) have no list endpoint of their own and are never rendered through
`DataTable`; they appear as cards inside a major record's `#expanded` slot instead (§4 below).

---

## 2. Props

```ts
const props = defineProps<{
  data: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string
  staging: StagedChanges
  loading?: boolean
  expandable?: boolean
  saving?: boolean
  newRow?: () => Record<string, any>
}>()
```

| Prop         | Type                        | Required | Purpose                                                                                                                                                                                                      |
| ------------ | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data`       | `T[]`                       | Yes      | The fetched rows for this table. `DataTable` never mutates or re-fetches this — it's read-only input, re-registered into `staging` on every change.                                                          |
| `columns`    | `DataTableColumn<T>[]`      | Yes      | The column configuration — see §4. Can be a plain array or a `computed` (both `ProjectsTab` and `StudentsTab` use a computed, since their semester-specific columns only exist once a semester is selected). |
| `rowKey`     | `(row: T) => string`        | Yes      | Extracts a stable id from a fetched row. Almost always `(row) => row.id`. Used as the staging-store key and as `UTable`'s `get-row-id`.                                                                      |
| `staging`    | `StagedChanges`             | Yes      | The store from `useStagedChanges()`, owned by the parent tab (one store per table). `DataTable` registers rows into it and reads/writes every cell through it.                                               |
| `loading`    | `boolean`                   | No       | Forwarded to `UTable`'s built-in loading bar. Pass the tab's fetch status (`status === 'pending'`).                                                                                                          |
| `expandable` | `boolean`                   | No       | Renders the chevron expand column and lets `#expanded` be used. Every current tab passes this — minor-record detail (teams, contacts, enrollments) lives there.                                              |
| `saving`     | `boolean`                   | No       | Disables every editable input and toolbar button while a save request is in flight, and puts a spinner on Confirm. Pass the `saving` ref returned by `useStagedSave()`.                                      |
| `newRow`     | `() => Record<string, any>` | No       | A factory returning a blank draft row. **Its presence is what turns the Add button on** — omit it and no Add button renders at all (a table that only supports editing existing rows).                       |

## 3. Emits

```ts
const emit = defineEmits<{
  save: [payload: StagedPayload]
  cancel: []
}>()
```

| Event    | Payload         | Fired when                                                                                                                                                                                                                                                                |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `save`   | `StagedPayload` | Confirm is pressed. The payload is exactly `staging.payload()` — see `staging.md` §1.5. `DataTable` does **not** clear the store or call any API itself; the parent's handler (normally `useStagedSave()`'s `onSave`) owns that.                                          |
| `cancel` | none            | Cancel is pressed, **after** `staging.reset()` has already run and the row selection has been cleared. Most tabs don't listen to this — `staging.reset()` alone is enough — but it's available for a tab that needs to react (e.g. closing something else that was open). |

## 4. Slots

| Slot       | Scope                                                                            | Rendered when                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expanded` | `{ row: T, rowId: string, state: StageState, isNew: boolean, deleted: boolean }` | `expandable` is true and a row is toggled open. `row` is the **merged** record (fetched + staged edits, via `staging.rows.merge`, or the draft itself for a new row) — always read current values from it, never from the original fetch. |

Example (`ProjectsTab.vue`):

```html
<DataTable
  :data="rows"
  :columns="columns"
  :row-key="(row) => row.id"
  :staging="staging"
  :loading="status === 'pending'"
  :saving="saving"
  expandable
  :new-row="newRow"
  @save="onSave"
>
  <template #expanded="{ row, rowId, deleted }">
    <ProjectRowExpansion :row-id="rowId" :row="row" :disabled="deleted" />
  </template>
</DataTable>
```

`deleted` is the one scope value expansion content actually needs to read on its own: an expansion
component disables its own controls when the parent row is marked for deletion (`:disabled="deleted"`),
matching the "a deletion-marked row is read-only" rule in ui.md §2.3.1.

---

## 5. Column configuration

```ts
export interface DataTableColumn<T> {
  id: string
  header: string
  accessorKey: keyof T & string
  format?: (value: any, row: T) => string
  sortable?: boolean
  filter?: DataTableFilter
  editable?: DataTableEditable<T>
  required?: boolean
}
```

| Field         | Type                     | Meaning                                                                                                                                                                                                                                                  |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`                 | The column's identity for sort/filter state and `TableColumn.id`. Usually equal to `accessorKey`, except a proxy column that needs a distinct id from the field it displays (e.g. Partners' `primaryName` column vs. a differently-keyed field).         |
| `header`      | `string`                 | The column header label.                                                                                                                                                                                                                                 |
| `accessorKey` | `keyof T & string`       | The field on the **row** this column reads by default (`staging.fields.get(rowId, accessorKey)`). Still required even when `editable.child` redirects both read and write elsewhere — see §5.4.                                                          |
| `format`      | `(value, row) => string` | Formats the raw value for display. Applied to non-editable cells, and (via `displayValueFor`) to the value used for filtering and sorting — so a column storing an id but showing a name (e.g. Project's Partner) filters/sorts on the name, not the id. |
| `sortable`    | `boolean`                | Shows the sort control in the header (§6.2). Numbers sort numerically; everything else via `localeCompare` (case-insensitive).                                                                                                                           |
| `filter`      | `DataTableFilter`        | See §5.1. Omit for no filter control.                                                                                                                                                                                                                    |
| `editable`    | `DataTableEditable<T>`   | See §5.2. Omit for a read-only column — `format(value, row)` (or the stringified value) renders and nothing else.                                                                                                                                        |
| `required`    | `boolean`                | Blocks Confirm while the field is blank **on a staged row** (new, edited, or with a dirty child) — see §7. Has no effect on a clean, unstaged row even if the underlying value is empty.                                                                 |

### 5.1 `DataTableFilter`

```ts
export interface DataTableFilter {
  type: 'search' | 'multiselect'
  options?: { label: string; value: string }[]
}
```

| `type`          | Control                               | Matching                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'search'`      | `UInput`, xs, width 28                | Case-insensitive substring match against the column's **display** value (`format` applied).                                                                                                                                                                                      |
| `'multiselect'` | `USelectMenu`, multiple, xs, width 28 | Row passes if its **raw** value (not `format`-ed) is included in the selected set. `options` is required — the values are matched with `String(rawValue)`, so they should line up with the enum's actual wire values (see enumColumn, §5.5). An empty selection filters nothing. |

Both render a clear (✗) button once a value is set, and setting/clearing a filter resets to page 1.

### 5.2 `DataTableEditable<T>`

```ts
export interface DataTableEditable<T> {
  type: 'text' | 'select' | 'switch' | 'record-search'
  options?: { label: string; value: any }[]
  search?: (query: string) => Promise<any[]>
  displayLabel?: (item: any) => string
  toValue?: (item: any) => any
  fromValue?: (value: any, row: T) => any
  child?: (row: T) => DataTableChildTarget | undefined
}
```

`type` picks the input rendered in an editable cell:

| `type`            | Input                    | Extra options used                                          |
| ----------------- | ------------------------ | ----------------------------------------------------------- |
| `'text'`          | `UInput`, ghost variant  | —                                                           |
| `'select'`        | `USelectMenu`            | `options` — the item list (`valueKey: 'value'`)             |
| `'switch'`        | `USwitch`                | —                                                           |
| `'record-search'` | `RecordSearchInput` (§9) | `search`, `displayLabel`, `toValue`, `fromValue` — see §5.3 |

### 5.3 `record-search` columns

For a column that edits a reference to another major record (e.g. a Project row's Partner), `type:
'record-search'` wraps `RecordSearchInput` (§9):

| Option         | Signature                           | Purpose                                                                                                                                                                                              |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`       | `(query: string) => Promise<any[]>` | Runs on every search-term change. Typically a client-side filter over an already-fetched directory list (`utils/search.ts`'s `searchPartners`/`searchStudents`/`searchProjects`), not a new request. |
| `displayLabel` | `(item: any) => string`             | How a result (and the current selection) is labeled. Defaults to `item?.name`.                                                                                                                       |
| `toValue`      | `(item: any) => any`                | Converts the picked record into what gets staged (usually its id).                                                                                                                                   |
| `fromValue`    | `(value: any, row: T) => any`       | The inverse — converts the staged/stored value back into the record object the input displays.                                                                                                       |

```ts
// ProjectsTab.vue
textColumn<ProjectRow>('partnerId', 'Partner', {
  format: (_value, row) => row.Partner?.name ?? '',
  editable: {
    type: 'record-search',
    search: async (query: string) => searchPartners(allPartners.value, query),
    displayLabel: (partner: PartnerRead) => partner.name,
    toValue: (partner: PartnerRead) => partner.id,
    fromValue: (value: string) => allPartners.value.find((p) => p.id === value),
  },
  required: true,
})
```

The cell stages `partnerId` (the id `toValue` returns); `fromValue` reads it back out to resolve the
full `PartnerRead` the input needs to display a label.

### 5.4 Proxy columns: `editable.child`

Most columns edit a field on the row itself. A column can instead proxy a field on a **nested minor
record** — same header, same cell, but its value and edits are routed through `staging.children`
against a different `(collection, id)` than the row:

```ts
export interface DataTableChildTarget {
  collection: string
  id: string
  field: string
}
```

`editable.child(row)` is called with the row's **merged** record on every render and returns the target
to proxy, or `undefined` if there's nothing to proxy yet (in which case the cell falls back to
**read-only display**, ignoring the rest of `editable` — see `isEditableOn` in the component). This is
how Projects' Meeting Day column edits that semester's `Team.meetingDay`:

```ts
// ProjectsTab.vue
{
  id: 'meetingDay',
  header: 'Meeting Day',
  accessorKey: 'meetingDay',
  sortable: true,
  format: (value) => dayLabel(value),
  editable: {
    type: 'select',
    options: MEETING_DAY_OPTIONS,
    child: (row) => {
      const team = row.Teams?.find((t) => t.semesterId === semesterId.value)
      return team ? { collection: 'Teams', id: team.id, field: 'meetingDay' } : undefined
    },
  },
}
```

When the project has no team for the selected semester, `child` returns `undefined` and the cell shows
`—`, un-editable — a team must be added from the expansion first (ui.md §3.1.1). The same pattern
drives every semester-specific Student column (`StudentsTab.vue`'s `ENROLLMENT_FIELDS` loop), proxying
onto that student's `Enrollment` for the selected semester:

```ts
function enrollmentTarget(field: string) {
  return (row: StudentRow) => {
    const enrollment = row.Enrollments?.find((e) => e.semesterId === semesterId.value)
    return enrollment ? { collection: 'Enrollments', id: enrollment.id, field } : undefined
  }
}
// ...
editable: options
  ? { type: 'select', options: [...options], child: enrollmentTarget(field) }
  : { type: 'text', child: enrollmentTarget(field) },
```

A proxy column and any expansion component editing the same child field (e.g. that Enrollment's Major
field shown again on its semester card) share one staged edit — whichever is touched last wins, and
both surfaces reflect it, since both go through the identical `staging.children.get/set(rowId,
collection, childId, field)` call.

**Known gap** (ui.md §3.4): `child` is evaluated against the row's fetched/merged record, so it can
never resolve against a **staged-new** child — a brand-new project row's Meeting Day has no team yet to
proxy onto and stays read-only until a team is added via the Team Creation Modal.

A column need not be _always_ a proxy — a column with `editable` but no `child` at all is a plain
row-field editor (the common case); `child` only applies when the column is specifically routing to a
nested record.

### 5.5 Column builders (`app/utils/columns.ts`)

Two builders cover the column shapes that repeat across every tab; reach for a plain object literal
when a column needs a mix `textColumn`/`enumColumn` don't cover (e.g. anything using `editable.child`,
`record-search`, or a custom `id` distinct from `accessorKey`).

```ts
/** Sortable, search-filtered, inline text-editable — the default for a plain string field. */
function textColumn<T>(
  accessorKey: keyof T & string,
  header: string,
  extra?: Partial<DataTableColumn<T>>
): DataTableColumn<T>

/** Multiselect-filtered and select-editable over one set of enum options. */
function enumColumn<T>(
  accessorKey: keyof T & string,
  header: string,
  options: SelectOption[],
  extra?: Partial<DataTableColumn<T>>
): DataTableColumn<T>
```

```ts
textColumn<ProjectRow>('name', 'Name', { required: true })
// => { id: 'name', header: 'Name', accessorKey: 'name', sortable: true,
//      filter: { type: 'search' }, editable: { type: 'text' }, required: true }

enumColumn<ProjectRow>('status', 'Status', PROJECT_STATUS_OPTIONS)
// => { id: 'status', header: 'Status', accessorKey: 'status',
//      filter: { type: 'multiselect', options: PROJECT_STATUS_OPTIONS },
//      editable: { type: 'select', options: PROJECT_STATUS_OPTIONS } }
```

`extra` is shallow-merged last, so any field — `sortable: false`, a `format`, an overridden `editable`,
even `id` — can override the builder's default. `PartnersTab.vue` uses this to turn a `textColumn` into
a display-only proxy column: `textColumn(accessorKey, header, { id, editable: undefined })`.

`options` for `enumColumn` (and for a hand-written `select`/`multiselect` column) is a
`SelectOption<V>[]` from `app/utils/options.ts` — `{ label: string; value: V }[]` with hand-written
labels (`utils/options.ts`'s header comment: a generic transform gets `EPCS_2200` wrong) and
server-typed values, e.g. `PROJECT_STATUS_OPTIONS: SelectOption<ProjectStatus>[]`.

---

## 6. Rendering and UI details

### 6.1 Toolbar

Rendered above the table. Every button issues no request of its own — only Confirm ever emits `save`,
and Cancel only resets the local store; nothing here talks to the network directly.

| Button  | Icon                               | Enabled when                                                | Result                                                                                                                                                                                                                                                                                           |
| ------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add     | `i-heroicons-plus` (+)             | `newRow` prop given, not `saving`                           | Appends one blank draft row (from `newRow`), pre-expanded and (if `expandable`) opened. Each click adds another.                                                                                                                                                                                 |
| Delete  | `i-heroicons-minus` (−)            | ≥1 row selected, not `saving`                               | Marks every selected row for deletion and clears the selection (a selected staged-new row is dropped instead, since there's nothing server-side to delete).                                                                                                                                      |
| Undo    | `i-heroicons-arrow-uturn-left` (↺) | ≥1 selected row is new/edited/deletion-marked, not `saving` | Undoes each such selected row individually — drops an addition, restores an edited row (and its staged children) to original, unmarks a deletion — and clears the selection. Always rendered; a mix of clean and dirty rows in the selection still enables it, leaving the clean ones untouched. |
| Confirm | `i-heroicons-check` (✓)            | `staging.isDirty` and no row is invalid, not `saving`       | Emits `save` with `staging.payload()`. Shows a spinner while `saving` is true.                                                                                                                                                                                                                   |
| Cancel  | `i-heroicons-x-mark` (✗)           | `staging.isDirty`, not `saving`                             | Calls `staging.reset()`, clears the row selection, emits `cancel`.                                                                                                                                                                                                                               |

All five buttons render unconditionally (their `disabled` state carries the meaning) — there is no
show/hide toggle based on dirtiness. A validation hint (`Fill in every required field to confirm.`)
renders inline in the toolbar whenever the store is dirty and any staged row is invalid (§7).

### 6.2 Column headers

Each header stacks: label (+ sort button if `sortable`), then the filter control if `filter` is set,
then a clear button once that column's filter has a value.

| Control                  | Component                            | Behavior                                                                                                                                                   |
| ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sort                     | `UButton` (ghost, xs)                | Cycles **unset** (↕) → **ascending** (↑) → **descending** (↓) → unset. Sorting one column clears any other column's sort — only one active sort at a time. |
| Filter — `'search'`      | `UInput` (xs, `w-28`)                | Case-insensitive substring match on the column's **display** value (§5.1).                                                                                 |
| Filter — `'multiselect'` | `USelectMenu` (multiple, xs, `w-28`) | Row passes if its **raw** value is in the selected set; an empty selection filters nothing.                                                                |
| Filter clear             | `UButton` ✗ (ghost, xs)              | Rendered only while that column's filter has a value; clears it and resets to page 1.                                                                      |

### 6.3 Cells

| Cell condition                                                               | Rendering                                                                                                                    |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| No `editable`, or `editable.child` resolves to `undefined`                   | `format(value, row)` if given, else `String(value ?? '')`; blank renders as `—`.                                             |
| `editable`, not required, clean                                              | The input for `editable.type` (§5.2), un-highlighted.                                                                        |
| `editable`, value differs from original, on an **existing** row              | Same input with a warning-colored ring (yellow outline) — `isEditedFor` is true.                                             |
| `editable`, on a **staged-new** row                                          | Same input, **no** per-field ring — the whole row is already tinted green, so individual fields don't get their own outline. |
| `editable`, `required`, blank, on a staged (new/edited/deleted-adjacent) row | Error-colored ring (red outline) instead of the warning ring — `invalid` takes precedence over `edited`.                     |
| Row marked for deletion, or `saving` is true                                 | Input is `disabled`.                                                                                                         |

The highlight precedence in code (`renderCell`): `invalid` (required+blank+dirty) beats `edited`, and
`edited` only applies `!row.isNew` (new rows never get per-field highlighting). This is the field-level
half of the deletion > edit > addition precedence ui.md §2.3.1 describes at the row level.

### 6.4 Row highlighting

Row-level tint comes from `STAGE_TINTS[row.state]` (`useStagedChanges.ts`), applied via `UTable`'s
`meta.class.tr`:

| `state`     | Tint                                               |
| ----------- | -------------------------------------------------- |
| `'new'`     | `bg-success-50` / `dark:bg-success-950/50` (green) |
| `'edited'`  | `bg-info-50` / `dark:bg-info-950/50` (blue)        |
| `'deleted'` | `bg-error-50` / `dark:bg-error-950/50` (red)       |
| `'clean'`   | none                                               |

`STAGE_TINTS` is exported precisely so expansion components can tint their own cards (team cards,
contact cards, semester-info cards) with the same four colors — see staging.md §1.7.

### 6.5 Expand and select columns

| Column | Present           | Behavior                                                                                                                                                                      |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expand | `expandable` prop | Per-row chevron toggling `#expanded`. Multiple rows can be expanded at once (`v-model:expanded` is a `Record<string, boolean>`, not a single id).                             |
| Select | Always            | Per-row checkbox plus a header checkbox with tri-state (all / indeterminate / none), scoped to the currently **filtered** rows (`filteredRows`), not the full unfiltered set. |

Staged-new rows are selectable too — selecting one and pressing Delete drops it from the store outright
rather than marking it (ui.md §2.3.1).

### 6.6 Row ordering, filtering, sorting, pagination

The pipeline, in order: `existingRows` (fetched rows merged with staged edits) → `filteredRows` (active
column filters applied) → `sortedRows` (active column sort applied) → `pagedRows` (sliced to the current
page). **Staged-new rows are separate**: `draftRows` comes straight from `staging.rows.drafts()`,
bypassing filter/sort entirely, and is prepended to page 1's rows in `visibleRows` — so a half-filled
new row can never be filtered or sorted out of view, and never counts toward another page.

Changing the page size or the active filters resets to page 1 (a `watch` clamps `pageIndex` back to 0
whenever it would exceed the new `pageCount`).

| Control         | Component                             | Behavior                                                                    |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Rows per page   | `USelectMenu` — 10 / 25 / 50 (`w-24`) | Changing the size resets to page 1.                                         |
| Page navigation | `UPagination`                         | First (`<<`) / Previous (`<`) / Next (`>`) / Last (`>>`) plus page numbers. |

All client-side over the already-fetched `data` — there is no server-side paging, sorting, or
filtering anywhere in this component.

### 6.7 Overall table states

| State   | Condition                                           | Appearance                                                                 |
| ------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Loading | `loading` prop true                                 | `UTable`'s built-in loading bar                                            |
| Empty   | `data` is empty and nothing is staged               | `UTable`'s default empty message                                           |
| Clean   | Store not dirty                                     | Toolbar buttons besides Add/Delete disabled; no row highlighting           |
| Dirty   | ≥1 staged addition, edit, or deletion               | Confirm/Cancel enabled; affected rows carry their green/blue/red highlight |
| Invalid | Dirty, and a staged row fails validation (§7)       | Confirm disabled; offending cells outlined red; toolbar hint shown         |
| Saving  | Confirm pressed, requests in flight (`saving` prop) | Every input and toolbar button disabled; Confirm shows a spinner           |

---

## 7. How values are resolved (for column authors)

Four internal functions decide what a cell reads and writes; understanding them explains every
behavior above without having to trace `staging.ts` yourself.

```ts
function valueFor(col, row) {
  const target = col.editable?.child?.(row.record)
  if (target) return staging.children.get(row.id, target.collection, target.id, target.field)
  return staging.fields.get(row.id, col.accessorKey)
}
```

`setValueFor` and `isEditedFor` mirror this: child target present → go through `staging.children`;
otherwise → `staging.fields` keyed on `accessorKey`.

```ts
function isEditableOn(col, row) {
  if (!col.editable) return false
  if (col.editable.child) return !!col.editable.child(row.record)
  return true
}
```

This is the single gate behind "a proxy column with no target renders read-only" (§5.4) — it's checked
before rendering an input at all, not left to the input to disable itself.

**Validation** (`invalidRowIds`, used for the Confirm-disabled state and the per-cell red ring) walks
every **staged** row (new, edited, or deletion-marked — `stagedRows`, not `data`) and every column with
`required: true` that's currently editable on that row (`isEditableOn`), flagging the row if the
resolved value is `undefined`, `null`, or `''`. A required column that's a `child` proxy with no
resolvable target is skipped — there's nothing to validate on a cell that isn't rendering an input.
A clean, un-staged row is never checked, even if a required field happens to be empty in the fetched
data — validation only ever blocks _new or in-progress_ edits.

---

## 8. Minimal usage example

```ts
// FooTab.vue <script setup>
import type { DataTableColumn } from '~/components/DataTable.vue'
import { textColumn } from '~/utils/columns'
import type { FooRead } from '#server/services/fooService'

const staging = useStagedChanges()

const { data: foos, refresh, status } = useFetch<FooRead[]>('/api/foos', { default: () => [] })

const columns: DataTableColumn<FooRead>[] = [
  textColumn<FooRead>('name', 'Name', { required: true }),
]

function newRow() {
  return { id: '', name: '' }
}

async function onSave(payload: StagedPayload) {
  for (const record of payload.created)
    await $fetch('/api/foos', { method: 'POST', body: record.fields })
  for (const record of payload.updated)
    await $fetch(`/api/foos/${record.id}`, { method: 'PUT', body: record.fields })
  for (const id of payload.deleted) await $fetch(`/api/foos/${id}`, { method: 'DELETE' })
  staging.reset()
  await refresh()
}
```

```html
<DataTable
  :data="foos"
  :columns="columns"
  :row-key="(row) => row.id"
  :staging="staging"
  :loading="status === 'pending'"
  :new-row="newRow"
  @save="onSave"
/>
```

In practice, every real tab uses `useStagedSave()` (staging.md §3) instead of hand-writing `onSave` —
it adds the delete-confirmation step, `saving` state, and create→update→delete ordering shown in the
Projects/Students/Partners examples throughout this document.

---

## 9. Related components

| Component                                 | Role                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RecordSearchInput.vue`                   | The async-search picker behind `editable.type === 'record-search'` (and reused directly inside modals/expansions for the same purpose). Props: `search`, `displayLabel`, `placeholder`, `disabled`, `highlight`, `color`; `v-model` is the selected record itself. Discards out-of-order search responses via a monotonic token. |
| `ConfirmationModal.vue` / `useConfirm.ts` | Opened by `useStagedSave()` before a Confirm that includes deletions — not opened by `DataTable` itself.                                                                                                                                                                                                                         |

---

## 10. Known limits

See ui.md §3.4 for the full list; the ones specific to `DataTable`'s own rendering:

- **No Item Panel.** There is no way to open a record's full detail outside of expanding its row —
  clicking a cell's text does nothing.
- **`editable.child` can't target a staged-new child** (§5.4) — a proxy column stays read-only on a
  brand-new row until the child it would proxy onto is created through some other control.
- **No column-level custom cell renderer.** A column is either the built-in display/format path or one
  of the four `editable.type` inputs — there's no escape hatch for a bespoke cell short of adding a
  fifth `editable.type` to the component itself.
- **No server-side sort/filter/paging.** Every `data` row is fetched up front; a column's `filter`/
  `sortable` only ever operates on what's already in memory.
