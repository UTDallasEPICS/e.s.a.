<script setup lang="ts">
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

  const { semesterId, guard } = useSemesterFilter()

  const staging = useStagedChanges()
  guard(staging)

  const {
    data: projects,
    refresh,
    status,
  } = useFetch<ProjectRead[]>('/api/projects', {
    key: 'projects',
    query: computed(() => ({ semesterId: semesterId.value })),
    default: () => [],
  })

  const { data: allPartners } = useAllPartners()

  // Registers every project's teams and (flattened across those teams) memberships, so
  // ProjectTeamCard/ProjectRowExpansion never have to look up the fetched original themselves.
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

  // ------------------------------------------------------------------- table

  const rows = computed<ProjectRow[]>(() =>
    projects.value.map((project) => ({
      ...project,
      meetingDay: semesterId.value
        ? (project.Teams.find((team) => team.semesterId === semesterId.value)?.meetingDay ?? null)
        : null,
    }))
  )

  const columns = computed<DataTableColumn<ProjectRow>[]>(() => {
    const base: DataTableColumn<ProjectRow>[] = [
      textColumn<ProjectRow>('name', 'Name', { required: true }),
      enumColumn<ProjectRow>('type', 'Type', PROJECT_TYPE_OPTIONS),
      enumColumn<ProjectRow>('status', 'Status', PROJECT_STATUS_OPTIONS),
      textColumn<ProjectRow>('repoURL', 'GitHub Link', { sortable: false }),
      textColumn<ProjectRow>('skills', 'Skills (tie-break)', { sortable: false }),
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
          const team = row.Teams?.find((t) => t.semesterId === semesterId.value)
          return team ? { collection: 'Teams', id: team.id, field: 'meetingDay' } : undefined
        },
      },
    })
    return base
  })

  function newRow() {
    return {
      id: '',
      name: '',
      description: '',
      type: 'SOFTWARE',
      status: 'NEW',
      repoURL: '',
      skills: '',
      partnerId: '',
      Partner: null,
      Teams: [],
    }
  }

  // -------------------------------------------------------------------- save

  function teamIdOfMembership(projectId: string, membershipId: string) {
    const project = projects.value.find((p) => p.id === projectId)
    for (const team of project?.Teams ?? []) {
      if (team.Memberships.some((m) => m.id === membershipId)) return team.id
    }
    return undefined
  }

  async function createProject(record: StagedRecord) {
    const teams = (record.children.Teams ?? []).filter((team) => !team.deleted)
    const members = record.children.Memberships ?? []
    await $fetch('/api/projects', {
      method: 'POST',
      body: {
        name: record.fields.name,
        description: record.fields.description ?? '',
        type: record.fields.type,
        status: record.fields.status,
        repoURL: record.fields.repoURL ?? '',
        skills: record.fields.skills ?? '',
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

  async function updateProject(record: StagedRecord) {
    if (Object.keys(record.fields).length) {
      await $fetch(`/api/projects/${record.id}`, { method: 'PUT', body: record.fields })
    }

    // Teams first: a staged membership may point at a team that does not exist yet.
    const createdTeamIds = new Map<string, string>()
    const deletedTeamIds = new Set<string>()
    for (const team of record.children.Teams ?? []) {
      if (team.isNew) {
        const created = await $fetch<TeamRead>('/api/teams', {
          method: 'POST',
          body: {
            projectId: record.id,
            semesterId: team.fields.semesterId,
            meetingDay: team.fields.meetingDay,
          },
        })
        createdTeamIds.set(team.id, created.id)
      } else if (team.deleted) {
        deletedTeamIds.add(team.id)
        await $fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
      } else if (Object.keys(team.fields).length) {
        await $fetch(`/api/teams/${team.id}`, { method: 'PUT', body: team.fields })
      }
    }

    for (const member of record.children.Memberships ?? []) {
      if (member.isNew) {
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
        if (teamId && deletedTeamIds.has(teamId)) continue
        await $fetch(`/api/memberships/${member.id}`, { method: 'DELETE' })
      }
    }
  }

  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
  }

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
