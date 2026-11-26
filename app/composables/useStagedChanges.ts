/**
 * Purpose
 * Provide the use staged changes logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Per-table staging store for the editing model in docs/design/ui.md §2.3.1.
//
// Every creation, edit, and deletion made in a DataTable — including the ones made inside a row's
// expansion — is held here until Confirm. Nothing in this file talks to the network: the owning tab
// reads `payload()` on Confirm and turns it into API calls itself.
//
// The returned API is grouped by audience rather than flat: `rows` is DataTable's own row-lifecycle
// machinery (nothing outside DataTable.vue calls it); `fields` reads/writes a row's own fields, used
// by DataTable's generic columns and by expansion components editing untabled fields; `children`
// stages nested minor records (Team, Contact, Choice, …) and is the one broadly shared across tabs
// and row-expansion components. `isDirty`/`reset`/`payload` stay top-level because
// `useSemesterFilter.ts`'s `SemesterGuard` expects `{isDirty, reset}` directly on the object passed
// to `guard()`.

export type StageState = 'new' | 'deleted' | 'edited' | 'clean'

/** A staged change to a minor record nested under a row (Team, Contact, Choice, …). */
export interface ChildStage {
  id: string
  isNew: boolean
  deleted: boolean
  /** Edited fields for an existing child; the whole draft for a staged-new one. */
  fields: Record<string, any>
  /**
   * The fetched record this child edits, cached by `children.register` so callers never have to
   * look it up and pass it to every get/set/merge call themselves. Unset for a staged-new child,
   * which has no server-side counterpart to compare against.
   */
  original?: Record<string, any>
}

interface RowStage {
  isNew: boolean
  deleted: boolean
  /** Edited fields for an existing row; the whole draft for a staged-new one. */
  fields: Record<string, any>
  children: Record<string, Record<string, ChildStage>>
  /** The fetched record this row edits, cached by `rows.register`. Unset for a staged-new row. */
  original?: Record<string, any>
}

export interface StagedRecord {
  id: string
  fields: Record<string, any>
  children: Record<string, ChildStage[]>
}

export interface StagedPayload {
  /** Rows added with the Add button, each with any minor records drafted in its expansion. */
  created: StagedRecord[]
  /** Existing rows with edited fields and/or nested changes. */
  updated: StagedRecord[]
  /** Ids of existing rows marked for deletion. */
  deleted: string[]
}

/** An existing or staged-new child merged into one object for rendering. */
export interface MergedChild<C> {
  id: string
  record: C
  state: StageState
  isNew: boolean
  deleted: boolean
}

/** Green / blue / red row and card tints for each stage state (§2.3.1). */
export const STAGE_TINTS: Record<StageState, string> = {
  new: 'bg-success-50 dark:bg-success-950/50',
  edited: 'bg-info-50 dark:bg-info-950/50',
  deleted: 'bg-error-50 dark:bg-error-950/50',
  clean: '',
}

// Define NEW_PREFIX for the steps below.
const NEW_PREFIX = 'new:'

// Define the helper that will is new id.
function isNewId(id: string) {
  // Pass id.startsWith(NEW_PREFIX) back to the caller.
  return id.startsWith(NEW_PREFIX)
}

export interface ChildGroups {
  added: ChildStage[]
  edited: ChildStage[]
  deleted: ChildStage[]
}

// Define the helper that will is child dirty.
function isChildDirty(child: ChildStage) {
  // Pass child.isNew || child.deleted || Object.keys(child.fields).length > 0 back to the caller.
  return child.isNew || child.deleted || Object.keys(child.fields).length > 0
}

/**
 * Splits a collection's staged children into the three things a save has to do with them. `edited`
 * excludes children whose fields ended up unchanged, so a caller can skip an empty PUT. Callers
 * still choose their own ordering — enrollments and memberships must delete before they create.
 */
