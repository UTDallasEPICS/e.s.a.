<script setup lang="ts">
  /**
   * Purpose
   * Render the partners tab part of the ESA interface.
   *
   * Inputs
   * - The component’s props, shared state, and any user actions it handles.
   *
   * Outputs
   * - Rendered controls or content, plus events exposed to the parent where applicable.
   *
   * Pseudocode
   * Read the inputs → prepare values for display → render the template → respond to user actions.
   */
  import type { DataTableColumn } from '~/components/DataTable.vue'
  import { textColumn } from '~/utils/columns'
  import type { PartnerCreate, PartnerRead, PartnerUpdate } from '#server/services/partnerService'
  import type { ContactCreate } from '#server/services/contactService'

  interface PartnerRow extends PartnerRead {
    primaryName: string
    primaryEmail: string
    primaryPhone: string
  }

  // Use useSemesterFilter to initialize { semesterId, guard }.
  const { semesterId, guard } = useSemesterFilter()
  // Use useRecordModals to initialize { openContactModal }.
  const { openContactModal } = useRecordModals()

  // Use useStagedChanges to initialize staging.
  const staging = useStagedChanges()
  // Call guard to run this step.
  guard(staging)

  // Use useFetch to initialize { data: partners, refresh, status, }.
  const {
    data: partners,
    refresh,
    status,
  } = useFetch<PartnerRead[]>('/api/partners', {
    key: 'partners',
    query: computed(() => ({ semesterId: semesterId.value })),
    default: () => [],
  })

  // Registers every partner's contacts, so contactValue/setContact (and the proxy columns' get/set
  // calls) never have to look up the fetched original themselves.
  watch(
    partners,
    (list) => {
      // Repeat the following steps for each item in list.
      for (const partner of list) {
        // Call staging.children.register to run this step.
        staging.children.register(partner.id, 'Contacts', partner.Contacts ?? [], (c) => c.id)
      }
    },
    { immediate: true }
  )

  // Rows are partners flattened with their primary contact, so the three contact columns can
  // display, sort, and filter on plain strings while their edits are routed to the contact (§3.3.1).
  const rows = computed<PartnerRow[]>(() =>
    partners.value.map((partner) => {
      // Define primary for the steps below.
      const primary = partner.Contacts.find((c) => c.isPrimary) ?? partner.Contacts[0]
      // Pass { ...partner, primaryName: primary?.name ?? '', primaryEmail: primary?.email ?? '', primaryPhone: pr back to the caller.
      return {
        ...partner,
        primaryName: primary?.name ?? '',
        primaryEmail: primary?.email ?? '',
        primaryPhone: primary?.phone ?? '',
      }
    })
  )

  // Display-only: the primary contact's info is editable only from the row expansion
  // (PartnerContactList), not inline in the table.
  function contactColumn(
    id: string,
    header: string,
    accessorKey: 'primaryName' | 'primaryEmail' | 'primaryPhone'
  ): DataTableColumn<PartnerRow> {
    // Pass textColumn<PartnerRow>(accessorKey, header, { id, editable: undefined }) back to the caller.
    return textColumn<PartnerRow>(accessorKey, header, { id, editable: undefined })
  }

  // Define columns for the steps below.
  const columns: DataTableColumn<PartnerRow>[] = [
    textColumn<PartnerRow>('name', 'Name', { required: true }),
    contactColumn('primaryName', 'Contact', 'primaryName'),
    contactColumn('primaryEmail', 'Email', 'primaryEmail'),
    contactColumn('primaryPhone', 'Phone', 'primaryPhone'),
  ]

  // Define the helper that will new row.
  function newRow() {
    // Pass { id: '', name: '', Contacts: [], Projects: [] } back to the caller.
    return { id: '', name: '', Contacts: [], Projects: [] }
  }

  // Define the helper that will projects for.
  function projectsFor(row: PartnerRow) {
    // Pass (row.Projects ?? []).filter( (project) => !semesterId.value || project.Teams.some((team) => team.sem back to the caller.
    return (row.Projects ?? []).filter(
      (project) =>
        !semesterId.value || project.Teams.some((team) => team.semesterId === semesterId.value)
    )
  }

  /** Stages the contact under its partner row; the POST happens on the table's Confirm (§3.3.3). */
  async function addContact(rowId: string) {
    // Define draft for the steps below.
    const draft = await openContactModal()
    // Check whether draft before running this branch.
    if (draft) staging.children.add(rowId, 'Contacts', draft)
  }

  // ------------------------------------------------------------------ save

  function contactBody(fields: Record<string, any>) {
    // Pass { name: String(fields.name ?? ''), email: String(fields.email ?? ''), phone: fields.phone ? String(f back to the caller.
    return {
      name: String(fields.name ?? ''),
      email: String(fields.email ?? ''),
      phone: fields.phone ? String(fields.phone) : undefined,
    }
  }

  // Define the helper that will create partner.
  async function createPartner(record: StagedRecord) {
    // Use groupChildren(record.children.Contacts) .added.map((child) => ({ ...contactBody(child.fields), isPri to initialize contacts.
    const contacts = groupChildren(record.children.Contacts)
      .added.map((child) => ({ ...contactBody(child.fields), isPrimary: !!child.fields.isPrimary }))
      .filter((contact) => contact.name || contact.email || contact.phone)
    // createPartner flags the first nested contact primary, so a staged primary has to lead.
    contacts.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))

    // Define body for the steps below.
    const body: PartnerCreate = {
      name: String(record.fields.name ?? ''),
      Contacts: contacts.length ? (contacts as Omit<ContactCreate, 'partnerId'>[]) : undefined,
    }
    await $fetch('/api/partners', { method: 'POST', body })
  }

  // Define the helper that will update partner.
  async function updatePartner(record: StagedRecord) {
    // Check whether Object.keys(record.fields).length before running this branch.
    if (Object.keys(record.fields).length) {
      // Define body for the steps below.
      const body: PartnerUpdate = { name: record.fields.name }
      await $fetch(`/api/partners/${record.id}`, { method: 'PUT', body })
    }

    // Use groupChildren to initialize { added, edited, deleted }.
    const { added, edited, deleted } = groupChildren(record.children.Contacts)
    // Repeat the following steps for each item in added.
    for (const child of added) {
      await $fetch('/api/contacts', {
        method: 'POST',
        body: { partnerId: record.id, ...contactBody(child.fields) },
      })
    }
    // Repeat the following steps for each item in edited.
    for (const child of edited) {
      await $fetch(`/api/contacts/${child.id}`, { method: 'PUT', body: child.fields })
    }
    // Repeat the following steps for each item in deleted.
    for (const child of deleted) {
      await $fetch(`/api/contacts/${child.id}`, { method: 'DELETE' })
    }
  }

  // Define the helper that will delete partner.
  async function deletePartner(id: string) {
    await $fetch(`/api/partners/${id}`, { method: 'DELETE' })
  }

  // Use useStagedSave to initialize { saving, onSave }.
  const { saving, onSave } = useStagedSave({
    staging,
    entity: 'partner',
    cascade: 'This will also delete all associated contacts and projects.',
    affected: (ids) => {
      // Use rows.value.filter to initialize selected.
      const selected = rows.value.filter((row) => ids.includes(row.id))
      // Pass [ { label: 'Contact', count: selected.reduce((n, p) => n + p.Contacts.length, 0) }, { label: 'Projec back to the caller.
      return [
        { label: 'Contact', count: selected.reduce((n, p) => n + p.Contacts.length, 0) },
        { label: 'Project', count: selected.reduce((n, p) => n + p.Projects.length, 0) },
      ]
    },
    refresh,
    create: createPartner,
    update: updatePartner,
    delete: deletePartner,
  })

  // Call provideRowStaging to run this step.
  provideRowStaging({ staging, saving })
</script>

<template>
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
      <div class="space-y-4 p-3">
        <PartnerContactList
          :row-id="rowId"
          :row="row"
          :disabled="deleted"
          @add="addContact(rowId)"
        />

        <div class="space-y-2">
          <h3 class="font-semibold">Projects</h3>
          <p v-if="!projectsFor(row).length" class="text-sm text-gray-500">No projects.</p>
          <ul class="space-y-1">
            <li
              v-for="project in projectsFor(row)"
              :key="project.id"
              class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
            >
              {{ project.name }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </DataTable>
</template>
