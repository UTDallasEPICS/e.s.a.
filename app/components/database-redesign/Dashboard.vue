<script setup lang="ts">
  import { computed, ref } from 'vue'
  import {
    students,
    projects,
    semesters,
    teams,
    officialProjectRosters,
    getPartnerById,
    getSemesterLabel,
    getClassStanding,
  } from '../data'
  import StatusBadge from './StatusBadge.vue'
  import SankeyChart from './SankeyChart.vue'
  import type { PinnedItem } from '../types'
  import {
    formatV1Value,
    humanizeV1Label,
    buildLegacyEnrollmentChart,
    isLegacyAIResponse,
    legacyAnalyticsView,
    normalizeV1Response,
    type LegacyAIResponse,
    type V1Presentation,
  } from './aiResultView'

  import { Chart } from 'vue-chartjs'
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    Filler,
    BarController,
    LineController,
    PieController,
    DoughnutController,
    PolarAreaController,
    RadarController,
    ScatterController,
    BubbleController,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    RadialLinearScale,
    type ChartData,
    type ChartOptions,
    type ChartType as ChartJsType,
  } from 'chart.js'

  ChartJS.register(
    Title,
    Tooltip,
    Legend,
    Filler,
    BarController,
    LineController,
    PieController,
    DoughnutController,
    PolarAreaController,
    RadarController,
    ScatterController,
    BubbleController,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    RadialLinearScale
  )

  type AIChartType =
    | 'bar'
    | 'line'
    | 'area'
    | 'pie'
    | 'doughnut'
    | 'polarArea'
    | 'radar'
    | 'scatter'
    | 'bubble'
    | 'horizontalBar'
    | 'stackedBar'
    | 'sankey'
    | 'table'

  // Infer the project type directly from the existing project data.
  type Project = (typeof projects)[number]

  const props = defineProps<{ pinnedItems: PinnedItem[] }>()
  const emit = defineEmits<{
    navigate: [page: string]
    openProject: [projectId: string, semesterId: string]
    openStudent: [studentId: string]
    openInsight: [insightId: string]
    togglePin: [item: PinnedItem]
  }>()
  const selectedSemester = useState<string>('epics-selected-semester', () => 'FA26')

  const searchQuery = ref('')
  const aiMode = ref(false)
  const aiLoading = ref(false)
  const aiError = ref('')
  const aiV1Response = ref<V1Presentation | null>(null)
  const aiRequestedChartType = ref<AIChartType | undefined>()
  const aiResults = ref<{ label: string; count: number }[]>([])
  const aiAnalyticsSource = ref('projects')
  type AnalyticsMetric = {
    function: 'count' | 'countDistinct'
    field?: string
    alias: string
  }
  type AnalyticsPlanView = {
    source: string
    dimensions: string[]
    metrics: AnalyticsMetric[]
    chartType?: AIChartType
  }
  type AnalyticsValue = string | number | boolean
  type AnalyticsRow = Record<string, AnalyticsValue>
  type AnalyticsColumn = {
    key: string
    label: string
    field?: string
    kind: 'dimension' | 'metric'
  }

  const aiAnalyticsPlan = ref<AnalyticsPlanView | null>(null)
  const aiAnalyticsRows = ref<AnalyticsRow[]>([])
  const aiAnalyticsSummary = ref<{ label: string; value: number } | null>(null)

  const aiAnalyticsLabel = computed(() => {
    const labels: Record<string, string> = {
      projects: 'Projects',
      semesters: 'Semesters',
      partners: 'Partners',
      teams: 'Teams',
    }

    return labels[aiAnalyticsSource.value] ?? 'Records'
  })
  const aiAnalyticsView = computed(() => {
    const plan = aiAnalyticsPlan.value
    if (!plan) return 'empty'
    return legacyAnalyticsView(plan.dimensions.length, plan.metrics.length, plan.chartType)
  })
  const aiAnalyticsColumns = computed<AnalyticsColumn[]>(() => {
    const plan = aiAnalyticsPlan.value
    if (!plan) return []

    return [
      ...plan.dimensions.map((field) => ({
        key: field,
        label: analyticsFieldLabel(field),
        field,
        kind: 'dimension' as const,
      })),
      ...plan.metrics.map((metric) => ({
        key: metric.alias,
        label: analyticsMetricLabel(metric),
        field: metric.function === 'countDistinct' ? metric.field : undefined,
        kind: 'metric' as const,
      })),
    ]
  })
  const chartPalette = ['#075b91', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d']
  const aiAnalyticsChartType = computed<AIChartType>(() =>
    aiAnalyticsView.value === 'table' || aiAnalyticsView.value === 'summary'
      ? 'bar'
      : aiAnalyticsView.value === 'bar' && !aiAnalyticsPlan.value?.chartType
        ? 'horizontalBar'
        : (aiAnalyticsView.value as AIChartType)
  )
  const aiAnalyticsChartRenderType = computed<ChartJsType>(() =>
    chartRenderType(aiAnalyticsChartType.value)
  )
  const aiAnalyticsChartData = computed(() => {
    const plan = aiAnalyticsPlan.value
    const dimension = plan?.dimensions[0]
    const labels = aiAnalyticsRows.value.map((row) =>
      formatAnalyticsValue(dimension ?? '', row[dimension ?? ''])
    )
    const series = (plan?.metrics ?? []).map((metric) => ({
      label: analyticsMetricLabel(metric),
      values: aiAnalyticsRows.value.map((row) => Number(row[metric.alias] ?? 0)),
    }))
    return buildAIChartSeriesData(labels, series, aiAnalyticsChartType.value)
  })
  const aiAnalyticsChartStyle = computed(() => ({
    position: 'relative',
    width: '100%',
    minWidth: '0',
    height: `${Math.min(520, Math.max(240, aiAnalyticsRows.value.length * 42 + 48))}px`,
    overflow: 'hidden',
  }))
  const aiAnalyticsChartOptions = computed(() =>
    buildAIChartOptions(
      aiAnalyticsChartType.value,
      aiAnalyticsChartData.value.labels ?? [],
      aiAnalyticsPlan.value?.metrics.length ?? 1
    )
  )
  const aiResultSemester = ref('')
  const aiStudentCount = ref<number | null>(null)
  const aiResultOperation = ref('')
  type AIProject = {
    id: string
    name: string
    description: string
    type: string
    status: string
  }

  const aiProjects = ref<AIProject[]>([])

  const aiResultsChart = computed(() =>
    buildLegacyEnrollmentChart(aiResults.value, aiRequestedChartType.value)
  )
  const aiResultsChartType = computed<AIChartType>(() => aiResultsChart.value?.type ?? 'bar')
  const aiResultsChartSupported = computed(() => aiResultsChart.value !== undefined)
  const aiResultsChartRenderType = computed<ChartJsType>(() => chartRenderType(aiResultsChartType.value))
  const aiResultsChartData = computed(() =>
    buildAIChartData(
      aiResultsChart.value?.labels ?? [],
      aiResultsChart.value?.values ?? [],
      aiResultsChartType.value,
      'Students'
    )
  )
  const aiResultsChartOptions = computed(() =>
    buildAIChartOptions(aiResultsChartType.value, aiResultsChartData.value.labels ?? [])
  )

  const aiV1ChartType = computed<AIChartType>(() => aiV1Response.value?.chart?.type ?? 'bar')
  const aiV1ChartRenderType = computed<ChartJsType>(() => chartRenderType(aiV1ChartType.value))
  const aiV1ChartData = computed(() => {
    const chart = aiV1Response.value?.chart
    return buildAIChartSeriesData(chart?.labels ?? [], chart?.series ?? [], aiV1ChartType.value)
  })
  const aiV1ChartOptions = computed(() =>
    buildAIChartOptions(
      aiV1ChartType.value,
      aiV1ChartData.value.labels ?? [],
      aiV1Response.value?.chart?.series.length ?? 1
    )
  )
  const aiV1StatusLabel = computed(() => {
    const labels: Record<string, string> = {
      answer: 'Answer',
      no_data: 'No matching records',
      privacy_restricted: 'Privacy restricted',
      clarification_needed: 'Clarification needed',
      unsupported_capability: 'Unsupported request',
      execution_error: 'Search error',
    }
    return labels[aiV1Response.value?.status ?? ''] ?? 'AI results'
  })

  function chartRenderType(type: AIChartType): ChartJsType {
    if (type === 'area') return 'line'
    if (type === 'horizontalBar' || type === 'stackedBar') return 'bar'
    if (type === 'table' || type === 'sankey') return 'bar'
    return type
  }

  function buildAIChartData(
    labels: string[],
    values: number[],
    type: AIChartType,
    label: string
  ): ChartData<ChartJsType> {
    return buildAIChartSeriesData(labels, [{ label, values }], type)
  }

  function buildAIChartSeriesData(
    labels: string[],
    series: Array<{ label: string; values: number[] }>,
    type: AIChartType
  ): ChartData<ChartJsType> {
    const isCircular = ['pie', 'doughnut', 'polarArea'].includes(type)
    const datasets = series.map(({ label, values }, seriesIndex) => {
      const data =
        type === 'scatter' || type === 'bubble'
          ? values.map((value, index) => ({
            x: index,
            y: value,
            ...(type === 'bubble'
              ? { r: Math.max(4, Math.min(24, Math.sqrt(Math.abs(value)) * 3)) }
              : {}),
          }))
          : values
      const color = chartPalette[seriesIndex % chartPalette.length] ?? '#075b91'
      return {
        label,
        data,
        backgroundColor: isCircular
          ? chartPalette
          : type === 'area'
            ? `${color}33`
            : color,
        borderColor: isCircular ? '#ffffff' : color,
        borderWidth: isCircular ? 2 : 1,
        borderRadius: ['bar', 'horizontalBar', 'stackedBar'].includes(type) ? 10 : undefined,
        borderSkipped: ['bar', 'horizontalBar', 'stackedBar'].includes(type) ? false : undefined,
        maxBarThickness: ['bar', 'horizontalBar', 'stackedBar'].includes(type) ? 40 : undefined,
        pointRadius: type === 'scatter' ? 5 : type === 'bubble' ? undefined : 3,
        tension: type === 'line' || type === 'area' ? 0.35 : undefined,
        fill: type === 'area',
        stack: type === 'stackedBar' ? 'stack' : undefined,
      }
    })
    return { labels, datasets } as unknown as ChartData<ChartJsType>
  }

  function buildAIChartOptions(
    type: AIChartType,
    labels: string[],
    seriesCount = 1
  ): ChartOptions<ChartJsType> {
    const renderType = chartRenderType(type)
    const showLegend =
      ['pie', 'doughnut', 'polarArea', 'radar'].includes(type) ||
      (seriesCount > 1 && ['line', 'area', 'stackedBar'].includes(type))
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      indexAxis: type === 'horizontalBar' ? 'y' : 'x',
      plugins: {
        legend: { display: showLegend, position: 'right' },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => labels[items[0]?.dataIndex ?? 0] ?? '',
          },
        },
      },
    }
    if (type === 'pie' || type === 'doughnut') {
      return base as unknown as ChartOptions<ChartJsType>
    }
    if (type === 'radar' || type === 'polarArea') {
      return {
        ...base,
        scales: { r: { beginAtZero: true } },
      } as unknown as ChartOptions<ChartJsType>
    }
    if (type === 'scatter' || type === 'bubble') {
      return {
        ...base,
        scales: {
          x: {
            type: 'linear',
            ticks: { callback: (index: number) => labels[index] ?? '' },
            grid: { color: '#edf0f2' },
          },
          y: { beginAtZero: true, grid: { color: '#edf0f2' } },
        },
      } as unknown as ChartOptions<ChartJsType>
    }
    const isStacked = type === 'stackedBar'
    const isHorizontal = type === 'horizontalBar'
    const scales = isHorizontal
      ? {
          x: { beginAtZero: true, stacked: isStacked, grid: { color: '#edf0f2' } },
          y: { stacked: isStacked, grid: { display: false } },
        }
      : {
          x: { stacked: isStacked, grid: { display: false } },
          y: { beginAtZero: true, stacked: isStacked, grid: { color: '#edf0f2' } },
        }
    return { ...base, scales } as unknown as ChartOptions<ChartJsType>
  }

  async function runAISearch() {
    const question = searchQuery.value.trim()

    if (!question || aiLoading.value) return

    aiLoading.value = true
    aiError.value = ''
    aiV1Response.value = null
    aiResults.value = []
    aiProjects.value = []
    aiResultSemester.value = ''
    aiStudentCount.value = null
    aiResultOperation.value = ''
    aiRequestedChartType.value = undefined
    aiAnalyticsPlan.value = null
    aiAnalyticsRows.value = []
    aiAnalyticsSummary.value = null

    try {
      const rawResponse = await $fetch<unknown>('/api/ai/ask', {
        method: 'POST',
        body: {
          question,
          selectedSemester: selectedSemester.value,
        },
      })

      const v1Response = normalizeV1Response(rawResponse)
      if (v1Response) {
        aiV1Response.value = v1Response
        return
      }

      if (!isLegacyAIResponse(rawResponse)) {
        aiError.value = 'The AI search returned an unsupported response. Please try again.'
        return
      }
      const response = rawResponse
      /* Legacy response handling below intentionally retains its existing shape. */
      const legacyResponse = response

      if (!legacyResponse.data) {
        aiError.value = 'This question is not supported yet.'
        return
      }

      aiResultOperation.value = legacyResponse.plan.operation
      aiRequestedChartType.value = legacyResponse.plan.chartType
      aiResultSemester.value = legacyResponse.data.semester ?? ''

      // Handle generalized analytical results.
      if (legacyResponse.plan.operation === 'analytics') {
        const { plan, data } = legacyResponse
        const supportedSources = ['projects', 'partners', 'teams', 'semesters']
        if (
          !plan.source ||
          !supportedSources.includes(plan.source) ||
          !Array.isArray(plan.dimensions) ||
          !Array.isArray(plan.metrics) ||
          !normalizeAnalyticsResponse(plan, data)
        ) {
          aiError.value = 'The analytics response did not match its approved query plan.'
          return
        }
        aiAnalyticsSource.value = plan.source
        return
      }

      if (legacyResponse.plan.operation === 'count_projects' || legacyResponse.plan.operation === 'count') {
        aiStudentCount.value = legacyResponse.data.count ?? null
        aiResultOperation.value = 'count_projects'
        return
      }

      if (legacyResponse.plan.operation === 'count_students') {
        aiStudentCount.value = legacyResponse.data.count ?? null
      } else if (legacyResponse.plan.operation === 'student_count_by_major') {
        aiResults.value = (legacyResponse.data.results ?? [])
          .filter((item): item is { major: string; count: number } => 'major' in item)
          .map((item) => ({
            label: item.major,
            count: item.count,
          }))
      } else if (legacyResponse.plan.operation === 'student_count_by_year') {
        aiResults.value = (legacyResponse.data.results ?? [])
          .filter((item): item is { year: string; count: number } => 'year' in item)
          .map((item) => ({
            label: item.year,
            count: item.count,
          }))
      } else if (legacyResponse.plan.operation === 'search_projects') {
        aiProjects.value = (legacyResponse.data.results ?? []).filter(
          (item): item is AIProject => 'id' in item
        )
      } else {
        aiError.value = 'This question is not supported yet.'
      }
    } catch (error) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status
      aiError.value =
        status === 422
          ? 'This question or result shape is not supported yet.'
          : 'Unable to process your question. Please try again.'
      console.error('AI search failed:', error)
    } finally {
      aiLoading.value = false
    }
  }

  function normalizeAnalyticsResponse(
    plan: {
      source: string
      dimensions: string[]
      metrics: AnalyticsMetric[]
      chartType?: AIChartType
    },
    data: Record<string, unknown>
  ): boolean {
    if (plan.metrics.length < 1 || plan.dimensions.length > 3) return false
    if (plan.source === 'enrollments' || plan.source === 'memberships' || plan.source === 'choices')
      return false
    const dimensionKeys = new Set(plan.dimensions)
    if (
      dimensionKeys.size !== plan.dimensions.length ||
      plan.metrics.some((metric) => dimensionKeys.has(metric.alias))
    )
      return false
    aiAnalyticsSource.value = plan.source

    const normalizedPlan: AnalyticsPlanView = {
      source: plan.source,
      dimensions: [...plan.dimensions],
      metrics: plan.metrics.map((metric) => ({ ...metric })),
      ...(plan.chartType ? { chartType: plan.chartType } : {}),
    }
    if (plan.dimensions.length > 0 && !Array.isArray(data.results)) return false
    const rows = Array.isArray(data.results) ? data.results : []

    if (plan.dimensions.length === 0 && plan.metrics.length === 1) {
      const metric = plan.metrics[0]
      const value = metric ? data[metric.alias] : undefined
      if (typeof value !== 'number' || !Number.isFinite(value)) return false
      aiAnalyticsPlan.value = normalizedPlan
      aiAnalyticsSummary.value = {
        label: metric ? analyticsMetricLabel(metric) : 'Result',
        value,
      }
      return true
    }

    const selectedKeys = [...plan.dimensions, ...plan.metrics.map((metric) => metric.alias)]
    const normalizedRows: AnalyticsRow[] = []
    for (const rawRow of rows) {
      if (typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow)) return false
      const normalized: AnalyticsRow = {}
      for (const field of plan.dimensions) {
        const value = rawRow[field]
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
          return false
        normalized[field] = value
      }
      for (const metric of plan.metrics) {
        const value = rawRow[metric.alias]
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        normalized[metric.alias] = value
      }
      normalizedRows.push(Object.fromEntries(selectedKeys.map((key) => [key, normalized[key]])))
    }

    if (plan.dimensions.length === 0 && normalizedRows.length === 0) {
      const normalized: AnalyticsRow = {}
      for (const metric of plan.metrics) {
        const value = data[metric.alias]
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        normalized[metric.alias] = value
      }
      normalizedRows.push(normalized)
    }

    aiAnalyticsPlan.value = normalizedPlan
    aiAnalyticsRows.value = normalizedRows
    return true
  }

  function analyticsFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      year: 'Academic Year',
      season: 'Season',
      type: 'Project Type',
      status: 'Project Status',
      name: 'Name',
      meetingDay: 'Meeting Day',
      'partner.name': 'Partner',
      'projects.type': 'Project Type',
      'projects.status': 'Project Status',
      'projects.teams.meetingDay': 'Meeting Day',
      'projects.teams.semester.year': 'Academic Year',
      'projects.teams.semester.season': 'Season',
      'teams.meetingDay': 'Meeting Day',
      'teams.semester.year': 'Academic Year',
      'teams.semester.season': 'Season',
      'teams.project.type': 'Project Type',
      'teams.project.status': 'Project Status',
      'teams.project.partner.name': 'Partner',
      'semester.year': 'Academic Year',
      'semester.season': 'Season',
      'project.type': 'Project Type',
      'project.status': 'Project Status',
      'project.partner.name': 'Partner',
    }
    return labels[field] ?? field.split('.').map(toTitleCase).join(' · ')
  }

  function analyticsMetricLabel(metric: AnalyticsMetric): string {
    if (metric.function === 'countDistinct' && metric.field) {
      return `Distinct ${analyticsFieldLabel(metric.field)}`
    }
    return `${aiAnalyticsLabel.value} count`
  }

  function formatAnalyticsValue(field: string, value: unknown): string {
    if (typeof value === 'number') return value.toLocaleString()
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value !== 'string') return '—'

    const labels: Record<string, string> = {
      SOFTWARE: 'Software',
      HARDWARE: 'Hardware',
      BOTH: 'Both',
      NEW: 'New',
      RETURNING: 'Returning',
      COMPLETE: 'Complete',
      WITHDRAWN: 'Withdrawn',
      HOLD: 'On hold',
      SPRING: 'Spring',
      SUMMER: 'Summer',
      FALL: 'Fall',
      WEDNESDAY: 'Wednesday',
      THURSDAY: 'Thursday',
    }
    if (labels[value]) return labels[value]
    if (field === 'season' || field.endsWith('.season')) return toTitleCase(value)
    if (value.startsWith('EPCS_')) return value.replace('_', ' ')
    if (/^[A-Z][A-Z0-9_]*$/.test(value)) return toTitleCase(value)
    return value
  }

  function toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ''))
      .join(' ')
  }

  const selectedDashboardProjectId = ref<string | null>(null)

  const selectedDashboardProject = computed(
    () => projects.find((project) => project.id === selectedDashboardProjectId.value) ?? null
  )

  const popupSemester = ref('')

  const popupTeamSkills = computed(() => {
    const project = selectedDashboardProject.value
    if (!project || !popupSemester.value) return []

    const savedSkills = project.semesterDetails?.find(
      (detail) => detail.semesterId === popupSemester.value
    )?.teamSkills

    if (savedSkills?.length) return savedSkills

    return Array.from(new Set(popupStudents.value.flatMap((student) => student.skills))).slice(0, 8)
  })

  const popupStudents = computed(() => {
    if (!selectedDashboardProject.value || !popupSemester.value) {
      return []
    }

    const studentIds = new Set(
      teams
        .filter(
          (team) =>
            team.projectId === selectedDashboardProject.value!.id &&
            team.semesterId === popupSemester.value
        )
        .flatMap((team) => team.studentIds)
    )

    return students.filter((student) => studentIds.has(student.id))
  })

  const filteredProjects = computed(() => {
    if (aiMode.value) return semesterProjects.value

    const query = searchQuery.value.trim().toLowerCase()

    if (!query) return semesterProjects.value

    return semesterProjects.value.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (getPartnerById(project.partnerId)?.name ?? '').toLowerCase().includes(query)
    )
  })

  const semesterStudents = computed(() =>
    selectedSemester.value === 'all'
      ? students.filter((student) => student.participationStatus !== 'Exited Program')
      : students.filter(
          (student) =>
            student.participationStatus !== 'Exited Program' &&
            student.semesters.includes(selectedSemester.value)
        )
  )
  const semesterProjects = computed(() =>
    projects.filter(
      (project) =>
        selectedSemester.value === 'all' || project.semesters.includes(selectedSemester.value)
    )
  )
  const returningStudents = computed(() =>
    semesterStudents.value.filter((student) =>
      selectedSemester.value === 'all'
        ? student.semesters.length > 1
        : student.semesters.indexOf(selectedSemester.value) > 0
    )
  )
  const firstTimeStudents = computed(() =>
    selectedSemester.value === 'all'
      ? semesterStudents.value.filter((student) => student.semesters.length === 1).length
      : semesterStudents.value.length - returningStudents.value.length
  )
  const returningPct = computed(() =>
    selectedSemester.value === 'SP26'
      ? Math.round((38 / officialSpringRoster.value.length) * 100)
      : semesterStudents.value.length
        ? Math.round((returningStudents.value.length / semesterStudents.value.length) * 100)
        : 0
  )
  const selectedSemesterLabel = computed(() =>
    selectedSemester.value === 'all' ? 'All semesters' : getSemesterLabel(selectedSemester.value)
  )

  // Semester IDs use SP, SU, FA followed by the two-digit year.
  function semesterOrder(id: string): number {
    const year = Number(id.slice(-2))
    const term = id.slice(0, -2)
    const termOrder: Record<string, number> = { SP: 1, SU: 2, FA: 3 }
    return year * 10 + (termOrder[term] ?? 0)
  }

  function latestProjectSemester(project: Project): string {
    return [...project.semesters].sort((a, b) => semesterOrder(a) - semesterOrder(b)).at(-1) ?? ''
  }

  function getDashboardProjectStatusForSemester(
    project: Project,
    semesterId: string
  ): Project['status'] {
    // A recorded semester-specific special status takes priority.
    const savedStatus = project.semesterDetails?.find(
      (detail) => detail.semesterId === semesterId
    )?.status

    if (savedStatus === 'Paused' || savedStatus === 'Completed' || savedStatus === 'Dropped') {
      return savedStatus
    }

    const orderedSemesters = [...project.semesters].sort(
      (a, b) => semesterOrder(a) - semesterOrder(b)
    )
    const firstSemester = orderedSemesters[0]
    const lastSemester = orderedSemesters[orderedSemesters.length - 1]

    // Legacy overall special statuses apply only to the final semester.
    if (
      semesterId === lastSemester &&
      (project.status === 'Paused' ||
        project.status === 'Completed' ||
        project.status === 'Dropped')
    ) {
      return project.status
    }

    return semesterId === firstSemester ? 'New' : 'In Progress'
  }

  function getDashboardProjectStatus(project: Project): Project['status'] {
    const semesterId =
      selectedSemester.value === 'all' ? latestProjectSemester(project) : selectedSemester.value

    return getDashboardProjectStatusForSemester(project, semesterId)
  }

  const officialSpringRoster = computed(() =>
    Array.from(
      new Map(
        Object.values(officialProjectRosters)
          .flat()
          .map((student) => [student.name, student])
      ).values()
    )
  )
  const displayedStudents = computed(() =>
    selectedSemester.value === 'SP26'
      ? officialSpringRoster.value.map((student) => ({
          ...student,
          id: student.name,
          recordId: null as string | null,
        }))
      : semesterStudents.value.map((student) => ({ ...student, recordId: student.id }))
  )
  const enrollmentCount = computed(() =>
    selectedSemester.value === 'SP26'
      ? officialSpringRoster.value.length
      : semesterStudents.value.length
  )

  const newProjectsCount = computed(() => {
    if (selectedSemester.value === 'all') {
      return projects.length
    }

    return semesterProjects.value.filter(
      (project) => getDashboardProjectStatusForSemester(project, selectedSemester.value) === 'New'
    ).length
  })

  const activeProjectsCount = computed(
    () =>
      semesterProjects.value.filter((project) => {
        if (selectedSemester.value === 'all') {
          return project.semesters.some((semesterId) => {
            const status = getDashboardProjectStatusForSemester(project, semesterId)

            return status === 'New' || status === 'In Progress' || status === 'Completed'
          })
        }

        const status = getDashboardProjectStatus(project)

        return status === 'New' || status === 'In Progress' || status === 'Completed'
      }).length
  )

  const stats = computed(() => [
    {
      label: 'Enrolled Students',
      value: enrollmentCount.value,
      sub:
        selectedSemester.value === 'SP26'
          ? '5 course values not listed'
          : selectedSemesterLabel.value,
      tone: 'accent',
    },
    {
      label: 'Active Projects',
      value: activeProjectsCount.value,
      sub:
        selectedSemester.value === 'all'
          ? `${newProjectsCount.value} projects started across the program`
          : `${newProjectsCount.value} new this semester`,
      tone: 'green',
    },
  ])

  const courseStats = computed(() => [
    {
      label: 'EPCS 2200',
      value: selectedSemester.value === 'SP26' ? 108 : firstTimeStudents.value,
      tone: 'gold',
    },
    {
      label: selectedSemester.value === 'SP26' ? 'EPCS 3200' : 'EPCS 3300',
      value: selectedSemester.value === 'SP26' ? 38 : returningStudents.value.length,
      tone: 'teal',
    },
  ])

  function isPinned(key: string) {
    return props.pinnedItems.some((item) => item.key === key)
  }

  function openPinned(item: PinnedItem) {
    if (item.type === 'project') emit('openProject', item.id, 'SP26')
    else emit('openInsight', item.id)
  }