export function groupChildren(children?: ChildStage[]): ChildGroups {
  // Define groups for the steps below.
  const groups: ChildGroups = { added: [], edited: [], deleted: [] }
  // Repeat the following steps for each item in children ?? [].
  for (const child of children ?? []) {
    // Check whether child.deleted before running this branch.
    if (child.deleted) {
      // Check whether !child.isNew before running this branch.
      if (!child.isNew) groups.deleted.push(child)
    } else if (child.isNew) {
      // Call groups.added.push to run this step.
      groups.added.push(child)
    } else if (Object.keys(child.fields).length) {
      // Call groups.edited.push to run this step.
      groups.edited.push(child)
    }
  }
  // Pass groups back to the caller.
  return groups
}

// Define the helper that will use staged changes.
export function useStagedChanges() {
  // Use reactive to initialize stages.
  const stages = reactive<Record<string, RowStage>>({})
  // Define counter for the steps below.
  let counter = 0

  // Define the helper that will next id.
  function nextId(kind: string) {
    // Pass `${NEW_PREFIX}${kind}:${++counter}` back to the caller.
    return `${NEW_PREFIX}${kind}:${++counter}`
  }

  // Define the helper that will stage for.
  function stageFor(id: string): RowStage {
    // Pass (stages[id] ??= { isNew: isNewId(id), deleted: false, fields: {}, children: {} }) back to the caller.
    return (stages[id] ??= { isNew: isNewId(id), deleted: false, fields: {}, children: {} })
  }

  /**
   * null, undefined, and '' are treated as the same "blank" for revert purposes — a cleared text
   * input models absence as '', a nullable fetched field models it as null, and a field reverted to
   * either should stop reading as edited.
   */
  function isBlank(value: any) {
    // Pass value == null || value === '' back to the caller.
    return value == null || value === ''
  }

  // Define the helper that will is reverted.
  function isReverted(value: any, original: any) {
    // Pass value === original || (isBlank(value) && isBlank(original)) back to the caller.
    return value === original || (isBlank(value) && isBlank(original))
  }

  // Define the helper that will has row changes.
  function hasRowChanges(stage: RowStage) {
    // Check whether stage.isNew || stage.deleted before running this branch.
    if (stage.isNew || stage.deleted) return true
    // Check whether Object.keys(stage.fields).length before running this branch.
    if (Object.keys(stage.fields).length) return true
    // Repeat the following steps for each item in Object.values(stage.children).
    for (const bucket of Object.values(stage.children)) {
      // Repeat the following steps for each item in Object.values(bucket).
      for (const child of Object.values(bucket)) {
        // Check whether isChildDirty(child) before running this branch.
        if (isChildDirty(child)) return true
      }
    }
    // Pass false back to the caller.
    return false
  }

  /**
   * Clears whatever is staged on an existing row's children in place: a staged-new child is
   * dropped, an edited or deleted one reverts to clean, keeping its cached original.
   */
  function clearChildren(stage: RowStage) {
    // Repeat the following steps for each item in Object.values(stage.children).
    for (const bucket of Object.values(stage.children)) {
      // Repeat the following steps for each item in Object.keys(bucket).
      for (const childId of Object.keys(bucket)) {
        // Define child for the steps below.
        const child = bucket[childId]!
        // Check whether child.isNew before running this branch.
        if (child.isNew) delete bucket[childId]
        else {
          // Update child.deleted with the value on the right.
          child.deleted = false
          // Update child.fields with the value on the right.
          child.fields = {}
        }
      }
    }
  }

  // ---------------------------------------------------------------- rows
  // DataTable.vue's own row-lifecycle machinery — nothing outside it calls this group.

  /** Stage a new row from a blank draft. Returns its temporary id. */
  function addRow(draft: Record<string, any>): string {
    // Use nextId to initialize id.
    const id = nextId('row')
    // Update stages[id] with the value on the right.
    stages[id] = { isNew: true, deleted: false, fields: { ...draft }, children: {} }
    // Pass id back to the caller.
    return id
  }

  /** Discard a staged-new row entirely (marking a green row for deletion drops it rather than
   *  colouring it red — there is nothing on the server yet to delete). */
  function dropRow(id: string) {
    delete stages[id]
  }

  /** Mark each id for deletion. Staged-new rows are dropped instead, since there is nothing to
   *  delete server-side; use `undo` to unmark an existing row. */
  function markRowsDeleted(ids: string[]) {
    // Repeat the following steps for each item in ids.
    for (const id of ids) {
      // Check whether isNewId(id) before running this branch.
      if (isNewId(id)) {
        // Call dropRow to run this step.
        dropRow(id)
        continue
      }
      // Update stageFor(id).deleted with the value on the right.
      stageFor(id).deleted = true
    }
  }

  /**
   * Undoes whatever is staged on a row and its children: a staged-new row is dropped, an edited
   * row's fields revert to clean, a deletion mark is lifted, and any staged child changes (e.g. a
   * Student's Enrollments/Choices/Memberships) are cleared too — a row can be "edited" purely from
   * child changes, so undoing the row must undo them for the row to actually turn clean.
   */
  function undoRow(id: string) {
    // Define stage for the steps below.
    const stage = stages[id]
    // Check whether !stage before running this branch.
    if (!stage) return
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) {
      // Call dropRow to run this step.
      dropRow(id)
      return
    }
    // Update stage.deleted with the value on the right.
    stage.deleted = false
    // Update stage.fields with the value on the right.
    stage.fields = {}
    // Call clearChildren to run this step.
    clearChildren(stage)
  }

  // Define the helper that will row state.
  function rowState(id: string): StageState {
    // Define stage for the steps below.
    const stage = stages[id]
    // Check whether !stage before running this branch.
    if (!stage) return 'clean'
    // Check whether stage.deleted before running this branch.
    if (stage.deleted) return 'deleted'
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) return 'new'
    // Pass hasRowChanges(stage) ? 'edited' : 'clean' back to the caller.
    return hasRowChanges(stage) ? 'edited' : 'clean'
  }

  /**
   * Caches the fetched record behind an existing row, so `fields.get`/`fields.set`/`rows.merge`
   * never need it passed in again. Called by DataTable for every row on every render of `data` —
   * cheap, and it keeps the cache current across a refetch.
   */
  function registerRow(id: string, record: Record<string, any>) {
    // Check whether isNewId(id) before running this branch.
    if (isNewId(id)) return
    // Update stageFor(id).original with the value on the right.
    stageFor(id).original = record
  }

  /**
   * A fetched row with its staged edits applied, for display, sorting, and filtering. Reads the
   * record cached by `rows.register` rather than taking one as an argument, so callers don't have
   * to keep re-threading the same object through — `register` runs immediately on every change to
   * the owning fetch, ahead of any render that could call `merge`, so the cache is always current.
   */
  function mergeRow<T extends Record<string, any>>(id: string): T {
    // Define stage for the steps below.
    const stage = stages[id]
    // Check whether !stage before running this branch.
    if (!stage) throw new Error(`rows.merge: row "${id}" was never registered`)
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) return stage.fields as T
    // Check whether !Object.keys(stage.fields).length before running this branch.
    if (!Object.keys(stage.fields).length) return stage.original as T
    // Pass { ...stage.original, ...stage.fields } as T back to the caller.
    return { ...stage.original, ...stage.fields } as T
  }

  /** Every staged-new row's temporary id and draft, in the order they were added. */
  function drafts(): { id: string; fields: Record<string, any> }[] {
    // Define result for the steps below.
    const result: { id: string; fields: Record<string, any> }[] = []
    // Repeat the following steps for each item in Object.entries(stages).
    for (const [id, stage] of Object.entries(stages)) {
      // Check whether stage.isNew before running this branch.
      if (stage.isNew) result.push({ id, fields: stage.fields })
    }
    // Pass result back to the caller.
    return result
  }

  // ------------------------------------------------------------- fields
  // A row's own fields — used by DataTable's generic columns and by expansion components editing
  // fields that aren't rendered as a column (e.g. a Project's description).

  /** The staged value for a field, falling back to the row's registered original. */
  function getValue(id: string, field: string) {
    // Define stage for the steps below.
    const stage = stages[id]
    // Check whether !stage before running this branch.
    if (!stage) return undefined
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) return stage.fields[field]
    // Pass field in stage.fields ? stage.fields[field] : stage.original?.[field] back to the caller.
    return field in stage.fields ? stage.fields[field] : stage.original?.[field]
  }

  /** Stage a field edit. Setting a value back to the registered original clears the edit. */
  function setValue(id: string, field: string, value: any) {
    // Use stageFor to initialize stage.
    const stage = stageFor(id)
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) {
      // Update stage.fields[field] with the value on the right.
      stage.fields[field] = value
      return
    }
    // Define original for the steps below.
    const original = stage.original?.[field]
    // Check whether isReverted(value, original) before running this branch.
    if (isReverted(value, original)) {
      delete stage.fields[field]
    } else {
      // Update stage.fields[field] with the value on the right.
      stage.fields[field] = value
    }
  }

  // Define the helper that will is field edited.
  function isFieldEdited(id: string, field: string) {
    // Define stage for the steps below.
    const stage = stages[id]
    // Pass !!stage && !stage.isNew && field in stage.fields back to the caller.
    return !!stage && !stage.isNew && field in stage.fields
  }

  // ------------------------------------------------------------ children

  function childrenFor(rowId: string, collection: string): Record<string, ChildStage> {
    // Use stageFor to initialize stage.
    const stage = stageFor(rowId)
    // Pass (stage.children[collection] ??= {}) back to the caller.
    return (stage.children[collection] ??= {})
  }

  // Define the helper that will child stage.
  function childStage(rowId: string, collection: string, childId: string): ChildStage | undefined {
    // Pass stages[rowId]?.children[collection]?.[childId] back to the caller.
    return stages[rowId]?.children[collection]?.[childId]
  }

  /** Stage a new minor record under a row. Returns its temporary id. */
  function addChild(rowId: string, collection: string, draft: Record<string, any>): string {
    // Use nextId to initialize id.
    const id = nextId(collection)
    // Update childrenFor(rowId, collection)[id] with the value on the right.
    childrenFor(rowId, collection)[id] = { id, isNew: true, deleted: false, fields: { ...draft } }
    // Pass id back to the caller.
    return id
  }

  /** Mark an existing child for deletion, or drop a staged-new one, since there is nothing to
   *  delete server-side; use `undo` to unmark it. */
  function markChildDeleted(rowId: string, collection: string, childId: string) {
    // Use childrenFor to initialize bucket.
    const bucket = childrenFor(rowId, collection)
    // Define existing for the steps below.
    const existing = bucket[childId]
    // Check whether existing?.isNew before running this branch.
    if (existing?.isNew) {
      delete bucket[childId]
      return
    }
    // Check whether existing before running this branch.
    if (existing) {
      // Update existing.deleted with the value on the right.
      existing.deleted = true
      return
    }
    // Update bucket[childId] with the value on the right.
    bucket[childId] = { id: childId, isNew: false, deleted: true, fields: {} }
  }

  /**
   * Undoes whatever is staged on a minor record — the Undo button on a green, blue, or red card. A
   * staged-new child is discarded entirely; an existing one reverts to clean, keeping its cached
   * original.
   */
  function undoChild(rowId: string, collection: string, childId: string) {
    // Use childrenFor to initialize bucket.
    const bucket = childrenFor(rowId, collection)
    // Define existing for the steps below.
    const existing = bucket[childId]
    // Check whether existing?.isNew before running this branch.
    if (existing?.isNew) {
      delete bucket[childId]
    } else if (existing) {
      // Update existing.deleted with the value on the right.
      existing.deleted = false
      // Update existing.fields with the value on the right.
      existing.fields = {}
    }
  }

  /**
   * Caches the fetched records behind an existing row's children, so `children.get`/`children.set`/
   * `children.merge` never need one passed in again. Rebuilds the bucket in `records`' order on
   * every call — reusing each already-known child's `ChildStage` by id rather than replacing it, so
   * staged edits survive — which keeps `children.merge`'s output in the current server order even
   * across a reorder-and-refresh, instead of freezing at whatever order a child was first seen in.
   * Any still-staged-new child (not yet saved, so absent from `records`) is carried over to the end
   * in its prior relative order.
   */
  function registerChildren<C extends Record<string, any>>(
    rowId: string,
    collection: string,
    records: C[],
    key: (record: C) => string
  ) {
    // Check whether isNewId(rowId) before running this branch.
    if (isNewId(rowId)) return
    // Use stageFor to initialize stage.
    const stage = stageFor(rowId)
    // Define oldBucket for the steps below.
    const oldBucket = stage.children[collection] ?? {}
    // Define newBucket for the steps below.
    const newBucket: Record<string, ChildStage> = {}
    // Repeat the following steps for each item in records.
    for (const record of records) {
      // Use key to initialize id.
      const id = key(record)
      // Define existing for the steps below.
      const existing = oldBucket[id]
      // Check whether existing before running this branch.
      if (existing) {
        // Update existing.original with the value on the right.
        existing.original = record
        // Update newBucket[id] with the value on the right.
        newBucket[id] = existing
      } else {
        // Update newBucket[id] with the value on the right.
        newBucket[id] = { id, isNew: false, deleted: false, fields: {}, original: record }
      }
    }
    // Repeat the following steps for each item in Object.entries(oldBucket).
    for (const [id, childStage] of Object.entries(oldBucket)) {
      // Check whether childStage.isNew before running this branch.
      if (childStage.isNew) newBucket[id] = childStage
    }
    // Update stage.children[collection] with the value on the right.
    stage.children[collection] = newBucket
  }

  // Define the helper that will get child value.
  function getChildValue(rowId: string, collection: string, childId: string, field: string) {
    // Use childStage to initialize stage.
    const stage = childStage(rowId, collection, childId)
    // Check whether !stage before running this branch.
    if (!stage) return undefined
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) return stage.fields[field]
    // Pass field in stage.fields ? stage.fields[field] : stage.original?.[field] back to the caller.
    return field in stage.fields ? stage.fields[field] : stage.original?.[field]
  }

  /**
   * Stage an edit on a minor record. A `childId` with the `new:` prefix that has no stage yet is
   * created as a staged addition, which is how a Partner with no contact yet gets one from an
   * inline contact-proxy column.
   */
  function setChildValue(
    rowId: string,
    collection: string,
    childId: string,
    field: string,
    value: any
  ) {
    // Use childrenFor to initialize bucket.
    const bucket = childrenFor(rowId, collection)
    // Define stage for the steps below.
    const stage = (bucket[childId] ??= {
      id: childId,
      isNew: isNewId(childId),
      deleted: false,
      fields: {},
    })
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) {
      // Update stage.fields[field] with the value on the right.
      stage.fields[field] = value
      return
    }
    // Define original for the steps below.
    const original = stage.original?.[field]
    // Check whether isReverted(value, original) before running this branch.
    if (isReverted(value, original)) {
      delete stage.fields[field]
    } else {
      // Update stage.fields[field] with the value on the right.
      stage.fields[field] = value
    }
  }

  // Define the helper that will is child field edited.
  function isChildFieldEdited(rowId: string, collection: string, childId: string, field: string) {
    // Use childStage to initialize stage.
    const stage = childStage(rowId, collection, childId)
    // Pass !!stage && !stage.isNew && field in stage.fields back to the caller.
    return !!stage && !stage.isNew && field in stage.fields
  }

  // Define the helper that will child state.
  function childState(rowId: string, collection: string, childId: string): StageState {
    // Use childStage to initialize stage.
    const stage = childStage(rowId, collection, childId)
    // Check whether !stage before running this branch.
    if (!stage) return 'clean'
    // Check whether stage.deleted before running this branch.
    if (stage.deleted) return 'deleted'
    // Check whether stage.isNew before running this branch.
    if (stage.isNew) return 'new'
    // Pass Object.keys(stage.fields).length ? 'edited' : 'clean' back to the caller.
    return Object.keys(stage.fields).length ? 'edited' : 'clean'
  }

  /**
   * Fetched children with staged edits applied, followed by staged-new ones, in the order cached by
   * `children.register`. Deleted children stay in the list so the UI can keep them in view, tinted
   * red. Reads entirely off the registered cache rather than taking the original list again — a
   * bucket only ever exists once `register` has populated it, so an empty/missing bucket here just
   * means the row genuinely has no children in this collection yet, not a registration bug.
   */
  function mergeChildren<C extends Record<string, any> = Record<string, any>>(
    rowId: string,
    collection: string
  ): MergedChild<C>[] {
    // Define bucket for the steps below.
    const bucket = stages[rowId]?.children[collection] ?? {}
    // Define merged for the steps below.
    const merged: MergedChild<C>[] = []
    // Repeat the following steps for each item in Object.values(bucket).
    for (const stage of Object.values(bucket)) {
      // Check whether stage.isNew before running this branch.
      if (stage.isNew) continue
      // Call merged.push to run this step.
      merged.push({
        id: stage.id,
        record: (Object.keys(stage.fields).length
          ? { ...stage.original, ...stage.fields }
          : stage.original) as C,
        state: childState(rowId, collection, stage.id),
        isNew: false,
        deleted: stage.deleted,
      })
    }
    // Repeat the following steps for each item in Object.values(bucket).
    for (const stage of Object.values(bucket)) {
      // Check whether !stage.isNew before running this branch.
      if (!stage.isNew) continue
      // Call merged.push to run this step.
      merged.push({
        id: stage.id,
        record: stage.fields as C,
        state: 'new',
        isNew: true,
        deleted: false,
      })
    }
    // Pass merged back to the caller.
    return merged
  }

  // -------------------------------------------------------------- global

  const isDirty = computed(() => Object.values(stages).some(hasRowChanges))

  /**
   * Discards every staged change (Cancel). A staged-new row is dropped entirely; an existing row's
   * edits, deletion mark, and staged children are cleared, but its registered `original` — and its
   * children's — stays cached, since nothing refetches on Cancel and dropping the cache would leave
   * every field reading as undefined until the next refresh.
   */
  function reset() {
    // Repeat the following steps for each item in Object.keys(stages).
    for (const id of Object.keys(stages)) {
      // Define stage for the steps below.
      const stage = stages[id]!
      // Check whether stage.isNew before running this branch.
      if (stage.isNew) {
        delete stages[id]
        continue
      }
      // Update stage.deleted with the value on the right.
      stage.deleted = false
      // Update stage.fields with the value on the right.
      stage.fields = {}
      // Call clearChildren to run this step.
      clearChildren(stage)
    }
  }

  // Define the helper that will to record.
  function toRecord(id: string, stage: RowStage): StagedRecord {
    // Define children for the steps below.
    const children: Record<string, ChildStage[]> = {}
    // Repeat the following steps for each item in Object.entries(stage.children).
    for (const [collection, bucket] of Object.entries(stage.children)) {
      // Use Object.values(bucket).filter to initialize list.
      const list = Object.values(bucket).filter(isChildDirty)
      // Check whether list.length before running this branch.
      if (list.length) children[collection] = list
    }
    // Pass { id, fields: { ...stage.fields }, children } back to the caller.
    return { id, fields: { ...stage.fields }, children }
  }

  // Define the helper that will payload.
  function payload(): StagedPayload {
    // Define created for the steps below.
    const created: StagedRecord[] = []
    // Define updated for the steps below.
    const updated: StagedRecord[] = []
    // Define deleted for the steps below.
    const deleted: string[] = []
    // Repeat the following steps for each item in Object.entries(stages).
    for (const [id, stage] of Object.entries(stages)) {
      // Check whether stage.isNew before running this branch.
      if (stage.isNew) created.push(toRecord(id, stage))
      else if (stage.deleted) deleted.push(id)
      else if (hasRowChanges(stage)) updated.push(toRecord(id, stage))
    }
    // Pass { created, updated, deleted } back to the caller.
    return { created, updated, deleted }
  }

  // Pass { isDirty, reset, payload, rows: { add: addRow, markDeleted: markRowsDeleted, undo: undoRow, state:  back to the caller.
  return {
    isDirty,
    reset,
    payload,
    rows: {
      add: addRow,
      markDeleted: markRowsDeleted,
      undo: undoRow,
      state: rowState,
      register: registerRow,
      merge: mergeRow,
      drafts,
    },
    fields: {
      get: getValue,
      set: setValue,
      isEdited: isFieldEdited,
    },
    children: {
      add: addChild,
      markDeleted: markChildDeleted,
      undo: undoChild,
      register: registerChildren,
      get: getChildValue,
      set: setChildValue,
      isEdited: isChildFieldEdited,
      merge: mergeChildren,
    },
  }
}

export type StagedChanges = ReturnType<typeof useStagedChanges>
