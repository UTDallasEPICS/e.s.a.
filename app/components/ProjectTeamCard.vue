<script setup lang="ts">
  /**
   * Purpose
   * Render the project team card part of the ESA interface.
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
  import { ACTION_ICONS } from '~/utils/icons'
  import type { MergedChild } from '~/composables/useStagedChanges'
  import { studentLabel, formatSemester, semesterOrder } from '~/utils/labels'
  import { GENDER_OPTIONS, YEAR_OPTIONS, CLASS_OPTIONS, type SelectOption } from '~/utils/options'
  import type { MembershipRead } from '#server/services/membershipService'
  import type { ProjectRead } from '#server/services/projectService'
  import type { TeamRead } from '#server/services/teamService'
  import type { EnrollmentRead } from '#server/services/enrollmentService'

  type TeamLike = Partial<TeamRead> & { semesterId: string; meetingDay: TeamRead['meetingDay'] }
  type MemberLike = Partial<MembershipRead> & {
    teamId: string
    studentId: string
    isMentor: boolean
  }

  // Use defineProps to initialize props.
  const props = defineProps<{
    rowId: string
    row: ProjectRead
    card: MergedChild<TeamLike>
    /** The project row itself is marked for deletion. */
    disabled?: boolean
  }>()

  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    'add-member': [teamId: string, isMentor: boolean]
    'move-member': [member: MergedChild<MemberLike>]
  }>()

  // Use useRowStaging to initialize { staging, saving }.
  const { staging, saving } = useRowStaging()
  // Use useAllStudents to initialize { data: allStudents }.
  const { data: allStudents } = useAllStudents()

  // Define roles for the steps below.
  const roles = [
    { plural: 'Mentors', singular: 'Mentor', isMentor: true },
    { plural: 'Students', singular: 'Student', isMentor: false },
  ]

  // Define the helper that will member label.
  function memberLabel(member: MemberLike) {
    // Define student for the steps below.
    const student = member.Student ?? allStudents.value.find((s) => s.id === member.studentId)
    // Pass student ? studentLabel(student) : 'Unknown student' back to the caller.
    return student ? studentLabel(student) : 'Unknown student'
  }

  // Define the helper that will option label.
  function optionLabel(options: SelectOption[], value?: string) {
    // Pass options.find((o) => o.value === value)?.label ?? value ?? '—' back to the caller.
    return options.find((o) => o.value === value)?.label ?? value ?? '—'
  }

  /**
   * The enrollment/skills/comments/prior-team context relevant to assigning a student, resolved
   * from the full student directory (membership rows only carry a trimmed-down Student). Enrollment
   * is matched to this team's semester; prior projects are every other team the student has ever
   * belonged to, most recent semester first.
   */
  function memberDetails(member: MemberLike) {
    // Use allStudents.value.find to initialize student.
    const student = allStudents.value.find((s) => s.id === member.studentId)
    // Use student?.Enrollments.find to initialize enrollment.
    const enrollment: EnrollmentRead | undefined = student?.Enrollments.find(
      (e) => e.semesterId === props.card.record.semesterId
    )
    // Use (student?.Memberships ?? []) .filter((m) => m.teamId !== props.card.id) .sort((a, b) => semesterOrde to initialize previousProjects.
    const previousProjects = (student?.Memberships ?? [])
      .filter((m) => m.teamId !== props.card.id)
      .sort((a, b) => semesterOrder(b.Team.Semester) - semesterOrder(a.Team.Semester))
      .map((m) => `${m.Team.Project.name} (${formatSemester(m.Team.Semester)})`)
    // Pass { enrollment, previousProjects, hasMore: !!enrollment?.skills.length || !!enrollment?.comments || pr back to the caller.
    return {
      enrollment,
      previousProjects,
      hasMore: !!enrollment?.skills.length || !!enrollment?.comments || previousProjects.length > 0,
    }
  }

  /** Memberships are staged flat on the project row and grouped by team id for display. */
  function teamMembers(isMentor: boolean) {
    // Pass staging.children .merge<MemberLike>(props.rowId, 'Memberships') .filter( (member) => member.record.t back to the caller.
    return staging.children
      .merge<MemberLike>(props.rowId, 'Memberships')
      .filter(
        (member) => member.record.teamId === props.card.id && !!member.record.isMentor === isMentor
      )
      .map((member) => ({ ...member, details: memberDetails(member.record) }))
  }
