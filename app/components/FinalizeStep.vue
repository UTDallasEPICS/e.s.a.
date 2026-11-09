<script setup lang="ts">
  import { downloadCsv } from '~/utils/csvExport'

  // Step 4. A read-only sign-off screen for one meeting day: is every student placed, are the teams
  // the right size, how did students do on their picks, and what should staff look at before
  // calling the teams final. Data comes from GET /api/team-formation/finalize-summary. The only
  // things that change anything are the Make final / Not final buttons, and those go through the
  // page's existing version logic (the events below), so nothing here can disagree with Manage Teams.

  type MeetingDay = 'WEDNESDAY' | 'THURSDAY'
  type CheckStatus = 'pass' | 'warn' | 'fail'

  interface Summary {
    day: MeetingDay
    minTeamSize: number
    maxTeamSize: number
    min3200: number
    totals: {
      students: number
      placed: number
      unplaced: number
      teams: number
      projects: number
      avgTeamSize: number
      with3200: number
      mentored: number
    }
    distribution: {
      first: number
      second: number
      third: number
      fourthOrLower: number
      noBid: number
      bidders: number
      firstPct: number
      topTwoPct: number
      topThreePct: number
    }
    checks: { id: string; label: string; status: CheckStatus; detail: string }[]
    teams: {
      teamId: string
      projectName: string
      partnerName: string
      size: number
      count3200: number
      mentors: string[]
      firstPicks: number
      gotTop3: number
      locked: boolean
      warnings: string[]
    }[]
    unplaced: { studentId: string; name: string; className: string; firstChoice: string | null; hasBid: boolean }[]
    attention: {
      studentId: string
      name: string
      className: string
      placedAt: string
      pickLabel: string
      firstChoice: string | null
    }[]
  }

  const props = defineProps<{
    semesterId?: string | null
    semesterName: string
    minTeamSize: number
    maxTeamSize: number
    min3200: number
    boardVersion: number
    boardIsSaved: boolean
    boardIsFinal: boolean
    busy?: boolean
    versionError?: string | null
  }>()
  const day = defineModel<MeetingDay>('day', { default: 'WEDNESDAY' })
  const emit = defineEmits<{
    'make-final': []
    'undo-final': []
    'export-teams': []
    'go-manage': []
  }>()

  const toast = useToast()
  const dayLabel = computed(() => (day.value === 'WEDNESDAY' ? 'Wednesday' : 'Thursday'))

  const { data, status, error, refresh } = useFetch<Summary>('/api/team-formation/finalize-summary', {
    query: computed(() => ({
      semesterId: props.semesterId,
      day: day.value,
      minTeamSize: props.minTeamSize,
      maxTeamSize: props.maxTeamSize,
      min3200: props.min3200,
    })),
    server: false,
    default: () => null as unknown as Summary,
  })
  // The board changes when a version is made final or undone, so read it again.
  watch(() => [props.boardIsFinal, props.boardVersion], () => refresh())

  const loading = computed(() => status.value === 'pending' && !data.value)

  // ── Readiness ────────────────────────────────────────────────────────────────
  // The server's content checks plus two about the saved version, which the page owns.
  const allChecks = computed(() => {
    if (!data.value) return []
    return [
      ...data.value.checks,
      {
        id: 'saved',
        label: 'Saved as a version',
        status: (props.boardIsSaved ? 'pass' : 'warn') as CheckStatus,
        detail: props.boardIsSaved
          ? `The board is saved as Version ${props.boardVersion}.`
          : `The board has changes that aren't saved. Making it final saves it as Version ${props.boardVersion}.`,
      },
      {
        id: 'final',
        label: 'Marked final',
        status: (props.boardIsFinal ? 'pass' : 'warn') as CheckStatus,
        detail: props.boardIsFinal
          ? `Version ${props.boardVersion} is the final teams for ${dayLabel.value}.`
          : 'Not final yet. Use Make final below when you are happy.',
      },
    ]
  })
  const failCount = computed(() => allChecks.value.filter((c) => c.status === 'fail').length)
  const warnCount = computed(() => allChecks.value.filter((c) => c.status === 'warn').length)
  const passCount = computed(() => allChecks.value.filter((c) => c.status === 'pass').length)
  const progress = computed(() =>
    allChecks.value.length ? Math.round((passCount.value / allChecks.value.length) * 100) : 0
  )

  const banner = computed(() => {
    if (props.boardIsFinal && !failCount.value)
      return {
        tone: 'green',
        icon: 'i-heroicons-check-badge',
        title: `Final: Version ${props.boardVersion}`,
        text: `${dayLabel.value}'s teams are locked in and ready to export.`,
      }
    if (failCount.value)
      return {
        tone: 'red',
        icon: 'i-heroicons-exclamation-triangle',
        title: `${failCount.value} thing${failCount.value === 1 ? '' : 's'} to fix first`,
        text: 'Fix the red items in Manage Teams, then come back. You can still export a draft.',
      }
    return {
      tone: 'amber',
      icon: 'i-heroicons-flag',
      title: 'Ready to finalize',
      text: warnCount.value
        ? `No blockers. ${warnCount.value} item${warnCount.value === 1 ? '' : 's'} worth a look, then make it final.`
        : 'Everything checks out. Make it final when you are ready.',
    }
  })

  const toneClasses: Record<string, string> = {
    green: 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    red: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
  }
  const statusIcon: Record<CheckStatus, { name: string; cls: string }> = {
    pass: { name: 'i-heroicons-check-circle', cls: 'text-green-500' },
    warn: { name: 'i-heroicons-exclamation-circle', cls: 'text-amber-500' },
    fail: { name: 'i-heroicons-x-circle', cls: 'text-red-500' },
  }

  // ── Pick distribution bar ────────────────────────────────────────────────────
  const segments = computed(() => {
    const d = data.value?.distribution
    if (!d) return []
    const total = d.first + d.second + d.third + d.fourthOrLower + d.noBid
    const seg = (label: string, n: number, cls: string) => ({
      label,
      n,
      cls,
      width: total ? (n / total) * 100 : 0,
    })
    return [
      seg('1st pick', d.first, 'bg-green-500'),
      seg('2nd pick', d.second, 'bg-sky-500'),
      seg('3rd pick', d.third, 'bg-amber-400'),
      seg('4th or lower', d.fourthOrLower, 'bg-red-400'),
      seg('No bid', d.noBid, 'bg-gray-400'),
    ]
  })

  // ── Team table ───────────────────────────────────────────────────────────────
  const teamFilter = ref<'all' | 'attention'>('all')
  const shownTeams = computed(() => {
    const teams = (data.value?.teams ?? []).filter((t) => t.size > 0)
    return teamFilter.value === 'attention' ? teams.filter((t) => t.warnings.length) : teams
  })
  const teamsWithWarnings = computed(
    () => (data.value?.teams ?? []).filter((t) => t.size > 0 && t.warnings.length).length
  )
  const emptyProjects = computed(() => (data.value?.teams ?? []).filter((t) => t.size === 0).length)

  // ── Exports ──────────────────────────────────────────────────────────────────
  function summaryText() {
    const d = data.value
    if (!d) return ''
    const lines = [
      `${props.semesterName} · ${dayLabel.value} teams · Version ${props.boardVersion}${props.boardIsFinal ? ' (final)' : ' (draft)'}`,
      '',
      `${d.totals.placed} of ${d.totals.students} students placed on ${d.totals.teams} teams (average ${d.totals.avgTeamSize} per team).`,
      `${d.distribution.topThreePct}% of students with a bid got one of their top three picks (${d.distribution.firstPct}% got their first).`,
      `${d.totals.with3200} of ${d.totals.teams} teams have a 3200 student; ${d.totals.mentored} have a mentor.`,
    ]
    if (d.totals.unplaced) lines.push(`${d.totals.unplaced} student(s) are not on a team yet.`)
    if (d.attention.length) lines.push(`${d.attention.length} student(s) are not on a top-3 pick.`)
    lines.push('', 'Checks:')
    for (const c of allChecks.value) {
      lines.push(`${c.status === 'pass' ? '[x]' : c.status === 'warn' ? '[~]' : '[ ]'} ${c.label}: ${c.detail}`)
    }
    return lines.join('\n')
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText())
      toast.add({ title: 'Summary copied', description: 'Paste it into an email or message.', color: 'success' })
    } catch {
      toast.add({ title: "Couldn't copy", description: 'Your browser blocked clipboard access.', color: 'error' })
    }
  }

  function downloadSummaryCsv() {
    const d = data.value
    if (!d) return
    const rows: string[][] = [
      ['Project', 'Partner', 'Students', '3200 students', 'Got top-3 pick', 'Got 1st pick', 'Mentors', 'Locked', 'Warnings'],
      ...d.teams
        .filter((t) => t.size > 0)
        .map((t) => [
          t.projectName,
          t.partnerName,
          String(t.size),
          String(t.count3200),
          String(t.gotTop3),
          String(t.firstPicks),
          t.mentors.join('; '),
          t.locked ? 'Yes' : 'No',
          t.warnings.join('; '),
        ]),
    ]
    downloadCsv(`${dayLabel.value} Team Summary - ${props.semesterName}${props.boardIsFinal ? '' : ' (draft)'}.csv`, rows)
  }

  function printPage() {
    window.print()
  }
