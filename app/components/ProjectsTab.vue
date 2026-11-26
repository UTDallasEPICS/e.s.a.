<script setup lang="ts">
  /**
   * Purpose
   * Render the projects tab part of the ESA interface.
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
  import { enumColumn, textColumn } from '~/utils/columns'
  import {
    dayLabel,
    MEETING_DAY_OPTIONS,
    PROJECT_STATUS_OPTIONS,
    PROJECT_TYPE_OPTIONS,
  } from '~/utils/options'
  import { searchPartners } from '~/utils/search'
  import type { PartnerRead } from '#server/services/partnerService'
  import type { ProjectRead } from '#server/services/projectService'
  import type { TeamRead } from '#server/services/teamService'

  type MeetingDay = TeamRead['meetingDay']

  /** A project row flattened with the meeting day of its team for the selected semester. */
  interface ProjectRow extends ProjectRead {
    meetingDay: MeetingDay | null
  }

  // Use useSemesterFilter to initialize { semesterId, guard }.
  const { semesterId, guard } = useSemesterFilter()

  // Use useStagedChanges to initialize staging.
  const staging = useStagedChanges()
  // Call guard to run this step.
  guard(staging)

  // Use useFetch to initialize { data: projects, refresh, status, }.
  const {
    data: projects,
    refresh,
    status,
  } = useFetch<ProjectRead[]>('/api/projects', {
    key: 'projects',
    query: computed(() => ({ semesterId: semesterId.value })),
    default: () => [],
  })

  // Use useAllPartners to initialize { data: allPartners }.
  const { data: allPartners } = useAllPartners()

  // Registers every project's teams and (flattened across those teams) memberships, so
  // ProjectTeamCard/ProjectRowExpansion never have to look up the fetched original themselves.
  watch(
    projects,
    (list) => {
      // Repeat the following steps for each item in list.
      for (const project of list) {
        // Call staging.children.register to run this step.
        staging.children.register(project.id, 'Teams', project.Teams ?? [], (t) => t.id)
        // Call staging.children.register to run this step.
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

  // ------------------------------------------------------------------- table

  const rows = computed<ProjectRow[]>(() =>
    projects.value.map((project) => ({
      ...project,
      meetingDay: semesterId.value
        ? (project.Teams.find((team) => team.semesterId === semesterId.value)?.meetingDay ?? null)
        : null,
    }))
  )

  // Recalculate columns when the values it reads change.
  const columns = computed<DataTableColumn<ProjectRow>[]>(() => {
    // Define base for the steps below.
    const base: DataTableColumn<ProjectRow>[] = [
      textColumn<ProjectRow>('name', 'Name', { required: true }),
      enumColumn<ProjectRow>('type', 'Type', PROJECT_TYPE_OPTIONS),
      enumColumn<ProjectRow>('status', 'Status', PROJECT_STATUS_OPTIONS),
      textColumn<ProjectRow>('repoURL', 'GitHub Link', { sortable: false }),
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
      }),
    ]

    // Check whether !semesterId.value before running this branch.
    if (!semesterId.value) return base

    // A proxy onto that semester's team; without one the cell stays read-only (§3.1.1).
    base.push({
      id: 'meetingDay',
      header: 'Meeting Day',
      accessorKey: 'meetingDay',
      sortable: true,
      format: (value) => dayLabel(value),
      editable: {
        type: 'select',
        options: MEETING_DAY_OPTIONS,
        child: (row) => {
          // Use row.Teams?.find to initialize team.
          const team = row.Teams?.find((t) => t.semesterId === semesterId.value)
          // Pass team ? { collection: 'Teams', id: team.id, field: 'meetingDay' } : undefined back to the caller.
          return team ? { collection: 'Teams', id: team.id, field: 'meetingDay' } : undefined
        },
      },
    })
    // Pass base back to the caller.
    return base
  })

  // Define the helper that will new row.
  function newRow() {
    // Pass { id: '', name: '', description: '', type: 'SOFTWARE', status: 'NEW', repoURL: '', partnerId: '', Pa back to the caller.
    return {
      id: '',
      name: '',
      description: '',
      type: 'SOFTWARE',
      status: 'NEW',
      repoURL: '',
      partnerId: '',
      Partner: null,
      Teams: [],
    }
  }

  // -------------------------------------------------------------------- save

  function teamIdOfMembership(projectId: string, membershipId: string) {
    // Use projects.value.find to initialize project.
    const project = projects.value.find((p) => p.id === projectId)
    // Repeat the following steps for each item in project?.Teams ?? [].
    for (const team of project?.Teams ?? []) {
      // Check whether team.Memberships.some((m) => m.id === membershipId) before running this branch.
      if (team.Memberships.some((m) => m.id === membershipId)) return team.id
    }
    // Pass undefined back to the caller.
    return undefined
  }

  // Define the helper that will create project.
  async function createProject(record: StagedRecord) {
    // Use (record.children.Teams ?? []).filter to initialize teams.
    const teams = (record.children.Teams ?? []).filter((team) => !team.deleted)
    // Define members for the steps below.
    const members = record.children.Memberships ?? []
    await $fetch('/api/projects', {
      method: 'POST',
      body: {
        name: record.fields.name,
        description: record.fields.description ?? '',
        type: record.fields.type,
        status: record.fields.status,
        repoURL: record.fields.repoURL ?? '',
        partnerId: record.fields.partnerId,
        Teams: teams.map((team) => ({
          semesterId: team.fields.semesterId,
          meetingDay: team.fields.meetingDay,
          Memberships: members
            .filter((m) => m.isNew && !m.deleted && m.fields.teamId === team.id)
            .map((m) => ({ studentId: m.fields.studentId, isMentor: !!m.fields.isMentor })),
        })),
      },
    })
  }

  // Define the helper that will update project.
  async function updateProject(record: StagedRecord) {
    // Check whether Object.keys(record.fields).length before running this branch.
    if (Object.keys(record.fields).length) {
      await $fetch(`/api/projects/${record.id}`, { method: 'PUT', body: record.fields })
    }

    // Teams first: a staged membership may point at a team that does not exist yet.
    const createdTeamIds = new Map<string, string>()
    // Define deletedTeamIds for the steps below.
    const deletedTeamIds = new Set<string>()
    // Repeat the following steps for each item in record.children.Teams ?? [].
    for (const team of record.children.Teams ?? []) {
      // Check whether team.isNew before running this branch.
      if (team.isNew) {
        // Define created for the steps below.
        const created = await $fetch<TeamRead>('/api/teams', {
          method: 'POST',
          body: {
            projectId: record.id,
            semesterId: team.fields.semesterId,
            meetingDay: team.fields.meetingDay,
          },
        })
        // Call createdTeamIds.set to run this step.
        createdTeamIds.set(team.id, created.id)
      } else if (team.deleted) {
        // Call deletedTeamIds.add to run this step.
        deletedTeamIds.add(team.id)
        await $fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
      } else if (Object.keys(team.fields).length) {
        await $fetch(`/api/teams/${team.id}`, { method: 'PUT', body: team.fields })
      }
    }

    // Repeat the following steps for each item in record.children.Memberships ?? [].
    for (const member of record.children.Memberships ?? []) {
      // Check whether member.isNew before running this branch.
      if (member.isNew) {
        // Define teamId for the steps below.
        const teamId = createdTeamIds.get(member.fields.teamId) ?? member.fields.teamId
        // A membership staged onto a team that was then deleted has nowhere to go.
        if (deletedTeamIds.has(teamId)) continue
        await $fetch('/api/memberships', {
          method: 'POST',
          body: {
            teamId,
            studentId: member.fields.studentId,
            isMentor: !!member.fields.isMentor,
          },
        })
      } else if (member.deleted) {
        // Deleting the team already cascaded this membership away.
        const teamId = teamIdOfMembership(record.id, member.id)
        // Check whether teamId && deletedTeamIds.has(teamId) before running this branch.
        if (teamId && deletedTeamIds.has(teamId)) continue
        await $fetch(`/api/memberships/${member.id}`, { method: 'DELETE' })
      }
    }
  }

  // Define the helper that will delete project.
  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
  }

  // Use useStagedSave to initialize { saving, onSave }.
  const { saving, onSave } = useStagedSave({
    staging,
    entity: 'project',
    cascade: 'This will also delete all associated teams and choices.',
    affected: (ids) => {
      // Use projects.value.filter to initialize selected.
      const selected = projects.value.filter((p) => ids.includes(p.id))
      // Pass [{ label: 'Team', count: selected.reduce((n, p) => n + p.Teams.length, 0) }] back to the caller.
      return [{ label: 'Team', count: selected.reduce((n, p) => n + p.Teams.length, 0) }]
    },
    refresh,
    create: createProject,
    update: updateProject,
    delete: deleteProject,
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
      <ProjectRowExpansion :row-id="rowId" :row="row" :disabled="deleted" />
    </template>
  </DataTable>
</template>
