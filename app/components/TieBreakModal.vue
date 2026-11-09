<script setup lang="ts">
  import { downloadCsv } from '~/utils/csvExport'

  // Read-only report: who is competing for each over-subscribed project, in what order the
  // tie-break rules put them (choice position, 3200 before 2200, 3200 experience, semesters,
  // skill fit), and where the board actually placed them. Also lists students on no team yet.
  // Data comes from GET /api/team-formation/tie-breaks. Nothing here changes any team.

  interface Candidate {
    studentId: string
    name: string
    className: string
    position: number
    prior3200Semesters: number
    priorSemesters: number
    skills: string
    skillFit: number | null
    placedHere: boolean
    placedAt: string | null
    locked: boolean
    why: string | null
  }
  interface Contested {
    projectId: string
    projectName: string
    projectSkills: string
    seats: number
    wanting: Candidate[]
  }
  interface Unplaced {
    studentId: string
    name: string
    className: string
    topChoice: string | null
    hasBid: boolean
    skills: string
  }
  interface Report {
    topN: number
    maxTeamSize: number
    skillSource?: 'tfidf' | 'gemini'
    skillNote?: string | null
    contested: Contested[]
    unplaced: Unplaced[]
  }

  const props = defineProps<{
    semesterId?: string | null
    day: 'WEDNESDAY' | 'THURSDAY'
    maxTeamSize: number
    dayLabel?: string
    skillProvider?: 'tfidf' | 'gemini'
  }>()
  const open = defineModel<boolean>('open', { default: false })

  const report = ref<Report | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const topN = ref(3)
  const topNItems = [
    { label: 'Top 1 pick', value: 1 },
    { label: 'Top 2 picks', value: 2 },
    { label: 'Top 3 picks', value: 3 },
    { label: 'Top 4 picks', value: 4 },
  ]

  async function load() {
    if (!props.semesterId) return
    loading.value = true
    error.value = null
    try {
      report.value = await $fetch<Report>('/api/team-formation/tie-breaks', {
        query: {
          semesterId: props.semesterId,
          day: props.day,
          maxTeamSize: props.maxTeamSize,
          topN: topN.value,
          skillProvider: props.skillProvider ?? 'tfidf',
        },
      })
    } catch (e: any) {
      error.value = e?.data?.message ?? e?.message ?? 'Could not load the tie-break report.'
    } finally {
      loading.value = false
    }
  }

  // Reload every time it opens (the board may have changed) or the pick depth changes.
  watch([open, topN, () => props.skillProvider], () => {
    if (open.value) load()
  })

  const contestedCount = computed(() => report.value?.contested.length ?? 0)
  const unplacedCount = computed(() => report.value?.unplaced.length ?? 0)

  function fitText(c: Candidate) {
    return c.skillFit === null ? 'no skills' : c.skillFit.toFixed(2)
  }
  const usingGemini = computed(() => report.value?.skillSource === 'gemini')

  function exportCsv() {
    if (!report.value) return
    const rows: string[][] = [
      [
        'Project',
        'Seats',
        'Order',
        'Student',
        'Class',
        'Choice #',
        'Prior 3200 semesters',
        'Prior semesters',
        usingGemini.value ? 'Skill fit (Gemini)' : 'Skill fit',
        'On this project now',
        'Placed at',
        'Locked',
        'Why ahead of the next student',
      ],
    ]
    for (const project of report.value.contested) {
      project.wanting.forEach((c, i) =>
        rows.push([
          project.projectName,
          String(project.seats),
          String(i + 1),
          c.name,
          c.className,
          String(c.position),
          String(c.prior3200Semesters),
          String(c.priorSemesters),
          c.skillFit === null ? '' : c.skillFit.toFixed(2),
          c.placedHere ? 'Yes' : 'No',
          c.placedAt ?? '(no team)',
          c.locked ? 'Yes' : 'No',
          c.why ?? '',
        ])
      )
    }
    downloadCsv(`Tie-breaks - ${props.dayLabel ?? props.day}.csv`, rows)
  }
</script>