</script>

<template>
  <section class="space-y-6">
    <!-- Title + day switch -->
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="flex items-center gap-1.5 text-lg font-semibold">
        4. Finalize
        <InfoTip
          text="A last check before the teams go out: who is placed, how teams look, and how students did on their picks. Nothing here changes a team except Make final."
        />
      </h2>
      <span class="text-sm text-gray-500">{{ semesterName }}</span>
      <div class="ms-auto flex items-center gap-1 rounded-lg bg-gray-100 p-1 print:hidden dark:bg-gray-800/60">
        <UButton
          v-for="opt in [
            { label: 'Wednesday', value: 'WEDNESDAY' },
            { label: 'Thursday', value: 'THURSDAY' },
          ]"
          :key="opt.value"
          :label="opt.label"
          size="sm"
          :color="day === opt.value ? 'primary' : 'neutral'"
          :variant="day === opt.value ? 'solid' : 'ghost'"
          :aria-pressed="day === opt.value"
          @click="day = opt.value as MeetingDay"
        />
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">Reading the board…</div>
    <div v-else-if="error" class="rounded-lg border border-red-500/40 p-4 text-sm text-red-500">
      {{ error.data?.message ?? error.message ?? 'Could not load the summary.' }}
    </div>
    <div
      v-else-if="data && !data.totals.students"
      class="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700"
    >
      No students are enrolled on {{ dayLabel }} for this semester. Try the other day, or upload that day's bid file.
    </div>

    <template v-else-if="data">
      <!-- Status banner -->
      <div :class="['flex flex-wrap items-center gap-4 rounded-xl border p-5', toneClasses[banner.tone]]">
        <UIcon :name="banner.icon" class="size-10 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-lg font-semibold leading-tight">{{ banner.title }}</p>
          <p class="text-sm opacity-90">{{ banner.text }}</p>
        </div>
        <div class="w-full sm:w-56">
          <div class="mb-1 flex justify-between text-xs font-medium">
            <span>{{ passCount }} of {{ allChecks.length }} checks passed</span>
            <span>{{ progress }}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div class="h-full rounded-full bg-current transition-all duration-500" :style="{ width: `${progress}%` }" />
          </div>
        </div>
      </div>

      <!-- Headline numbers -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Students placed</p>
          <p class="mt-1 text-3xl font-bold">
            {{ data.totals.placed }}<span class="text-lg font-normal text-gray-400"> / {{ data.totals.students }}</span>
          </p>
          <p class="text-xs text-gray-500">
            {{ data.totals.unplaced ? `${data.totals.unplaced} without a team` : 'everyone has a team' }}
          </p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Got a top-3 pick</p>
          <p class="mt-1 text-3xl font-bold">{{ data.distribution.topThreePct }}%</p>
          <p class="text-xs text-gray-500">of {{ data.distribution.bidders }} students who bid</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Got their 1st pick</p>
          <p class="mt-1 text-3xl font-bold">{{ data.distribution.firstPct }}%</p>
          <p class="text-xs text-gray-500">{{ data.distribution.topTwoPct }}% got a top-2 pick</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Teams</p>
          <p class="mt-1 text-3xl font-bold">{{ data.totals.teams }}</p>
          <p class="text-xs text-gray-500">
            {{ data.totals.avgTeamSize }} students each on average · {{ data.totals.with3200 }} with a 3200
          </p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Checklist -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-800">Readiness checklist</h3>
          <ul class="divide-y divide-gray-200 dark:divide-gray-800">
            <li v-for="c in allChecks" :key="c.id" class="flex items-start gap-3 px-4 py-3">
              <UIcon :name="statusIcon[c.status].name" :class="['mt-0.5 size-5 shrink-0', statusIcon[c.status].cls]" />
              <div class="min-w-0">
                <p class="text-sm font-medium">{{ c.label }}</p>
                <p class="text-xs text-gray-500">{{ c.detail }}</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- Pick distribution -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-800">
            How students did on their picks
          </h3>
          <div class="space-y-4 p-4">
            <div class="flex h-6 w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800" role="img"
              :aria-label="segments.map((s) => `${s.label}: ${s.n}`).join(', ')">
              <div
                v-for="s in segments"
                :key="s.label"
                :class="[s.cls, 'h-full transition-all duration-500']"
                :style="{ width: `${s.width}%` }"
                :title="`${s.label}: ${s.n}`"
              />
            </div>
            <ul class="space-y-2 text-sm">
              <li v-for="s in segments" :key="s.label" class="flex items-center gap-2">
                <span :class="['size-3 rounded-sm', s.cls]" />
                <span class="flex-1">{{ s.label }}</span>
                <span class="font-medium tabular-nums">{{ s.n }}</span>
                <span class="w-12 text-right text-xs tabular-nums text-gray-500">
                  {{ Math.round(s.width) }}%
                </span>
              </li>
            </ul>
            <p class="text-xs text-gray-500">
              "No bid" students didn't submit picks and were placed by the importer, so they aren't counted
              in the percentages above.
            </p>
          </div>
        </div>
      </div>

      <!-- Teams table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-800">
        <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h3 class="me-auto text-sm font-semibold">
            Teams
            <span class="font-normal text-gray-500">· {{ data.totals.teams }}</span>
          </h3>
          <UButton
            :label="`All (${data.totals.teams})`"
            size="xs"
            :color="teamFilter === 'all' ? 'primary' : 'neutral'"
            :variant="teamFilter === 'all' ? 'solid' : 'soft'"
            class="print:hidden"
            @click="teamFilter = 'all'"
          />
          <UButton
            :label="`Needs a look (${teamsWithWarnings})`"
            size="xs"
            :color="teamFilter === 'attention' ? 'primary' : 'neutral'"
            :variant="teamFilter === 'attention' ? 'solid' : 'soft'"
            class="print:hidden"
            @click="teamFilter = 'attention'"
          />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th class="px-4 py-2">Project</th>
                <th class="px-2 py-2 text-center">Students</th>
                <th class="px-2 py-2 text-center">3200s</th>
                <th class="px-2 py-2 text-center">Top-3 picks</th>
                <th class="px-2 py-2">Mentor</th>
                <th class="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
              <tr v-for="t in shownTeams" :key="t.teamId">
                <td class="px-4 py-2">
                  <p class="font-medium">{{ t.projectName }}</p>
                  <p class="text-xs text-gray-500">{{ t.partnerName }}</p>
                </td>
                <td class="px-2 py-2 text-center tabular-nums">{{ t.size }}</td>
                <td class="px-2 py-2 text-center tabular-nums">{{ t.count3200 }}</td>
                <td class="px-2 py-2 text-center tabular-nums">{{ t.gotTop3 }}/{{ t.size }}</td>
                <td class="px-2 py-2 text-gray-500">{{ t.mentors.join(', ') || '—' }}</td>
                <td class="px-2 py-2">
                  <div class="flex flex-wrap items-center gap-1">
                    <UBadge v-if="t.locked" color="success" variant="subtle" icon="i-heroicons-lock-closed" size="sm">
                      Locked
                    </UBadge>
                    <UBadge v-for="w in t.warnings" :key="w" color="warning" variant="subtle" size="sm">{{ w }}</UBadge>
                    <span v-if="!t.locked && !t.warnings.length" class="text-xs text-gray-400">Not locked</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!shownTeams.length">
                <td colspan="6" class="px-4 py-6 text-center text-sm text-gray-500">
                  {{ teamFilter === 'attention' ? 'No team needs a look.' : 'No team has students yet.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="emptyProjects" class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-800">
          {{ emptyProjects }} project{{ emptyProjects === 1 ? ' has' : 's have' }} no students and
          {{ emptyProjects === 1 ? "isn't" : "aren't" }} listed.
        </p>
      </div>

      <!-- Needs attention -->
      <div v-if="data.unplaced.length || data.attention.length" class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-800">
            No team yet
            <span class="font-normal text-gray-500">· {{ data.unplaced.length }}</span>
          </h3>
          <p v-if="!data.unplaced.length" class="px-4 py-5 text-sm text-gray-500">Everyone has a team.</p>
          <ul v-else class="max-h-72 divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800">
            <li v-for="s in data.unplaced" :key="s.studentId" class="flex items-center gap-2 px-4 py-2 text-sm">
              <span class="flex-1 font-medium">{{ s.name }}</span>
              <UBadge color="neutral" variant="subtle" size="sm">{{ s.className }}</UBadge>
              <span v-if="s.firstChoice" class="max-w-44 truncate text-xs text-gray-500" :title="s.firstChoice">
                wanted {{ s.firstChoice }}
              </span>
              <span v-else class="text-xs text-amber-500">No bid</span>
            </li>
          </ul>
        </div>

        <div class="rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 class="border-b border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-800">
            Not on a top-3 pick
            <span class="font-normal text-gray-500">· {{ data.attention.length }}</span>
          </h3>
          <p v-if="!data.attention.length" class="px-4 py-5 text-sm text-gray-500">
            Everyone with a bid got one of their top three.
          </p>
          <ul v-else class="max-h-72 divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800">
            <li v-for="s in data.attention" :key="s.studentId" class="px-4 py-2 text-sm">
              <div class="flex items-center gap-2">
                <span class="flex-1 font-medium">{{ s.name }}</span>
                <UBadge color="neutral" variant="subtle" size="sm">{{ s.className }}</UBadge>
              </div>
              <p class="text-xs text-gray-500">
                On {{ s.placedAt }} ({{ s.pickLabel }}){{ s.firstChoice ? `, wanted ${s.firstChoice}` : '' }}
              </p>
            </li>
          </ul>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3 rounded-xl border border-gray-200 p-4 print:hidden dark:border-gray-800">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="!boardIsFinal"
            :label="`Make Version ${boardVersion} final`"
            icon="i-heroicons-check-badge"
            color="success"
            size="lg"
            :loading="busy"
            :disabled="busy || !data.totals.placed"
            @click="emit('make-final')"
          />
          <UButton
            v-else
            label="Not final"
            icon="i-heroicons-arrow-uturn-left"
            color="neutral"
            variant="soft"
            size="lg"
            :loading="busy"
            @click="emit('undo-final')"
          />
          <UButton
            label="Back to Manage Teams"
            icon="i-heroicons-arrow-left"
            color="neutral"
            variant="ghost"
            @click="emit('go-manage')"
          />
          <span class="ms-auto text-xs text-gray-500">
            {{ boardIsFinal ? 'Final teams are locked. Not final puts the earlier locks back.' : 'Making it final locks every team.' }}
          </span>
        </div>
        <p v-if="versionError" class="text-sm text-red-500">{{ versionError }}</p>
        <div class="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
          <span class="me-2 text-xs font-medium uppercase tracking-wide text-gray-500">Share</span>
          <UButton
            label="Export teams (CSV)"
            icon="i-heroicons-arrow-down-tray"
            color="neutral"
            variant="soft"
            @click="emit('export-teams')"
          />
          <UButton
            label="Team summary (CSV)"
            icon="i-heroicons-table-cells"
            color="neutral"
            variant="soft"
            @click="downloadSummaryCsv"
          />
          <UButton
            label="Copy summary"
            icon="i-heroicons-clipboard-document"
            color="neutral"
            variant="soft"
            @click="copySummary"
          />
          <UButton
            label="Print"
            icon="i-heroicons-printer"
            color="neutral"
            variant="soft"
            @click="printPage"
          />
        </div>
      </div>
    </template>
  </section>
</template>