</script>

<template>
  <div class="page-shell">
    <div class="page-header">
      <div>
        <h1 class="page-title">EPICS Program Dashboard</h1>
        <p class="page-subtitle">A semester-specific view of enrollment and project activity</p>
      </div>
      <div class="semester-controls">
        <button
          class="semester-all-button"
          :class="{ active: selectedSemester === 'all' }"
          @click="selectedSemester = 'all'"
        >
          All Semesters
        </button>
        <label class="semester-picker">
          <span>Dashboard semester</span>
          <select v-model="selectedSemester">
            <option value="all">All Semesters</option>
            <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
              {{ semester.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <div
      style="
        display: flex;
        align-items: center;
        margin-bottom: 24px;
        border: 1px solid #8ca5bf;
        border-radius: 10px;
        overflow: hidden;
      "
    >
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="aiMode ? 'Ask AI about ESA data...' : 'Search projects...'"
        :aria-label="aiMode ? 'Ask AI about ESA data' : 'Search dashboard projects'"
        @keydown.enter="aiMode && runAISearch()"
        style="
          flex: 1;
          min-width: 0;
          padding: 12px 16px;
          border: none;
          outline: none;
          background: transparent;
          font-size: 14px;
        "
      />

      <button
        type="button"
        @click="
          aiMode = !aiMode;
          searchQuery = '';
          aiV1Response = null;
          aiResults = [];
          aiProjects = [];
          aiAnalyticsPlan = null;
          aiAnalyticsRows = [];
          aiAnalyticsSummary = null;
          aiResultOperation = '';
          aiStudentCount = null;
          aiResultSemester = '';
          aiError = ''
        "
        :aria-pressed="aiMode"
        :style="{
          background: aiMode ? '#075b91' : '#e5e7eb',
          color: aiMode ? '#ffffff' : '#374151',
          border: 'none',
          borderRadius: '20px',
          padding: '8px 14px',
          marginRight: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }"
      >
        ✧ AI Mode
      </button>
    </div>

    <div
      v-if="aiMode && (aiLoading || aiError || aiResultOperation || aiV1Response)"
      style="
        margin-bottom: 24px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 10px;
        background: white;
      "
    >
      <p v-if="aiLoading">Analyzing your question...</p>

      <p v-else-if="aiError" style="color: #b91c1c">
        {{ aiError }}
      </p>

      <template v-else>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px">
          <div
            style="
              width: 42px;
              height: 42px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #eaf3f9;
              border-radius: 12px;
              color: #075b91;
              font-size: 20px;
              flex-shrink: 0;
            "
          >
            ✦
          </div>

          <div>
            <h3 style="font-size: 19px; font-weight: 650; color: #1e293b; margin: 0">
              AI Insights
            </h3>

            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0">
              {{ aiV1Response ? aiV1StatusLabel :
                aiResultOperation === 'analytics'
                  ? `${aiAnalyticsLabel} analytics from ESA database records`
                  : aiResultOperation === 'count_students'
                    ? 'Student enrollment summary'
                    : aiResultOperation === 'student_count_by_year'
                      ? 'Student enrollment by year'
                      : aiResultOperation === 'student_count_by_major'
                        ? 'Student enrollment by major'
                        : 'Results from ESA database records'
              }}
              {{ aiResultsSemester ? `— ${aiResultsSemester}` : '' }}
            </p>
          </div>
        </div>

        <section v-if="aiV1Response" style="min-width: 0; width: 100%">
          <div
            role="status"
            :style="{
              padding: '14px 18px',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              background: aiV1Response.status === 'answer' ? '#f0f9ff' : '#f8fafc',
              color: aiV1Response.status === 'privacy_restricted' || aiV1Response.status === 'execution_error'
                ? '#9f1239'
                : '#334155',
              marginBottom: '18px',
            }"
          >
            <strong>{{ aiV1StatusLabel }}:</strong> {{ aiV1Response.explanation }}
          </div>

          <div
            v-if="aiV1Response.summary"
            style="
              padding: 28px;
              text-align: center;
              background: #ffffff;
              border: 1px solid #e2e8e5;
              border-radius: 16px;
              margin-bottom: 24px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
            "
          >
            <div style="font-size: 40px; font-weight: 700; color: #075b91">
              {{ aiV1Response.summary.value.toLocaleString() }}
            </div>
            <p style="margin: 8px 0 0; color: #64748b">
              {{ aiV1Response.summary.label }}
            </p>
          </div>

          <SankeyChart v-if="aiV1Response.sankey" :data="aiV1Response.sankey" />

          <ClientOnly v-if="aiV1Response.chart">
            <div :style="aiAnalyticsChartStyle" style="max-width: 100%; margin: 8px 0 24px">
              <Chart
                :type="aiV1ChartRenderType"
                :data="aiV1ChartData"
                :options="aiV1ChartOptions"
              />
            </div>
          </ClientOnly>

          <div
            v-if="aiV1Response.result && aiV1Response.result.rows.length > 0 && !aiV1Response.summary"
            style="
              width: 100%;
              min-width: 0;
              overflow-x: auto;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              margin: 20px 0 24px;
              background: #ffffff;
            "
          >
            <table
              style="
                width: 100%;
                min-width: max-content;
                border-collapse: collapse;
                font-size: 14px;
              "
            >
              <thead>
                <tr style="background: #f8fafc">
                  <th
                    v-for="column in aiV1Response.result.columns"
                    :key="column.key"
                    :style="{
                      textAlign: column.role === 'metric' || column.role === 'calculation' ? 'right' : 'left',
                      padding: '16px 20px',
                      color: '#475569',
                      fontWeight: 600,
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }"
                  >
                    {{ humanizeV1Label(column) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rowIndex) in aiV1Response.result.rows"
                  :key="row.key"
                  :style="{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }"
                >
                  <td
                    v-for="column in aiV1Response.result.columns"
                    :key="`${row.key}-${column.key}`"
                    :style="{
                      padding: '16px 20px',
                      color: column.role === 'metric' || column.role === 'calculation' ? '#075b91' : '#334155',
                      fontWeight: column.role === 'metric' || column.role === 'calculation' ? 700 : 500,
                      textAlign: column.role === 'metric' || column.role === 'calculation' ? 'right' : 'left',
                      borderBottom: '1px solid #f1f5f9',
                      whiteSpace: 'nowrap',
                    }"
                  >
                    {{ formatV1Value(column, row.values[column.key]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-if="aiV1Response.result && (!aiV1Response.result.complete || aiV1Response.result.hasMore)"
            style="margin: 12px 0 20px; font-size: 13px; color: #92400e"
          >
            Results are limited: showing {{ aiV1Response.result.rows.length }}
            {{ aiV1Response.result.kind === 'aggregate' ? 'groups' : 'records' }} (limit
            {{ aiV1Response.result.limit }}).
            {{ aiV1Response.result.hasMore ? 'More results are available.' : 'The full result exceeded the display limit.' }}
          </p>

          <p v-if="aiV1Response.result" style="margin: 12px 0 20px; font-size: 12px; color: #64748b">
            Source: ESA database · {{ aiV1Response.result.model }} records.
          </p>
        </section>

        <div v-if="!aiV1Response && aiResultOperation === 'search_projects'">
          <p style="color: #4b5563; margin-bottom: 16px">
            {{ aiProjects.length }} matching projects displayed
          </p>

          <p v-if="aiProjects.length === 0" style="color: #4b5563">No matching projects found.</p>

          <div
            style="
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
              gap: 14px;
            "
          >
            <div
              v-for="project in aiProjects"
              :key="project.id"
              style="
                padding: 18px;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background: #f8fafc;
                display: flex;
                flex-direction: column;
                gap: 12px;
              "
            >
              <h4 style="color: #0f172a; font-size: 16px; font-weight: 600; margin: 0">
                {{ project.name }}
              </h4>

              <p v-if="project.description" style="color: #64748b; font-size: 13px; margin: 0">
                {{ project.description }}
              </p>

              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto">
                <span
                  style="
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                  {{ project.type }}
                </span>

                <span
                  style="
                    background: #e2e8f0;
                    color: #334155;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                  "
                >
                  {{ project.status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <section v-if="!aiV1Response && aiResultOperation === 'analytics'" style="min-width: 0; width: 100%">
          <div
            v-if="aiAnalyticsView === 'summary' && aiAnalyticsSummary"
            style="
              padding: 28px;
              text-align: center;
              background: #ffffff;
              border: 1px solid #e2e8e5;
              border-radius: 16px;
              margin-bottom: 24px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
            "
          >
            <div style="font-size: 40px; font-weight: 700; color: #075b91">
              {{ aiAnalyticsSummary.value.toLocaleString() }}
            </div>
            <p style="margin: 8px 0 0; color: #64748b">
              {{ aiAnalyticsSummary.label }}
            </p>
          </div>

          <div
            v-else-if="aiAnalyticsRows.length === 0"
            style="
              padding: 20px 24px;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              background: #f8fafc;
              color: #475569;
              margin-bottom: 20px;
            "
          >
            No matching {{ aiAnalyticsLabel.toLowerCase() }} records were found.
          </div>

          <ClientOnly
            v-if="aiAnalyticsView !== 'summary' && aiAnalyticsView !== 'table' && aiAnalyticsRows.length > 0"
          >
            <div :style="aiAnalyticsChartStyle" style="max-width: 100%; margin: 8px 0 24px">
              <Chart
                :type="aiAnalyticsChartRenderType"
                :data="aiAnalyticsChartData"
                :options="aiAnalyticsChartOptions"
              />
            </div>
          </ClientOnly>

          <div
            v-if="aiAnalyticsRows.length > 0 && aiAnalyticsView !== 'summary'"
            style="
              width: 100%;
              min-width: 0;
              overflow-x: auto;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              margin: 20px 0 24px;
              background: #ffffff;
            "
          >
            <table
              style="
                width: 100%;
                min-width: max-content;
                border-collapse: collapse;
                font-size: 14px;
              "
            >
              <thead>
                <tr style="background: #f8fafc">
                  <th
                    v-for="column in aiAnalyticsColumns"
                    :key="column.key"
                    :style="{
                      textAlign: column.kind === 'metric' ? 'right' : 'left',
                      padding: '16px 20px',
                      color: '#475569',
                      fontWeight: 600,
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }"
                  >
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rowIndex) in aiAnalyticsRows"
                  :key="rowIndex"
                  :style="{ background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc' }"
                >
                  <td
                    v-for="column in aiAnalyticsColumns"
                    :key="`${rowIndex}-${column.key}`"
                    :style="{
                      padding: '16px 20px',
                      color: column.kind === 'metric' ? '#075b91' : '#334155',
                      fontWeight: column.kind === 'metric' ? 700 : 500,
                      textAlign: column.kind === 'metric' ? 'right' : 'left',
                      borderBottom: '1px solid #f1f5f9',
                      fontVariantNumeric: column.kind === 'metric' ? 'tabular-nums' : undefined,
                      whiteSpace: 'nowrap',
                    }"
                  >
                    {{ formatAnalyticsValue(column.field ?? column.key, row[column.key]) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p style="margin: 12px 0 20px; font-size: 12px; color: #64748b">
            Source: ESA database · {{ aiAnalyticsLabel }}.
          </p>
        </section>

        <div
          v-if="!aiV1Response && aiResultOperation === 'count_projects'"
          style="
            padding: 28px;
            text-align: center;
            background: #ffffff;
            border: 1px solid #e2e8e5;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
          "
        >
          <div
            v-if="aiStudentCount !== null"
            style="font-size: 40px; font-weight: 700; color: #1a3a1a"
          >
            {{ aiStudentCount }}
          </div>

          <div v-else>Project count unavailable.</div>

          <p style="margin-top: 8px; color: #555">Projects matching your search</p>
        </div>

        <div
          v-if="!aiV1Response && aiResultOperation === 'count_students'"
          style="
            font-size: 48px;
            font-weight: 700;
            color: #075b91;
            letter-spacing: -1.5px;
            line-height: 1.2;
          "
        >
          <div
            v-if="aiStudentCount !== null"
            style="
              font-size: 48px;
              font-weight: 700;
              color: #075b91;
              letter-spacing: -1.5px;
              line-height: 1.2;
            "
          >
            {{ aiStudentCount }}
          </div>

          <div v-else style="font-size: 16px; color: #555">
            Enrollment count unavailable or suppressed.
          </div>

          <p style="margin-top: 8px; color: #555">Students enrolled in {{ aiResultSemester }}</p>
        </div>

        <p
          v-if="
            !aiV1Response && ['student_count_by_major', 'student_count_by_year'].includes(aiResultOperation) &&
            aiResults.length === 0
          "
        >
          No enrollment groups are displayed. There may be no matching records, or groups may have
          been suppressed to protect privacy.
        </p>

        <div
          v-if="!aiV1Response && aiResultsChartSupported"
          style="width: 100%; min-width: 0; height: auto; margin-bottom: 24px"
        >
          <ClientOnly>
            <div
              style="position: relative; width: 100%; min-width: 0; height: 300px; overflow: hidden"
            >
              <Chart
                :type="aiResultsChartRenderType"
                :data="aiResultsChartData"
                :options="aiResultsChartOptions"
              />
            </div>
          </ClientOnly>
        </div>

        <div
          v-if="!aiV1Response && aiResults.length > 0"
          style="
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            overflow: hidden;
            margin-top: 24px;
            background: #ffffff;
          "
        >
          <table style="width: 100%; border-collapse: collapse; font-size: 14px">
            <thead>
              <tr style="background: #f8fafc">
                <th
                  style="
                    text-align: left;
                    padding: 16px 20px;
                    color: #475569;
                    font-weight: 600;
                    border-bottom: 1px solid #e2e8f0;
                  "
                >
                  {{ aiResultOperation === 'student_count_by_year' ? 'Year' : 'Major' }}
                </th>

                <th
                  style="
                    text-align: right;
                    padding: 16px 20px;
                    color: #475569;
                    font-weight: 600;
                    border-bottom: 1px solid #e2e8f0;
                  "
                >
                  Students
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="(item, index) in aiResults"
                :key="item.label"
                :style="{
                  background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                }"
              >
                <td
                  style="
                    padding: 16px 20px;
                    color: #334155;
                    font-weight: 500;
                    border-bottom: 1px solid #f1f5f9;
                  "
                >
                  {{ item.label }}
                </td>

                <td
                  style="
                    padding: 16px 20px;
                    text-align: right;
                    color: #075b91;
                    font-weight: 700;
                    border-bottom: 1px solid #f1f5f9;
                    font-variant-numeric: tabular-nums;
                  "
                >
                  {{ item.count.toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="!aiV1Response" style="margin-top: 12px; font-size: 12px; color: #666">
          <template v-if="['search_projects', 'count_projects'].includes(aiResultOperation)">
            Source: ESA database.
          </template>

          <template v-else>
            Source: ESA Prisma enrollment database. Small groups are suppressed. Results may differ
            from the sample data shown elsewhere in the dashboard.
          </template>
        </p>
      </template>
    </div>
    <div class="dashboard-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-card metric-card">
        <div class="metric-value" :class="`metric-${stat.tone}`">{{ stat.value }}</div>
        <div class="metric-label">{{ stat.label }}</div>
        <div class="metric-sub">{{ stat.sub }}</div>
      </div>

      <div class="stat-card metric-card course-enrollment-card">
        <div class="metric-label">EPICS Course Enrollment</div>

        <div class="course-enrollment-split">
          <div v-for="course in courseStats" :key="course.label" class="course-enrollment-item">
            <div class="metric-value" :class="`metric-${course.tone}`">
              {{ course.value }}
            </div>
            <div class="metric-label">{{ course.label }} Students</div>
          </div>
        </div>
      </div>
    </div>

    <section v-if="pinnedItems.length > 0" class="stat-card pinned-section">
      <div class="panel-heading">
        <div>
          <h2>Pinned Items</h2>
          <p>Keep important projects and insights within reach</p>
        </div>
        <span class="pin-count">{{ pinnedItems.length }} pinned</span>
      </div>
      <div v-if="pinnedItems.length" class="pinned-grid">
        <div v-for="item in pinnedItems" :key="item.key" class="pinned-item">
          <button class="pinned-item-main" @click="openPinned(item)">
            <span class="pinned-type">{{ item.type }}</span>
            <span class="pinned-title">{{ item.title }}</span>
            <span class="muted-cell">{{ item.subtitle }}</span>
          </button>
          <button
            class="unpin-button"
            :aria-label="`Unpin ${item.title}`"
            @click="emit('togglePin', item)"
          >
            Unpin
          </button>
        </div>
      </div>
      <div v-else class="pinned-empty">
        Use the Pin actions on projects and insight charts to add shortcuts here.
      </div>
    </section>

    <div class="dashboard-grid" style="grid-template-columns: 1fr">
      <section class="stat-card dashboard-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ selectedSemester === 'all' ? 'All Projects' : 'Projects This Semester' }}</h2>
            <p>{{ selectedSemesterLabel }} project roster</p>
          </div>
          <button class="text-button" @click="emit('navigate', 'projects')">View projects</button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Community Partner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in filteredProjects.slice(0, 8)" :key="project.id">
              <td>
                <button
                  class="record-link"
                  @click="
                    selectedDashboardProjectId = project.id;
                    popupSemester =
                      selectedSemester !== 'all' && project.semesters.includes(selectedSemester)
                        ? selectedSemester
                        : (project.semesters[project.semesters.length - 1] ?? '')
                  "
                >
                  <span v-if="project.projectNumber" class="mono"
                    >#{{ project.projectNumber }}</span
                  >
                  {{ project.name }}
                </button>
              </td>
              <td class="muted-cell">{{ getPartnerById(project.partnerId)?.name }}</td>
              <td><StatusBadge :status="getDashboardProjectStatus(project)" /></td>
              <td>
                <button
                  class="pin-button"
                  :class="{ active: isPinned(`project:${project.id}`) }"
                  @click="
                    emit('togglePin', {
                      key: `project:${project.id}`,
                      type: 'project',
                      id: project.id,
                      title: project.name,
                      subtitle: getPartnerById(project.partnerId)?.name ?? '',
                    })
                  "
                >
                  {{ isPinned(`project:${project.id}`) ? 'Pinned' : 'Pin' }}
                </button>
              </td>
            </tr>
            <tr v-if="!filteredProjects.length">
              <td colspan="4" class="empty-cell">No projects recorded for this selection.</td>
            </tr>
            <tr v-else-if="filteredProjects.length > 8">
              <td colspan="4" class="empty-cell">
                {{ filteredProjects.length - 8 }} more projects available in the Projects view.
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
    <div
      v-if="selectedDashboardProject"
      style="
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      "
      @click.self="selectedDashboardProjectId = null"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Project details"
        style="
          background: #ffffff;
          color: #1a3a1a;
          width: 100%;
          max-width: 850px;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 12px;
          padding: 28px;
        "
      >
        <div
          style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px"
        >
          <div>
            <h2 style="font-size: 22px; font-weight: 700">
              {{ selectedDashboardProject.name }}
            </h2>
            <p style="color: #5a6b52; margin-top: 6px">
              {{ getPartnerById(selectedDashboardProject.partnerId)?.name }}
            </p>
          </div>

          <button class="secondary-button" @click="selectedDashboardProjectId = null">
            ✕ Close
          </button>
        </div>

        <p style="margin-top: 20px">
          {{ selectedDashboardProject.description }}
        </p>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px">
          <button
            v-for="semesterId in selectedDashboardProject.semesters"
            :key="semesterId"
            class="secondary-button"
            :style="popupSemester === semesterId ? { background: '#1a3a1a', color: '#ffffff' } : {}"
            @click="popupSemester = semesterId"
          >
            {{ getSemesterLabel(semesterId) }}
          </button>
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 12px">Semester Status</h3>

          <StatusBadge
            :status="getDashboardProjectStatusForSemester(selectedDashboardProject, popupSemester)"
          />
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 12px">
            Student Roster · {{ getSemesterLabel(popupSemester) }}
          </h3>

          <div
            v-for="student in officialProjectRosters[selectedDashboardProject.id] ?? []"
            :key="`official-${student.name}`"
            style="padding: 10px 0; border-bottom: 1px solid #e2e8dc"
          >
            <div style="font-weight: 600">{{ student.name }}</div>
            <div style="font-size: 13px; color: #5a6b52">{{ student.major }}</div>
          </div>

          <div
            v-for="student in popupStudents"
            :key="student.id"
            style="padding: 10px 0; border-bottom: 1px solid #e2e8dc"
          >
            <div style="font-weight: 600">{{ student.name }}</div>
            <div style="font-size: 13px; color: #5a6b52">{{ student.major }}</div>
          </div>

          <p
            v-if="
              popupStudents.length === 0 &&
              !officialProjectRosters[selectedDashboardProject.id]?.length
            "
            style="color: #5a6b52"
          >
            No student assignments recorded for this semester.
          </p>
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 8px">Status Notes</h3>

          <p style="color: #5a6b52">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.statusNote || 'No status notes recorded.'
            }}
          </p>
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 8px">Community Partner Contact</h3>

          <div style="font-weight: 600">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.contactName ||
              getPartnerById(selectedDashboardProject.partnerId)?.contact ||
              'Not provided'
            }}
          </div>

          <div style="font-size: 13px; color: #5a6b52; margin-top: 4px">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.contactEmail ||
              getPartnerById(selectedDashboardProject.partnerId)?.email ||
              ''
            }}
          </div>

          <div style="font-size: 13px; color: #5a6b52; margin-top: 4px">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.contactPhone ||
              getPartnerById(selectedDashboardProject.partnerId)?.phone ||
              ''
            }}
          </div>

          <p style="font-size: 12px; color: #5a6b52; margin-top: 6px">
            Contact for {{ getSemesterLabel(popupSemester) }}
          </p>
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 8px">Project Mentor</h3>

          <p>
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.mentorName ||
              selectedDashboardProject.mentorName ||
              'Not assigned'
            }}
          </p>
        </div>

        <div style="margin-top: 24px">
          <h3 style="font-weight: 700; margin-bottom: 12px">Team Skills</h3>

          <div style="display: flex; gap: 8px; flex-wrap: wrap">
            <span
              v-for="skill in popupTeamSkills"
              :key="skill"
              style="
                background: #edf5e8;
                color: #1a3a1a;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 13px;
              "
            >
              {{ skill }}
            </span>
          </div>

          <p v-if="popupTeamSkills.length === 0" style="color: #5a6b52">
            No skills added for this semester.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
  .course-enrollment-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .course-enrollment-card > .metric-label {
    margin-bottom: 12px;
  }

  .course-enrollment-split {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .course-enrollment-item {
    min-width: 0;
    text-align: center;
    padding: 4px 12px;
  }

  .course-enrollment-item + .course-enrollment-item {
    border-left: 1px solid #d9e2d9;
  }
</style>