</script>

<template>
  <div class="space-y-3">
    <div class="flex gap-1">
      <UButton
        v-if="card.state === 'clean' || card.state === 'edited'"
        label="Delete Team"
        :icon="ACTION_ICONS.delete"
        size="xs"
        color="error"
        variant="ghost"
        :disabled="disabled || saving"
        @click="staging.children.markDeleted(rowId, 'Teams', card.id)"
      />
      <UButton
        v-if="card.state !== 'clean'"
        label="Undo"
        :icon="ACTION_ICONS.undo"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="saving"
        @click="staging.children.undo(rowId, 'Teams', card.id)"
      />
    </div>

    <div v-for="role in roles" :key="role.plural" class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-gray-500">{{ role.plural }}</span>
        <UButton
          :label="`Add ${role.singular}`"
          :icon="ACTION_ICONS.add"
          size="xs"
          variant="ghost"
          :disabled="disabled || card.deleted || saving"
          @click="emit('add-member', card.id, role.isMentor)"
        />
      </div>
      <ul class="space-y-1">
        <li
          v-for="member in teamMembers(role.isMentor)"
          :key="member.id"
          class="rounded border border-gray-200 p-2 text-sm dark:border-gray-800"
          :class="STAGE_TINTS[member.state]"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span>{{ memberLabel(member.record) }}</span>
              <template v-if="member.details.enrollment">
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ member.details.enrollment.major }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ optionLabel(YEAR_OPTIONS, member.details.enrollment.year) }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ optionLabel(CLASS_OPTIONS, member.details.enrollment.class) }}
                </UBadge>
                <UBadge color="neutral" variant="subtle" size="sm">
                  {{ optionLabel(GENDER_OPTIONS, member.details.enrollment.gender) }}
                </UBadge>
              </template>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                v-if="!member.deleted && !member.record.isMentor"
                label="Move"
                :icon="ACTION_ICONS.move"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="disabled || card.deleted || saving"
                @click="emit('move-member', member)"
              />
              <UButton
                v-if="!member.isNew && !member.deleted"
                label="Remove"
                :icon="ACTION_ICONS.delete"
                size="xs"
                color="error"
                variant="ghost"
                :disabled="disabled || card.deleted || saving"
                @click="staging.children.markDeleted(rowId, 'Memberships', member.id)"
              />
              <UButton
                v-if="member.state !== 'clean'"
                label="Undo"
                :icon="ACTION_ICONS.undo"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="saving"
                @click="staging.children.undo(rowId, 'Memberships', member.id)"
              />
            </div>
          </div>

          <UCollapsible v-if="member.details.hasMore" class="mt-1">
            <UButton
              label="More details"
              trailing-icon="i-lucide-chevron-down"
              size="xs"
              color="neutral"
              variant="link"
              class="px-0"
            />
            <template #content>
              <dl
                class="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-2"
              >
                <div v-if="member.details.enrollment?.skills.length">
                  <dt class="font-medium text-gray-400">Skills</dt>
                  <dd>{{ member.details.enrollment.skills.join(', ') }}</dd>
                </div>
                <div v-if="member.details.enrollment?.comments" class="sm:col-span-2">
                  <dt class="font-medium text-gray-400">Comments</dt>
                  <dd>{{ member.details.enrollment.comments }}</dd>
                </div>
                <div v-if="member.details.previousProjects.length" class="sm:col-span-2">
                  <dt class="font-medium text-gray-400">Previous Projects</dt>
                  <dd>{{ member.details.previousProjects.join('; ') }}</dd>
                </div>
              </dl>
            </template>
          </UCollapsible>
        </li>
        <li v-if="!teamMembers(role.isMentor).length" class="text-xs text-gray-500">None</li>
      </ul>
    </div>
  </div>
</template>