<template>
  <UModal
    v-model:open="open"
    description="Who is competing for each project, and why the tie-break order is what it is."
    :ui="{ content: 'sm:max-w-5xl', description: 'sr-only' }"
  >
    <template #title>
      <span class="flex items-center gap-1.5">
        Tie-breaks
        <InfoTip
          text="Students are ordered by the tie-break rules: higher pick, 3200 before 2200, done 3200 before, more semesters, then skill fit. Nothing here changes any team."
        />
      </span>
    </template>

    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <USelect v-model="topN" :items="topNItems" class="w-40" aria-label="How many picks to count" />
          <span class="text-sm text-gray-500">
            A project is contested when more than {{ maxTeamSize }} students ranked it that high.
          </span>
          <UButton
            class="ms-auto"
            label="Export CSV"
            icon="i-heroicons-arrow-down-tray"
            color="neutral"
            variant="soft"
            :disabled="!report || !contestedCount"
            @click="exportCsv"
          />
        </div>

        <div v-if="loading" class="py-8 text-center text-sm text-gray-500">Loading…</div>
        <div v-else-if="error" class="rounded-lg border border-red-500/40 p-3 text-sm text-red-500">{{ error }}</div>

        <template v-else-if="report">
        <UAlert
          v-if="report.skillNote"
          color="warning"
          variant="subtle"
          icon="i-heroicons-exclamation-triangle"
          :description="report.skillNote"
        />

        <UTabs
          :items="[
            { label: `Contested projects (${contestedCount})`, icon: 'i-heroicons-scale', slot: 'contested' },
            { label: `No team yet (${unplacedCount})`, icon: 'i-heroicons-user-minus', slot: 'unplaced' },
          ]"
          class="w-full"
          :ui="{ content: 'pt-4' }"
        >
          <template #contested>
            <p v-if="!contestedCount" class="py-6 text-center text-sm text-gray-500">
              No project has more than {{ maxTeamSize }} students ranking it in their top {{ report.topN }}, so
              there are no ties to break.
            </p>
            <div v-else class="space-y-5">
              <section
                v-for="project in report.contested"
                :key="project.projectId"
                class="rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <header class="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2">
                  <h3 class="font-semibold">{{ project.projectName }}</h3>
                  <span class="text-xs text-gray-500">
                    {{ project.wanting.length }} students want it · {{ project.seats }} seats
                    <template v-if="project.projectSkills"> · needs {{ project.projectSkills }}</template>
                    <template v-else> · no project skills set, so skill fit can't count here</template>
                  </span>
                </header>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead class="text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th class="px-4 py-1.5">#</th>
                        <th class="px-2 py-1.5">Student</th>
                        <th class="px-2 py-1.5">Class</th>
                        <th class="px-2 py-1.5">Pick</th>
                        <th class="px-2 py-1.5">3200 before</th>
                        <th class="px-2 py-1.5">Semesters</th>
                        <th class="px-2 py-1.5">Skill fit{{ usingGemini ? ' (Gemini)' : '' }}</th>
                        <th class="px-2 py-1.5">On the board</th>
                        <th class="px-2 py-1.5">Ahead of next because</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
                      <tr v-for="(c, i) in project.wanting" :key="c.studentId">
                        <td class="px-4 py-1.5 text-gray-500">{{ i + 1 }}</td>
                        <td class="px-2 py-1.5 font-medium">{{ c.name }}</td>
                        <td class="px-2 py-1.5">{{ c.className }}</td>
                        <td class="px-2 py-1.5">#{{ c.position }}</td>
                        <td class="px-2 py-1.5">{{ c.prior3200Semesters > 0 ? 'Yes' : 'No' }}</td>
                        <td class="px-2 py-1.5">{{ c.priorSemesters }}</td>
                        <td class="px-2 py-1.5" :title="c.skills || 'No skills on the bid form'">{{ fitText(c) }}</td>
                        <td class="px-2 py-1.5">
                          <UBadge v-if="c.placedHere" color="success" variant="subtle">
                            Here{{ c.locked ? ' (locked)' : '' }}
                          </UBadge>
                          <span v-else-if="c.placedAt" class="text-gray-500">{{ c.placedAt }}</span>
                          <span v-else class="text-amber-500">No team</span>
                        </td>
                        <td class="px-2 py-1.5 text-gray-500">{{ c.why ?? '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <p class="text-xs text-gray-500">
                The order follows the tie-break rules only. The solver also weighs everyone's other picks, team
                sizes and locks, so the board can differ from this order. Skill fit here is
                {{ usingGemini ? "Gemini's rating (0 to 1) where it could score, otherwise the local TF-IDF score" : 'the local TF-IDF score' }}.
              </p>
            </div>
          </template>

          <template #unplaced>
            <p v-if="!unplacedCount" class="py-6 text-center text-sm text-gray-500">
              Every student on this day is on a team.
            </p>
            <div v-else class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table class="w-full text-left text-sm">
                <thead class="text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th class="px-4 py-1.5">Student</th>
                    <th class="px-2 py-1.5">Class</th>
                    <th class="px-2 py-1.5">First pick</th>
                    <th class="px-2 py-1.5">Skills</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
                  <tr v-for="s in report.unplaced" :key="s.studentId">
                    <td class="px-4 py-1.5 font-medium">{{ s.name }}</td>
                    <td class="px-2 py-1.5">{{ s.className }}</td>
                    <td class="px-2 py-1.5">
                      <span v-if="s.topChoice">{{ s.topChoice }}</span>
                      <span v-else class="text-amber-500">No bid</span>
                    </td>
                    <td class="px-2 py-1.5 text-gray-500">{{ s.skills || 'none' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </UTabs>
        </template>
      </div>
    </template>
  </UModal>
</template>
