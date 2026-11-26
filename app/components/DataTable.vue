<script setup lang="ts" generic="T extends Record<string, any>
  /**
   * Purpose
   * Render the data table part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */">
  import { h, resolveComponent } from 'vue'
  import type { Row } from '@tanstack/vue-table'
  import type { TableColumn } from '@nuxt/ui'
  import RecordSearchInput from '~/components/RecordSearchInput.vue'
  import { ACTION_ICONS } from '~/utils/icons'
  import type { StagedChanges, StagedPayload } from '~/composables/useStagedChanges'

  export interface DataTableFilter {
    type: 'search' | 'multiselect'
    options?: { label: string; value: string }[]
  }

  /** Locates the minor record a column edits, when it is a proxy onto one (§3.1.1, §3.2.1). */
  export interface DataTableChildTarget {
    collection: string
    id: string
    field: string
  }

  export interface DataTableEditable<T> {
    type: 'text' | 'select' | 'switch' | 'record-search'
    options?: { label: string; value: any }[]
    /** record-search only. */
    search?: (query: string) => Promise<any[]>
    displayLabel?: (item: any) => string
    toValue?: (item: any) => any
    fromValue?: (value: any, row: T) => any
    /**
     * When set, the column edits a nested minor record rather than the row itself, and shares one
     * staged edit with the matching field in the row's expansion. Returning undefined for a row
     * means there is nothing to edit there yet, and the cell renders read-only.
     */
    child?: (row: T) => DataTableChildTarget | undefined
  }

  export interface DataTableColumn<T> {
    id: string
    header: string
    accessorKey: keyof T & string
    format?: (value: any, row: T) => string
    sortable?: boolean
    filter?: DataTableFilter
    editable?: DataTableEditable<T>
    /** Blocks Confirm while blank on a staged row. */
    required?: boolean
  }

  export interface DataTableRow<T> {
    id: string
    record: T
    state: StageState
    isNew: boolean
    deleted: boolean
  }

  // Use resolveComponent to initialize UButton.
  const UButton = resolveComponent('UButton')
  // Use resolveComponent to initialize UInput.
  const UInput = resolveComponent('UInput')
  // Use resolveComponent to initialize USelectMenu.
  const USelectMenu = resolveComponent('USelectMenu')
  // Use resolveComponent to initialize USwitch.
  const USwitch = resolveComponent('USwitch')
  // Use resolveComponent to initialize UCheckbox.
  const UCheckbox = resolveComponent('UCheckbox')

  // Use defineProps to initialize props.
  const props = defineProps<{
    data: T[]
    columns: DataTableColumn<T>[]
    rowKey: (row: T) => string
    staging: StagedChanges
    loading?: boolean
    expandable?: boolean
    saving?: boolean
    /** Blank draft used by Add. Without it the Add button is not rendered. */
    newRow?: () => Record<string, any>
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    save: [payload: StagedPayload]
    cancel: []
  }>()

  // Registers every row's fetched record with the staging store, so fields.get/fields.set never
  // need one passed in — a watcher rather than a computed, since registering is a write and Vue
  // computeds must stay pure.
  watch(
    () => props.data,
    (rows) => {
      // Repeat the following steps for each item in rows.
      for (const row of rows) props.staging.rows.register(props.rowKey(row), row)
    },
    { immediate: true }
  )

  // Store sort as state so Vue reacts when it changes.
  const sort = ref<{ id: string; desc: boolean } | null>(null)
  // Store filters as state so Vue reacts when it changes.
  const filters = ref<Record<string, any>>({})
  // Store selected as state so Vue reacts when it changes.
  const selected = ref<Set<string>>(new Set())
  // Store expanded as state so Vue reacts when it changes.
  const expanded = ref<Record<string, boolean>>({})
  // Store pageIndex as state so Vue reacts when it changes.
  const pageIndex = ref(0)
  // Store pageSize as state so Vue reacts when it changes.
  const pageSize = ref(10)

  // Recalculate columnById when the values it reads change.
  const columnById = computed(() => new Map(props.columns.map((col) => [col.id, col])))

  // ------------------------------------------------------------ row values

  /** The value a column shows for a row, reading through whichever stage owns it. */
  function valueFor(col: DataTableColumn<T>, row: DataTableRow<T>) {
    // Use col.editable?.child to initialize target.
    const target = col.editable?.child?.(row.record)
    // Check whether target before running this branch.
    if (target) {
      // Pass props.staging.children.get(row.id, target.collection, target.id, target.field) back to the caller.
      return props.staging.children.get(row.id, target.collection, target.id, target.field)
    }
    // Pass props.staging.fields.get(row.id, col.accessorKey) back to the caller.
    return props.staging.fields.get(row.id, col.accessorKey)
  }

  // Define the helper that will set value for.
  function setValueFor(col: DataTableColumn<T>, row: DataTableRow<T>, value: any) {
    // Use col.editable?.child to initialize target.
    const target = col.editable?.child?.(row.record)
    // Check whether target before running this branch.
    if (target) {
      // Call props.staging.children.set to run this step.
      props.staging.children.set(row.id, target.collection, target.id, target.field, value)
      return
    }
    // Call props.staging.fields.set to run this step.
    props.staging.fields.set(row.id, col.accessorKey, value)
  }

  // Define the helper that will is edited for.
  function isEditedFor(col: DataTableColumn<T>, row: DataTableRow<T>) {
    // Use col.editable?.child to initialize target.
    const target = col.editable?.child?.(row.record)
    // Check whether target before running this branch.
    if (target) {
      // Pass props.staging.children.isEdited(row.id, target.collection, target.id, target.field) back to the caller.
      return props.staging.children.isEdited(row.id, target.collection, target.id, target.field)
    }
    // Pass props.staging.fields.isEdited(row.id, col.accessorKey) back to the caller.
    return props.staging.fields.isEdited(row.id, col.accessorKey)
  }

  /** A column is editable on a row unless it proxies a minor record that does not exist yet. */
  function isEditableOn(col: DataTableColumn<T>, row: DataTableRow<T>) {
    // Check whether !col.editable before running this branch.
    if (!col.editable) return false
    // Check whether col.editable.child before running this branch.
    if (col.editable.child) return !!col.editable.child(row.record)
    // Pass true back to the caller.
    return true
  }

  // ---------------------------------------------------------------- rows

  const draftRows = computed<DataTableRow<T>[]>(() =>
    props.staging.rows.drafts().map(({ id, fields }) => ({
      id,
      record: fields as T,
      state: 'new' as StageState,
      isNew: true,
      deleted: false,
    }))
  )

  // Recalculate existingRows when the values it reads change.
  const existingRows = computed<DataTableRow<T>[]>(() =>
    props.data.map((record) => {
      // Use props.rowKey to initialize id.
      const id = props.rowKey(record)
      // Use props.staging.rows.state to initialize state.
      const state = props.staging.rows.state(id)
      // Pass { id, record: props.staging.rows.merge<T>(id), state, isNew: false, deleted: state === 'deleted', } back to the caller.
      return {
        id,
        record: props.staging.rows.merge<T>(id),
        state,
        isNew: false,
        deleted: state === 'deleted',
      }
    })
  )

  /**
   * What the user actually reads in the cell — the key a search filter and a sort must work on, so
   * that a column storing an id but displaying a name (Partner) searches and sorts by the name.
   * Multiselect filters deliberately keep the raw value, since their options carry raw enum values.
   */
  function displayValueFor(col: DataTableColumn<T>, row: DataTableRow<T>) {
    // Use valueFor to initialize value.
    const value = valueFor(col, row)
    // Pass col.format ? col.format(value, row.record) : value back to the caller.
    return col.format ? col.format(value, row.record) : value
  }

  // Recalculate filteredRows when the values it reads change.
  const filteredRows = computed(() => {
    // Use Object.entries(filters.value).filter to initialize active.
    const active = Object.entries(filters.value).filter(([, value]) => !isEmptyFilter(value))
    // Check whether !active.length before running this branch.
    if (!active.length) return existingRows.value
    // Pass existingRows.value.filter((row) => active.every(([colId, value]) => { const col = columnById.value.g back to the caller.
    return existingRows.value.filter((row) =>
      active.every(([colId, value]) => {
        // Use columnById.value.get to initialize col.
        const col = columnById.value.get(colId)
        // Check whether !col before running this branch.
        if (!col) return true
        // Check whether col.filter?.type === 'multiselect' before running this branch.
        if (col.filter?.type === 'multiselect') {
          // Pass (value as string[]).includes(String(valueFor(col, row))) back to the caller.
          return (value as string[]).includes(String(valueFor(col, row)))
        }
        // Pass String(displayValueFor(col, row) ?? '') .toLowerCase() .includes(String(value).toLowerCase()) back to the caller.
        return String(displayValueFor(col, row) ?? '')
          .toLowerCase()
          .includes(String(value).toLowerCase())
      })
    )
  })

  // Recalculate sortedRows when the values it reads change.
  const sortedRows = computed(() => {
    // Define state for the steps below.
    const state = sort.value
    // Check whether !state before running this branch.
    if (!state) return filteredRows.value
    // Use columnById.value.get to initialize col.
    const col = columnById.value.get(state.id)
    // Check whether !col before running this branch.
    if (!col) return filteredRows.value
    // Pass [...filteredRows.value].sort((a, b) => { const av = displayValueFor(col, a) const bv = displayValueF back to the caller.
    return [...filteredRows.value].sort((a, b) => {
      // Use displayValueFor to initialize av.
      const av = displayValueFor(col, a)
      // Use displayValueFor to initialize bv.
      const bv = displayValueFor(col, b)
      // Check whether av == null && bv == null before running this branch.
      if (av == null && bv == null) return 0
      // Check whether av == null before running this branch.
      if (av == null) return 1
      // Check whether bv == null before running this branch.
      if (bv == null) return -1
      // Define result for the steps below.
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
      // Pass state.desc ? -result : result back to the caller.
      return state.desc ? -result : result
    })
  })

  // Recalculate pageCount when the values it reads change.
  const pageCount = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)))

  // Recalculate pagedRows when the values it reads change.
  const pagedRows = computed(() => {
    // Define start for the steps below.
    const start = pageIndex.value * pageSize.value
    // Pass sortedRows.value.slice(start, start + pageSize.value) back to the caller.
    return sortedRows.value.slice(start, start + pageSize.value)
  })

  // Staged additions are pinned to the top of the first page, exempt from sorting and filtering,
  // so a half-filled row can never drop out of view (§2.3.1).
  const visibleRows = computed(() =>
    pageIndex.value === 0 ? [...draftRows.value, ...pagedRows.value] : pagedRows.value
  )

  // Run the callback when the watched values change.
  watch([filteredRows, pageSize], () => {
    // Check whether pageIndex.value > pageCount.value - 1 before running this branch.
    if (pageIndex.value > pageCount.value - 1) pageIndex.value = 0
  })

  // ------------------------------------------------------------- toolbar

  const stagedRows = computed(() => [
    ...draftRows.value,
    ...existingRows.value.filter((row) => row.state !== 'clean'),
  ])

  // Recalculate invalidRowIds when the values it reads change.
  const invalidRowIds = computed(() => {
    // Define ids for the steps below.
    const ids = new Set<string>()
    // Repeat the following steps for each item in stagedRows.value.
    for (const row of stagedRows.value) {
      // Check whether row.deleted before running this branch.
      if (row.deleted) continue
      // Repeat the following steps for each item in props.columns.
      for (const col of props.columns) {
        // Check whether !col.required || !isEditableOn(col, row) before running this branch.
        if (!col.required || !isEditableOn(col, row)) continue
        // Use valueFor to initialize value.
        const value = valueFor(col, row)
        // Check whether value === undefined || value === null || value === '' before running this branch.
        if (value === undefined || value === null || value === '') ids.add(row.id)
      }
    }
    // Pass ids back to the caller.
    return ids
  })

  // Recalculate isDirty when the values it reads change.
  const isDirty = computed(() => props.staging.isDirty.value)
  // Recalculate hasInvalid when the values it reads change.
  const hasInvalid = computed(() => invalidRowIds.value.size > 0)

  // Undo is only enabled once the selection actually contains something to undo — a selected but
  // untouched row contributes nothing.
  const hasUndoableSelection = computed(() =>
    [...selected.value].some((id) => props.staging.rows.state(id) !== 'clean')
  )

  // Define the helper that will on add.
  function onAdd() {
    // Check whether !props.newRow before running this branch.
    if (!props.newRow) return
    // Use props.staging.rows.add to initialize id.
    const id = props.staging.rows.add(props.newRow())
    // Update pageIndex.value with the value on the right.
    pageIndex.value = 0
    // Check whether props.expandable before running this branch.
    if (props.expandable) expanded.value = { ...expanded.value, [id]: true }
  }

  // Define the helper that will on delete.
  function onDelete() {
    // Call props.staging.rows.markDeleted to run this step.
    props.staging.rows.markDeleted([...selected.value])
    // Update selected.value with the value on the right.
    selected.value = new Set()
  }

  // Define the helper that will on undo.
  function onUndo() {
    // Repeat the following steps for each item in selected.value.
    for (const id of selected.value) props.staging.rows.undo(id)
    // Update selected.value with the value on the right.
    selected.value = new Set()
  }

  // Define the helper that will on confirm.
  function onConfirm() {
    // Call emit to run this step.
    emit('save', props.staging.payload())
  }

  // Define the helper that will on cancel.
  function onCancel() {
    // Call props.staging.reset to run this step.
    props.staging.reset()
    // Update selected.value with the value on the right.
    selected.value = new Set()
    // Call emit to run this step.
    emit('cancel')
  }

  // ------------------------------------------------------------ rendering

  function isEmptyFilter(value: any) {
    // Pass value === undefined || value === '' || (Array.isArray(value) && !value.length) back to the caller.
    return value === undefined || value === '' || (Array.isArray(value) && !value.length)
  }

  // Define the helper that will set filter.
  function setFilter(colId: string, value: any) {
    // Update filters.value with the value on the right.
    filters.value = { ...filters.value, [colId]: value }
    // Update pageIndex.value with the value on the right.
    pageIndex.value = 0
  }

  // Define the helper that will cycle sort.
  function cycleSort(colId: string) {
    // Define state for the steps below.
    const state = sort.value
    // Check whether !state || state.id !== colId before running this branch.
    if (!state || state.id !== colId) sort.value = { id: colId, desc: false }
    else if (!state.desc) sort.value = { id: colId, desc: true }
    else sort.value = null
  }

  // Define the helper that will sort icon.
  function sortIcon(colId: string) {
    // Define state for the steps below.
    const state = sort.value
    // Check whether !state || state.id !== colId before running this branch.
    if (!state || state.id !== colId) return ACTION_ICONS.sortUnset
    // Pass state.desc ? ACTION_ICONS.sortDesc : ACTION_ICONS.sortAsc back to the caller.
    return state.desc ? ACTION_ICONS.sortDesc : ACTION_ICONS.sortAsc
  }

  // Define the helper that will render header.
  function renderHeader(col: DataTableColumn<T>) {
    // Define labelAndSortControl for the steps below.
    const labelAndSortControl = [h('span', { class: 'font-medium' }, col.header)]
    // Check whether col.sortable before running this branch.
    if (col.sortable) {
      // Call labelAndSortControl.push to run this step.
      labelAndSortControl.push(
        h(UButton, {
          icon: sortIcon(col.id),
          size: 'xs',
          color: 'neutral',
          variant: 'ghost',
          'aria-label': `Sort by ${col.header}`,
          onClick: () => cycleSort(col.id),
        })
      )
    }

    // Define children for the steps below.
    const children = [
      h('span', { class: 'flex flex-row justify-between gap-1' }, labelAndSortControl),
    ]

    // Check whether col.filter before running this branch.
    if (col.filter) {
      // Define value for the steps below.
      const value = filters.value[col.id]
      // Call children.push to run this step.
      children.push(
        col.filter.type === 'search'
          ? h(UInput, {
              modelValue: value ?? '',
              size: 'xs',
              placeholder: 'Filter…',
              class: 'w-28',
              'onUpdate:modelValue': (v: string) => setFilter(col.id, v),
            })
          : h(USelectMenu, {
              modelValue: value ?? [],
              items: col.filter.options ?? [],
              valueKey: 'value',
              multiple: true,
              size: 'xs',
              placeholder: 'Filter…',
              class: 'w-28',
              'onUpdate:modelValue': (v: string[]) => setFilter(col.id, v),
            })
      )
      // Check whether !isEmptyFilter(value) before running this branch.
      if (!isEmptyFilter(value)) {
        // Call children.push to run this step.
        children.push(
          h(UButton, {
            icon: ACTION_ICONS.cancel,
            size: 'xs',
            color: 'neutral',
            variant: 'ghost',
            'aria-label': `Clear ${col.header} filter`,
            onClick: () => setFilter(col.id, undefined),
          })
        )
      }
    }

    // Pass h('div', { class: 'flex flex-col items-start gap-1 py-1' }, children) back to the caller.
    return h('div', { class: 'flex flex-col items-start gap-1 py-1' }, children)
  }

  // Define the helper that will render cell.
  function renderCell(col: DataTableColumn<T>, row: DataTableRow<T>) {
    // Use valueFor to initialize value.
    const value = valueFor(col, row)

    // Check whether !isEditableOn(col, row) before running this branch.
    if (!isEditableOn(col, row)) {
      // Define display for the steps below.
      const display = col.format ? col.format(value, row.record) : String(value ?? '')
      // Pass h('span', display || '—') back to the caller.
      return h('span', display || '—')
    }

    // Define editable for the steps below.
    const editable = col.editable!
    // Use isEditedFor to initialize edited.
    const edited = isEditedFor(col, row)
    // Define invalid for the steps below.
    const invalid =
      !!col.required &&
      (value === undefined || value === null || value === '') &&
      row.state !== 'clean'
    // Define disabled for the steps below.
    const disabled = row.deleted || props.saving
    // Define onUpdate for the steps below.
    const onUpdate = (v: any) => setValueFor(col, row, v)

    // A staged new row is already tinted green, so only existing rows get the per-field outline.
    const highlight = invalid || (edited && !row.isNew)
    // Define color for the steps below.
    const color = invalid ? 'error' : 'warning'

    // Check whether editable.type === 'switch' before running this branch.
    if (editable.type === 'switch') {
      // Pass h(USwitch, { modelValue: !!value, color: 'info', disabled, ui: highlight ? { base: invalid ? 'ring-2 back to the caller.
      return h(USwitch, {
        modelValue: !!value,
        color: 'info',
        disabled,
        ui: highlight ? { base: invalid ? 'ring-2 ring-error' : 'ring-2 ring-warning' } : undefined,
        'onUpdate:modelValue': onUpdate,
      })
    }

    // Check whether editable.type === 'select' before running this branch.
    if (editable.type === 'select') {
      // Pass h(USelectMenu, { modelValue: value ?? undefined, items: editable.options ?? [], valueKey: 'value', c back to the caller.
      return h(USelectMenu, {
        modelValue: value ?? undefined,
        items: editable.options ?? [],
        valueKey: 'value',
        class: 'w-full',
        disabled,
        highlight,
        color,
        'onUpdate:modelValue': onUpdate,
      })
    }

    // Check whether editable.type === 'record-search' before running this branch.
    if (editable.type === 'record-search') {
      // Pass h(RecordSearchInput, { modelValue: editable.fromValue?.(value, row.record), search: editable.search  back to the caller.
      return h(RecordSearchInput, {
        modelValue: editable.fromValue?.(value, row.record),
        search: editable.search ?? (async () => []),
        displayLabel: editable.displayLabel ?? ((item: any) => String(item?.name ?? '')),
        placeholder: 'Search…',
        disabled,
        highlight,
        color,
        class: 'w-full',
        'onUpdate:modelValue': (item: any) =>
          onUpdate(item ? (editable.toValue?.(item) ?? item) : undefined),
      })
    }

    // Pass h(UInput, { modelValue: value ?? '', class: 'w-full', variant: 'ghost', disabled, highlight, color,  back to the caller.
    return h(UInput, {
      modelValue: value ?? '',
      class: 'w-full',
      variant: 'ghost',
      disabled,
      highlight,
      color,
      'onUpdate:modelValue': onUpdate,
    })
  }

  // Recalculate allSelected when the values it reads change.
  const allSelected = computed(
    () =>
      filteredRows.value.length > 0 && filteredRows.value.every((row) => selected.value.has(row.id))
  )
  // Recalculate someSelected when the values it reads change.
  const someSelected = computed(() => selected.value.size > 0 && !allSelected.value)

  // Define the helper that will toggle all.
  function toggleAll() {
    // Update selected.value with the value on the right.
    selected.value = allSelected.value
      ? new Set()
      : new Set(filteredRows.value.map((row) => row.id))
  }

  // Define the helper that will toggle row.
  function toggleRow(id: string, on: boolean) {
    // Define next for the steps below.
    const next = new Set(selected.value)
    // Check whether on before running this branch.
    if (on) next.add(id)
    else next.delete(id)
    // Update selected.value with the value on the right.
    selected.value = next
  }

  // Recalculate tableColumns when the values it reads change.
  const tableColumns = computed<TableColumn<DataTableRow<T>>[]>(() => [
    ...(props.expandable
      ? [
          {
            id: 'expand',
            header: '',
            cell: ({ row }: { row: Row<DataTableRow<T>> }) =>
              h(UButton, {
                icon: row.getIsExpanded() ? ACTION_ICONS.collapse : ACTION_ICONS.expand,
                size: 'xs',
                color: 'neutral',
                variant: 'ghost',
                'aria-label': row.getIsExpanded() ? 'Collapse row' : 'Expand row',
                onClick: () => row.toggleExpanded(),
              }),
          } satisfies TableColumn<DataTableRow<T>>,
        ]
      : []),
    {
      id: 'select',
      header: () =>
        h(UCheckbox, {
          modelValue: allSelected.value ? true : someSelected.value ? 'indeterminate' : false,
          'aria-label': 'Select all rows',
          'onUpdate:modelValue': () => toggleAll(),
        }),
      // Staged-new rows are selectable too: Delete drops them from the store outright (§2.3.1).
      cell: ({ row }: { row: Row<DataTableRow<T>> }) =>
        h(UCheckbox, {
          modelValue: selected.value.has(row.original.id),
          'aria-label': 'Select row',
          'onUpdate:modelValue': (v: boolean) => toggleRow(row.original.id, v),
        }),
    },
    ...props.columns.map(
      (col): TableColumn<DataTableRow<T>> => ({
        id: col.id,
        header: () => renderHeader(col),
        cell: ({ row }: { row: Row<DataTableRow<T>> }) => renderCell(col, row.original),
      })
    ),
  ])

  // Recalculate tableMeta when the values it reads change.
  const tableMeta = computed(() => ({
    class: { tr: (row: Row<DataTableRow<T>>) => STAGE_TINTS[row.original.state] },
  }))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <UButton
        v-if="newRow"
        :icon="ACTION_ICONS.add"
        label="Add"
        color="neutral"
        variant="soft"
        :disabled="saving"
        @click="onAdd"
      />
      <UButton
        :icon="ACTION_ICONS.delete"
        label="Delete"
        color="error"
        variant="soft"
        :disabled="!selected.size || saving"
        @click="onDelete"
      />
      <UButton
        :icon="ACTION_ICONS.undo"
        label="Undo"
        color="neutral"
        variant="soft"
        :disabled="!hasUndoableSelection || saving"
        @click="onUndo"
      />
      <UButton
        :icon="ACTION_ICONS.confirm"
        label="Confirm"
        color="primary"
        :loading="saving"
        :disabled="!isDirty || hasInvalid || saving"
        @click="onConfirm"
      />
      <UButton
        :icon="ACTION_ICONS.cancel"
        label="Cancel"
        color="neutral"
        variant="soft"
        :disabled="!isDirty || saving"
        @click="onCancel"
      />
      <span v-if="isDirty && hasInvalid" class="text-error-500 text-xs">
        Fill in every required field to confirm.
      </span>
    </div>

    <UTable
      sticky
      class="max-h-[70vh]"
      v-model:expanded="expanded"
      :data="visibleRows"
      :columns="tableColumns"
      :loading="loading"
      :meta="tableMeta"
      :get-row-id="(row: DataTableRow<T>) => row.id"
    >
      <template v-if="expandable" #expanded="{ row }">
        <slot
          name="expanded"
          :row="row.original.record"
          :row-id="row.original.id"
          :state="row.original.state"
          :is-new="row.original.isNew"
          :deleted="row.original.deleted"
        />
      </template>
    </UTable>

    <div class="flex items-center justify-between">
      <USelectMenu v-model="pageSize" :items="[10, 25, 50]" class="w-24" />
      <UPagination
        :page="pageIndex + 1"
        :total="sortedRows.length"
        :items-per-page="pageSize"
        first-icon="i-heroicons-chevron-double-left"
        prev-icon="i-heroicons-chevron-left"
        next-icon="i-heroicons-chevron-right"
        last-icon="i-heroicons-chevron-double-right"
        @update:page="(p: number) => (pageIndex = p - 1)"
      />
    </div>
  </div>
</template>
