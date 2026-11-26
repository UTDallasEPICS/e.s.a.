<script setup lang="ts">
  /**
   * Purpose
   * Show enrollment and project totals, and let users ask questions about ESA data.
   *
   * Inputs
   * - Selected semester, roster records, pinned items, and the user’s search text.
   *
   * Outputs
   * - Dashboard cards, project rows, and AI results or a message explaining why a request failed.
   *
   * Pseudocode
   * Read the selected semester → count matching records → when a question is submitted, request a report → render the result.
   */
  import {
    latestProjectSemester,
    projectStatusForSemester as getDashboardProjectStatusForSemester,
  } from '../projectSemesterStatus'
  import { printAIResult } from './printAIResult'
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import {
    students,
    partners,
    choices,
    projects,
    semesters,
    teams,
    officialProjectRosters,
    getPartnerById,
    getSemesterLabel,
    getClassStanding,
    getStudentCourse,
    getStudentForSemester,
    getOfficialProjectRoster,
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
  } from './aiResultPresentation'

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

  // Call ChartJS.register to run this step.
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

  // Use defineProps to initialize props.
  const props = defineProps<{ pinnedItems: PinnedItem[]; assistantOnly?: boolean }>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    navigate: [page: string]
    openProject: [projectId: string, semesterId: string]
    openStudent: [studentId: string, semesterId?: string]
    openInsight: [insightId: string]
    togglePin: [item: PinnedItem]
  }>()
  // Use useState to initialize selectedSemester.
  const selectedSemester = useState<string>('epics-selected-semester', () => 'FA26')

  // Store printedResult as state so Vue reacts when it changes.
  const printedResult = ref<HTMLElement | null>(null)
  // Store printing as state so Vue reacts when it changes.
  const printing = ref(false)
  // Store printError as state so Vue reacts when it changes.
  const printError = ref('')
  // Store lastAIQuestion as state so Vue reacts when it changes.
  const lastAIQuestion = ref('')
  // Store resultQuestion as state so Vue reacts when it changes.
  const resultQuestion = ref('')
  // Define the helper that will print result.
  async function printResult() {
    // Check whether !printedResult.value before running this branch.
    if (!printedResult.value) return
    // Update printing.value with the value on the right.
    printing.value = true
    // Update printError.value with the value on the right.
    printError.value = ''
    try {
      await printAIResult(printedResult.value, resultQuestion.value)
    } catch {
      // Update printError.value with the value on the right.
      printError.value = 'Print preview could not open. Please try again.'
    } finally {
      // Update printing.value with the value on the right.
      printing.value = false
    }
  }
  // Store conversationId as state so Vue reacts when it changes.
  const conversationId = ref<string | undefined>()
  // Store followUpText as state so Vue reacts when it changes.
  const followUpText = ref('')
  // Store turnHistory as state so Vue reacts when it changes.
  const turnHistory = ref<Array<{ question: string; status: string; explanation: string }>>([])
  // Define the helper that will ask suggestion.
  function askSuggestion(suggestion: string) {
    // Update followUpText.value with the value on the right.
    followUpText.value = suggestion
    // Call askFollowUp to run this step.
    askFollowUp()
  }
  // Define the helper that will ask follow up.
  function askFollowUp() {
    // Check whether !followUpText.value.trim() || aiLoading.value before running this branch.
    if (!followUpText.value.trim() || aiLoading.value) return
    // Update searchQuery.value with the value on the right.
    searchQuery.value = followUpText.value.trim()
    // Update followUpText.value with the value on the right.
    followUpText.value = ''
    void runAISearch()
  }
  // Define the helper that will load more results.
  function loadMoreResults() {
    // Update followUpText.value with the value on the right.
    followUpText.value = 'show the next page'
    // Call askFollowUp to run this step.
    askFollowUp()
  }
  // Store searchQuery as state so Vue reacts when it changes.
  const searchQuery = ref('')
  // Store aiMode as state so Vue reacts when it changes.
  const aiMode = ref(true)
  // Store aiLoading as state so Vue reacts when it changes.
  const aiLoading = ref(false)
  // Store slowSearch as state so Vue reacts when it changes.
  const slowSearch = ref(false)
  // Define slowSearchTimer for the steps below.
  let slowSearchTimer: ReturnType<typeof setTimeout> | undefined
  // Define aiController for the steps below.
  let aiController: AbortController | undefined
  // Define the helper that will toggle aimode.
  function toggleAIMode() {
    // Define question for the steps below.
    const question = searchQuery.value
    // Call clearAISearch to run this step.
    clearAISearch()
    // Update aiMode.value with the value on the right.
    aiMode.value = !aiMode.value
    // Update searchQuery.value with the value on the right.
    searchQuery.value = question
  }
  // Define the helper that will clear aisearch.
  function clearAISearch() {
    // Check whether slowSearchTimer before running this branch.
    if (slowSearchTimer) clearTimeout(slowSearchTimer)
    // Update slowSearch.value with the value on the right.
    slowSearch.value = false
    // Call aiController?.abort to run this step.
    aiController?.abort()
    // Update aiController with the value on the right.
    aiController = undefined
    // Update aiLoading.value with the value on the right.
    aiLoading.value = false
    // Update conversationId.value with the value on the right.
    conversationId.value = undefined
    // Update followUpText.value with the value on the right.
    followUpText.value = ''
    // Update turnHistory.value with the value on the right.
    turnHistory.value = []
    // Update lastAIQuestion.value with the value on the right.
    lastAIQuestion.value = ''
    // Update resultQuestion.value with the value on the right.
    resultQuestion.value = ''
    // Update printError.value with the value on the right.
    printError.value = ''
    // Update searchQuery.value with the value on the right.
    searchQuery.value = ''
    // Update needsSignIn.value with the value on the right.
    needsSignIn.value = false
    // Update aiError.value with the value on the right.
    aiError.value = ''
    // Update aiV1Response.value with the value on the right.
    aiV1Response.value = null
    // Update aiResults.value with the value on the right.
    aiResults.value = []
    // Update aiProjects.value with the value on the right.
    aiProjects.value = []
    // Update aiResultOperation.value with the value on the right.
    aiResultOperation.value = ''
    // Update aiRequestedChartType.value with the value on the right.
    aiRequestedChartType.value = undefined
    // Update aiAnalyticsPlan.value with the value on the right.
    aiAnalyticsPlan.value = null
    // Update aiAnalyticsRows.value with the value on the right.
    aiAnalyticsRows.value = []
    // Update aiAnalyticsSummary.value with the value on the right.
    aiAnalyticsSummary.value = null
    // Update aiStudentCount.value with the value on the right.
    aiStudentCount.value = null
    // Update aiResultSemester.value with the value on the right.
    aiResultSemester.value = ''
  }
  // Store aiError as state so Vue reacts when it changes.
  const aiError = ref('')
  // Store needsSignIn as state so Vue reacts when it changes.
  const needsSignIn = ref(false)
  // Define signInDraftKey for the steps below.
  const signInDraftKey = 'esa-ai-sign-in-draft'

  // Define the helper that will save sign in draft.
  function saveSignInDraft() {
    // Call sessionStorage.setItem to run this step.
    sessionStorage.setItem(signInDraftKey, searchQuery.value)
  }

  // Call onMounted to run this step.
  onMounted(() => {
    // Check whether props.assistantOnly before running this branch.
    if (props.assistantOnly) return
    // Use sessionStorage.getItem to initialize draft.
    const draft = sessionStorage.getItem(signInDraftKey)
    // Check whether draft === null before running this branch.
    if (draft === null) return
    // Call sessionStorage.removeItem to run this step.
    sessionStorage.removeItem(signInDraftKey)
    // Update aiMode.value with the value on the right.
    aiMode.value = true
    // Update searchQuery.value with the value on the right.
    searchQuery.value = draft
  })
  // Store aiV1Response as state so Vue reacts when it changes.
  const aiV1Response = ref<V1Presentation | null>(null)
  // Store aiRequestedChartType as state so Vue reacts when it changes.
  const aiRequestedChartType = ref<AIChartType | undefined>()
  // Store aiResults as state so Vue reacts when it changes.
  const aiResults = ref<{ label: string; count: number }[]>([])
  // Store aiAnalyticsSource as state so Vue reacts when it changes.
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

  // Store aiAnalyticsPlan as state so Vue reacts when it changes.
  const aiAnalyticsPlan = ref<AnalyticsPlanView | null>(null)
  // Store aiAnalyticsRows as state so Vue reacts when it changes.
  const aiAnalyticsRows = ref<AnalyticsRow[]>([])
  // Store aiAnalyticsSummary as state so Vue reacts when it changes.
  const aiAnalyticsSummary = ref<{ label: string; value: number } | null>(null)

  // Recalculate aiAnalyticsLabel when the values it reads change.
  const aiAnalyticsLabel = computed(() => {
    // Define labels for the steps below.
    const labels: Record<string, string> = {
      projects: 'Projects',
      semesters: 'Semesters',
      partners: 'Partners',
      teams: 'Teams',
    }

    // Pass labels[aiAnalyticsSource.value] ?? 'Records' back to the caller.
    return labels[aiAnalyticsSource.value] ?? 'Records'
  })
  // Recalculate aiAnalyticsView when the values it reads change.
  const aiAnalyticsView = computed(() => {
    // Define plan for the steps below.
    const plan = aiAnalyticsPlan.value
    // Check whether !plan before running this branch.
    if (!plan) return 'empty'
    // Pass legacyAnalyticsView(plan.dimensions.length, plan.metrics.length, plan.chartType) back to the caller.
    return legacyAnalyticsView(plan.dimensions.length, plan.metrics.length, plan.chartType)
  })
  // Recalculate aiAnalyticsColumns when the values it reads change.
  const aiAnalyticsColumns = computed<AnalyticsColumn[]>(() => {
    // Define plan for the steps below.
    const plan = aiAnalyticsPlan.value
    // Check whether !plan before running this branch.
    if (!plan) return []

    // Pass [ ...plan.dimensions.map((field) => ({ key: field, label: analyticsFieldLabel(field), field, kind: ' back to the caller.
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
  // Define chartPalette for the steps below.
  const chartPalette = ['#075b91', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d']
  // Recalculate aiAnalyticsChartType when the values it reads change.
  const aiAnalyticsChartType = computed<AIChartType>(() =>
    aiAnalyticsView.value === 'table' || aiAnalyticsView.value === 'summary'
      ? 'bar'
      : aiAnalyticsView.value === 'bar' && !aiAnalyticsPlan.value?.chartType
        ? 'horizontalBar'
        : (aiAnalyticsView.value as AIChartType)
  )
  // Recalculate aiAnalyticsChartRenderType when the values it reads change.
  const aiAnalyticsChartRenderType = computed<ChartJsType>(() =>
    chartRenderType(aiAnalyticsChartType.value)
  )
  // Recalculate aiAnalyticsChartData when the values it reads change.
  const aiAnalyticsChartData = computed(() => {
    // Define plan for the steps below.
    const plan = aiAnalyticsPlan.value
    // Define dimension for the steps below.
    const dimension = plan?.dimensions[0]
    // Use aiAnalyticsRows.value.map to initialize labels.
    const labels = aiAnalyticsRows.value.map((row) =>
      formatAnalyticsValue(dimension ?? '', row[dimension ?? ''])
    )
    // Use (plan?.metrics ?? []).map to initialize series.
    const series = (plan?.metrics ?? []).map((metric) => ({
      label: analyticsMetricLabel(metric),
      values: aiAnalyticsRows.value.map((row) => Number(row[metric.alias] ?? 0)),
    }))
    // Pass buildAIChartSeriesData(labels, series, aiAnalyticsChartType.value) back to the caller.
    return buildAIChartSeriesData(labels, series, aiAnalyticsChartType.value)
  })
  // Recalculate aiAnalyticsChartStyle when the values it reads change.
  const aiAnalyticsChartStyle = computed(() => ({
    position: 'relative',
    width: '100%',
    minWidth: '0',
    height: `${Math.min(520, Math.max(240, aiAnalyticsRows.value.length * 42 + 48))}px`,
    overflow: 'hidden',
  }))
  // Recalculate aiAnalyticsChartOptions when the values it reads change.
  const aiAnalyticsChartOptions = computed(() =>
    buildAIChartOptions(
      aiAnalyticsChartType.value,
      aiAnalyticsChartData.value.labels ?? [],
      aiAnalyticsPlan.value?.metrics.length ?? 1
    )
  )
  // Store aiResultSemester as state so Vue reacts when it changes.
  const aiResultSemester = ref('')
  // Store aiStudentCount as state so Vue reacts when it changes.
  const aiStudentCount = ref<number | null>(null)
  // Store aiResultOperation as state so Vue reacts when it changes.
  const aiResultOperation = ref('')
  type AIProject = {
    id: string
    name: string
    description: string
    type: string
    status: string
  }

  // Store aiProjects as state so Vue reacts when it changes.
  const aiProjects = ref<AIProject[]>([])

  // Recalculate aiResultsChart when the values it reads change.
  const aiResultsChart = computed(() =>
    buildLegacyEnrollmentChart(aiResults.value, aiRequestedChartType.value)
  )
  // Recalculate aiResultsChartType when the values it reads change.
  const aiResultsChartType = computed<AIChartType>(() => aiResultsChart.value?.type ?? 'bar')
  // Recalculate aiResultsChartSupported when the values it reads change.
  const aiResultsChartSupported = computed(() => aiResultsChart.value !== undefined)
  // Recalculate aiResultsChartRenderType when the values it reads change.
  const aiResultsChartRenderType = computed<ChartJsType>(() =>
    chartRenderType(aiResultsChartType.value)
  )
  // Recalculate aiResultsChartData when the values it reads change.
  const aiResultsChartData = computed(() =>
    buildAIChartData(
      aiResultsChart.value?.labels ?? [],
      aiResultsChart.value?.values ?? [],
      aiResultsChartType.value,
      'Students'
    )
  )
  // Recalculate aiResultsChartOptions when the values it reads change.
  const aiResultsChartOptions = computed(() =>
    buildAIChartOptions(aiResultsChartType.value, aiResultsChartData.value.labels ?? [])
  )

  // Define the helper that will content href.
  function contentHref(reference: { type: string; id: string; semesterId?: string; url?: string }) {
    // Check whether reference.type === 'external' before running this branch.
    if (reference.type === 'external') return reference.url ?? '#'
    // Pass `/database-redesign?${reference.type}=${encodeURIComponent(reference.id)}${reference.semesterId ? `& back to the caller.
    return `/database-redesign?${reference.type}=${encodeURIComponent(reference.id)}${reference.semesterId ? `&semester=${encodeURIComponent(reference.semesterId)}` : ''}`
  }
  // Define the helper that will content references.
  function contentReferences(
    row: NonNullable<V1Presentation['result']>['rows'][number],
    field: string
  ) {
    // Pass row.references?.filter((reference) => reference.field === field) ?? [] back to the caller.
    return row.references?.filter((reference) => reference.field === field) ?? []
  }
  // Store customXLabel as state so Vue reacts when it changes.
  const customXLabel = ref('')
  // Store customYLabel as state so Vue reacts when it changes.
  const customYLabel = ref('')
  // Run the callback when the watched values change.
  watch(aiV1Response, (result) => {
    // Update customXLabel.value with the value on the right.
    customXLabel.value = result?.axisLabels?.x ?? ''
    // Update customYLabel.value with the value on the right.
    customYLabel.value = result?.axisLabels?.y ?? ''
  })
  // Recalculate aiV1ChartType when the values it reads change.
  const aiV1ChartType = computed<AIChartType>(
    () => aiV1Response.value?.plot?.type ?? aiV1Response.value?.chart?.type ?? 'bar'
  )
  // Recalculate aiV1ChartRenderType when the values it reads change.
  const aiV1ChartRenderType = computed<ChartJsType>(() => chartRenderType(aiV1ChartType.value))
  // Recalculate aiV1ChartData when the values it reads change.
  const aiV1ChartData = computed(() => {
    // Define plot for the steps below.
    const plot = aiV1Response.value?.plot
    // Check whether plot before running this branch.
    if (plot)
      // Pass { datasets: plot.points.map((point, index) => ({ label: point.label, data: [point], backgroundColor: back to the caller.
      return {
        datasets: plot.points.map((point, index) => ({
          label: point.label,
          data: [point],
          backgroundColor: `hsl(${(index * 137.5) % 360} 55% 45%)`,
        })),
      } as ChartData<ChartJsType>
    // Define chart for the steps below.
    const chart = aiV1Response.value?.chart
    // Pass buildAIChartSeriesData(chart?.labels ?? [], chart?.series ?? [], aiV1ChartType.value) back to the caller.
    return buildAIChartSeriesData(chart?.labels ?? [], chart?.series ?? [], aiV1ChartType.value)
  })
  // Recalculate aiV1ChartOptions when the values it reads change.
  const aiV1ChartOptions = computed(() => {
    // Define response for the steps below.
    const response = aiV1Response.value
    // Check whether response?.plot before running this branch.
    if (response?.plot)
      // Pass { responsive: true, maintainAspectRatio: false, scales: { x: { min: response.axisLabels?.xMin, max:  back to the caller.
      return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            min: response.axisLabels?.xMin,
            max: response.axisLabels?.xMax,
            title: { display: true, text: customXLabel.value || response.plot.xLabel },
          },
          y: {
            min: response.axisLabels?.yMin,
            max: response.axisLabels?.yMax,
            title: { display: true, text: customYLabel.value || response.plot.yLabel },
          },
        },
        plugins: { legend: { display: false } },
      } as ChartOptions<ChartJsType>
    // Define options for the steps below.
    const options = buildAIChartOptions(
      aiV1ChartType.value,
      aiV1ChartData.value.labels ?? [],
      response?.chart?.series.length ?? 1
    ) as any
    // Check whether options.scales before running this branch.
    if (options.scales) {
      // Use response?.result?.columns.find to initialize dimension.
      const dimension = response?.result?.columns.find((column) => column.role === 'dimension')
      // Use response?.result?.columns.find to initialize metric.
      const metric = response?.result?.columns.find((column) => column.role === 'metric')
      // Define horizontal for the steps below.
      const horizontal = aiV1ChartType.value === 'horizontalBar'
      // Define xDefault for the steps below.
      const xDefault = horizontal ? metric?.label : dimension?.label
      // Define yDefault for the steps below.
      const yDefault = horizontal ? dimension?.label : metric?.label
      // Update options.scales.x with the value on the right.
      options.scales.x = {
        ...options.scales.x,
        title: { display: true, text: customXLabel.value || xDefault || '' },
      }
      // Update options.scales.y with the value on the right.
      options.scales.y = {
        ...options.scales.y,
        min: response?.axisLabels?.yMin,
        max: response?.axisLabels?.yMax,
        title: { display: true, text: customYLabel.value || yDefault || '' },
      }
      // Check whether horizontal before running this branch.
      if (horizontal)
        // Update options.scales.x with the value on the right.
        options.scales.x = {
          ...options.scales.x,
          min: response?.axisLabels?.xMin,
          max: response?.axisLabels?.xMax,
        }
    }
    // Pass options back to the caller.
    return options
  })
  // Recalculate aiV1StatusLabel when the values it reads change.
  const aiV1StatusLabel = computed(() => {
    // Define labels for the steps below.
    const labels: Record<string, string> = {
      answer: 'Answer',
      no_data: 'No matching records',
      privacy_restricted: 'Privacy restricted',
      clarification_needed: 'Clarification needed',
      unsupported_capability: 'Unsupported request',
      execution_error: 'Search error',
    }
    // Pass labels[aiV1Response.value?.status ?? ''] ?? 'AI results' back to the caller.
    return labels[aiV1Response.value?.status ?? ''] ?? 'AI results'
  })

  // Define the helper that will chart render type.
  function chartRenderType(type: AIChartType): ChartJsType {
    // Check whether type === 'area' before running this branch.
    if (type === 'area') return 'line'
    // Check whether type === 'horizontalBar' || type === 'stackedBar' before running this branch.
    if (type === 'horizontalBar' || type === 'stackedBar') return 'bar'
    // Check whether type === 'table' || type === 'sankey' before running this branch.
    if (type === 'table' || type === 'sankey') return 'bar'
    // Pass type back to the caller.
    return type
  }

  // Define the helper that will build aichart data.
  function buildAIChartData(
    labels: string[],
    values: number[],
    type: AIChartType,
    label: string
  ): ChartData<ChartJsType> {
    // Pass buildAIChartSeriesData(labels, [{ label, values }], type) back to the caller.
    return buildAIChartSeriesData(labels, [{ label, values }], type)
  }

  // Define the helper that will build aichart series data.
  function buildAIChartSeriesData(
    labels: string[],
    series: Array<{ label: string; values: number[] }>,
    type: AIChartType
  ): ChartData<ChartJsType> {
    // Use ['pie', 'doughnut', 'polarArea'].includes to initialize isCircular.
    const isCircular = ['pie', 'doughnut', 'polarArea'].includes(type)
    // Use series.map to initialize datasets.
    const datasets = series.map(({ label, values }, seriesIndex) => {
      // Define data for the steps below.
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
      // Define color for the steps below.
      const color = chartPalette[seriesIndex % chartPalette.length] ?? '#075b91'
      // Pass { label, data, backgroundColor: isCircular ? chartPalette : type === 'area' ? `${color}33` : color,  back to the caller.
      return {
        label,
        data,
        backgroundColor: isCircular ? chartPalette : type === 'area' ? `${color}33` : color,
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
    // Pass { labels, datasets } as unknown as ChartData<ChartJsType> back to the caller.
    return { labels, datasets } as unknown as ChartData<ChartJsType>
  }

  // Define the helper that will build aichart options.
  function buildAIChartOptions(
    type: AIChartType,
    labels: string[],
    seriesCount = 1
  ): ChartOptions<ChartJsType> {
    // Use chartRenderType to initialize renderType.
    const renderType = chartRenderType(type)
    // Define showLegend for the steps below.
    const showLegend =
      ['pie', 'doughnut', 'polarArea', 'radar'].includes(type) ||
      (seriesCount > 1 && ['line', 'area', 'stackedBar'].includes(type))
    // Define base for the steps below.
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
    // Check whether type === 'pie' || type === 'doughnut' before running this branch.
    if (type === 'pie' || type === 'doughnut') {
      // Pass base as unknown as ChartOptions<ChartJsType> back to the caller.
      return base as unknown as ChartOptions<ChartJsType>
    }
    // Check whether type === 'radar' || type === 'polarArea' before running this branch.
    if (type === 'radar' || type === 'polarArea') {
      // Pass { ...base, scales: { r: { beginAtZero: true } }, } as unknown as ChartOptions<ChartJsType> back to the caller.
      return {
        ...base,
        scales: { r: { beginAtZero: true } },
      } as unknown as ChartOptions<ChartJsType>
    }
    // Check whether type === 'scatter' || type === 'bubble' before running this branch.
    if (type === 'scatter' || type === 'bubble') {
      // Pass { ...base, scales: { x: { type: 'linear', ticks: { callback: (index: number) => labels[index] ?? ''  back to the caller.
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
    // Define isStacked for the steps below.
    const isStacked = type === 'stackedBar'
    // Define isHorizontal for the steps below.
    const isHorizontal = type === 'horizontalBar'
    // Define scales for the steps below.
    const scales = isHorizontal
      ? {
          x: { beginAtZero: true, stacked: isStacked, grid: { color: '#edf0f2' } },
          y: { stacked: isStacked, grid: { display: false } },
        }
      : {
          x: { stacked: isStacked, grid: { display: false } },
          y: { beginAtZero: true, stacked: isStacked, grid: { color: '#edf0f2' } },
        }
    // Pass { ...base, scales } as unknown as ChartOptions<ChartJsType> back to the caller.
    return { ...base, scales } as unknown as ChartOptions<ChartJsType>
  }

  // Define the helper that will run aisearch.
  async function runAISearch() {
    // Use searchQuery.value.trim to initialize question.
    const question = searchQuery.value.trim()

    // Check whether !question || aiLoading.value before running this branch.
    if (!question || aiLoading.value) return

    // Define previousQuestion for the steps below.
    const previousQuestion = undefined
    // Update lastAIQuestion.value with the value on the right.
    lastAIQuestion.value = question
    // Update resultQuestion.value with the value on the right.
    resultQuestion.value = question
    // Update printError.value with the value on the right.
    printError.value = ''
    // Define controller for the steps below.
    const controller = new AbortController()
    // Update aiController with the value on the right.
    aiController = controller
    // Update aiLoading.value with the value on the right.
    aiLoading.value = true
    // Update slowSearch.value with the value on the right.
    slowSearch.value = false
    // Check whether slowSearchTimer before running this branch.
    if (slowSearchTimer) clearTimeout(slowSearchTimer)
    // Update slowSearchTimer with the value on the right.
    slowSearchTimer = setTimeout(() => {
      // Check whether aiController === controller before running this branch.
      if (aiController === controller) slowSearch.value = true
    }, 3000)
    // Update needsSignIn.value with the value on the right.
    needsSignIn.value = false
    // Update aiError.value with the value on the right.
    aiError.value = ''
    // Update aiV1Response.value with the value on the right.
    aiV1Response.value = null
    // Update aiResults.value with the value on the right.
    aiResults.value = []
    // Update aiProjects.value with the value on the right.
    aiProjects.value = []
    // Update aiResultSemester.value with the value on the right.
    aiResultSemester.value = ''
    // Update aiStudentCount.value with the value on the right.
    aiStudentCount.value = null
    // Update aiResultOperation.value with the value on the right.
    aiResultOperation.value = ''
    // Update aiRequestedChartType.value with the value on the right.
    aiRequestedChartType.value = undefined
    // Update aiAnalyticsPlan.value with the value on the right.
    aiAnalyticsPlan.value = null
    // Update aiAnalyticsRows.value with the value on the right.
    aiAnalyticsRows.value = []
    // Update aiAnalyticsSummary.value with the value on the right.
    aiAnalyticsSummary.value = null

    try {
      // Define rawResponse for the steps below.
      const rawResponse = await $fetch<unknown>('/api/ai/ask', {
        method: 'POST',
        signal: controller.signal,
        body: {
          question,
          previousQuestion,
          conversationId: conversationId.value,
          workspace: { semesters, students, projects, partners, teams, choices },
          selectedSemester: selectedSemester.value,
        },
      })

      // Check whether aiController !== controller before running this branch.
      if (aiController !== controller) return
      // Check whether rawResponse && typeof rawResponse === 'object' && 'conversationId' in rawResponse && typeof rawRespo before running this branch.
      if (
        rawResponse &&
        typeof rawResponse === 'object' &&
        'conversationId' in rawResponse &&
        typeof rawResponse.conversationId === 'string'
      )
        // Update conversationId.value with the value on the right.
        conversationId.value = rawResponse.conversationId
      // Use normalizeV1Response to initialize v1Response.
      const v1Response = normalizeV1Response(rawResponse)
      // Check whether v1Response before running this branch.
      if (v1Response) {
        // Update aiV1Response.value with the value on the right.
        aiV1Response.value = v1Response
        // Update turnHistory.value with the value on the right.
        turnHistory.value = [
          ...turnHistory.value,
          { question, status: v1Response.status, explanation: v1Response.explanation },
        ].slice(-12)
        return
      }

      // Check whether !isLegacyAIResponse(rawResponse) before running this branch.
      if (!isLegacyAIResponse(rawResponse)) {
        // Update aiError.value with the value on the right.
        aiError.value = 'The AI search returned an unsupported response. Please try again.'
        return
      }
      // Define response for the steps below.
      const response = rawResponse
      /* Legacy response handling below intentionally retains its existing shape. */
      const legacyResponse = response

      // Check whether !legacyResponse.data before running this branch.
      if (!legacyResponse.data) {
        // Update aiError.value with the value on the right.
        aiError.value = 'This question is not supported yet.'
        return
      }

      // Update aiResultOperation.value with the value on the right.
      aiResultOperation.value = legacyResponse.plan.operation
      // Update aiRequestedChartType.value with the value on the right.
      aiRequestedChartType.value = legacyResponse.plan.chartType
      // Update aiResultSemester.value with the value on the right.
      aiResultSemester.value = legacyResponse.data.semester ?? ''

      // Handle generalized analytical results.
      if (legacyResponse.plan.operation === 'analytics') {
        // Define { plan, data } for the steps below.
        const { plan, data } = legacyResponse
        // Define supportedSources for the steps below.
        const supportedSources = ['projects', 'partners', 'teams', 'semesters']
        // Check whether !plan.source || !supportedSources.includes(plan.source) || !Array.isArray(plan.dimensions) || !Array before running this branch.
        if (
          !plan.source ||
          !supportedSources.includes(plan.source) ||
          !Array.isArray(plan.dimensions) ||
          !Array.isArray(plan.metrics) ||
          !normalizeAnalyticsResponse(plan, data)
        ) {
          // Update aiError.value with the value on the right.
          aiError.value = 'The analytics response did not match its approved query plan.'
          return
        }
        // Update aiAnalyticsSource.value with the value on the right.
        aiAnalyticsSource.value = plan.source
        return
      }

      // Check whether legacyResponse.plan.operation === 'count_projects' || legacyResponse.plan.operation === 'count' before running this branch.
      if (
        legacyResponse.plan.operation === 'count_projects' ||
        legacyResponse.plan.operation === 'count'
      ) {
        // Update aiStudentCount.value with the value on the right.
        aiStudentCount.value = legacyResponse.data.count ?? null
        // Update aiResultOperation.value with the value on the right.
        aiResultOperation.value = 'count_projects'
        return
      }

      // Check whether legacyResponse.plan.operation === 'count_students' before running this branch.
      if (legacyResponse.plan.operation === 'count_students') {
        // Update aiStudentCount.value with the value on the right.
        aiStudentCount.value = legacyResponse.data.count ?? null
      } else if (legacyResponse.plan.operation === 'student_count_by_major') {
        // Update aiResults.value with the value on the right.
        aiResults.value = (legacyResponse.data.results ?? [])
          .filter((item): item is { major: string; count: number } => 'major' in item)
          .map((item) => ({
            label: item.major,
            count: item.count,
          }))
      } else if (legacyResponse.plan.operation === 'student_count_by_year') {
        // Update aiResults.value with the value on the right.
        aiResults.value = (legacyResponse.data.results ?? [])
          .filter((item): item is { year: string; count: number } => 'year' in item)
          .map((item) => ({
            label: item.year,
            count: item.count,
          }))
      } else if (legacyResponse.plan.operation === 'search_projects') {
        // Update aiProjects.value with the value on the right.
        aiProjects.value = (legacyResponse.data.results ?? []).filter(
          (item): item is AIProject => 'id' in item
        )
      } else {
        // Update aiError.value with the value on the right.
        aiError.value = 'This question is not supported yet.'
      }
    } catch (error) {
      // Check whether aiController !== controller before running this branch.
      if (aiController !== controller) return
      // Define status for the steps below.
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status
      // Update needsSignIn.value with the value on the right.
      needsSignIn.value = status === 401
      // Update aiError.value with the value on the right.
      aiError.value =
        status === 401
          ? 'Sign in to ESA to use AI search.'
          : status === 403
            ? 'AI search requires an administrator account.'
            : status === 422
              ? 'This question or result shape is not supported yet.'
              : 'Unable to process your question. Please try again.'
      // Call console.error to run this step.
      console.error('AI search failed:', error)
    } finally {
      // Check whether aiController === controller before running this branch.
      if (aiController === controller) {
        // Update aiController with the value on the right.
        aiController = undefined
        // Update aiLoading.value with the value on the right.
        aiLoading.value = false
        // Update slowSearch.value with the value on the right.
        slowSearch.value = false
        // Check whether slowSearchTimer before running this branch.
        if (slowSearchTimer) clearTimeout(slowSearchTimer)
      }
    }
  }

  // Define the helper that will normalize analytics response.
  function normalizeAnalyticsResponse(
    plan: {
      source: string
      dimensions: string[]
      metrics: AnalyticsMetric[]
      chartType?: AIChartType
    },
    data: Record<string, unknown>
  ): boolean {
    // Check whether plan.metrics.length < 1 || plan.dimensions.length > 3 before running this branch.
    if (plan.metrics.length < 1 || plan.dimensions.length > 3) return false
    // Check whether plan.source === 'enrollments' || plan.source === 'memberships' || plan.source === 'choices' before running this branch.
    if (plan.source === 'enrollments' || plan.source === 'memberships' || plan.source === 'choices')
      // Pass false back to the caller.
      return false
    // Define dimensionKeys for the steps below.
    const dimensionKeys = new Set(plan.dimensions)
    // Check whether dimensionKeys.size !== plan.dimensions.length || plan.metrics.some((metric) => dimensionKeys.has(met before running this branch.
    if (
      dimensionKeys.size !== plan.dimensions.length ||
      plan.metrics.some((metric) => dimensionKeys.has(metric.alias))
    )
      // Pass false back to the caller.
      return false
    // Update aiAnalyticsSource.value with the value on the right.
    aiAnalyticsSource.value = plan.source

    // Define normalizedPlan for the steps below.
    const normalizedPlan: AnalyticsPlanView = {
      source: plan.source,
      dimensions: [...plan.dimensions],
      metrics: plan.metrics.map((metric) => ({ ...metric })),
      ...(plan.chartType ? { chartType: plan.chartType } : {}),
    }
    // Check whether plan.dimensions.length > 0 && !Array.isArray(data.results) before running this branch.
    if (plan.dimensions.length > 0 && !Array.isArray(data.results)) return false
    // Define rows for the steps below.
    const rows = Array.isArray(data.results) ? data.results : []

    // Check whether plan.dimensions.length === 0 && plan.metrics.length === 1 before running this branch.
    if (plan.dimensions.length === 0 && plan.metrics.length === 1) {
      // Define metric for the steps below.
      const metric = plan.metrics[0]
      // Define value for the steps below.
      const value = metric ? data[metric.alias] : undefined
      // Check whether typeof value !== 'number' || !Number.isFinite(value) before running this branch.
      if (typeof value !== 'number' || !Number.isFinite(value)) return false
      // Update aiAnalyticsPlan.value with the value on the right.
      aiAnalyticsPlan.value = normalizedPlan
      // Update aiAnalyticsSummary.value with the value on the right.
      aiAnalyticsSummary.value = {
        label: metric ? analyticsMetricLabel(metric) : 'Result',
        value,
      }
      // Pass true back to the caller.
      return true
    }

    // Define selectedKeys for the steps below.
    const selectedKeys = [...plan.dimensions, ...plan.metrics.map((metric) => metric.alias)]
    // Define normalizedRows for the steps below.
    const normalizedRows: AnalyticsRow[] = []
    // Repeat the following steps for each item in rows.
    for (const rawRow of rows) {
      // Check whether typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow) before running this branch.
      if (typeof rawRow !== 'object' || rawRow === null || Array.isArray(rawRow)) return false
      // Define normalized for the steps below.
      const normalized: AnalyticsRow = {}
      // Repeat the following steps for each item in plan.dimensions.
      for (const field of plan.dimensions) {
        // Define value for the steps below.
        const value = rawRow[field]
        // Check whether typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' before running this branch.
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
          // Pass false back to the caller.
          return false
        // Update normalized[field] with the value on the right.
        normalized[field] = value
      }
      // Repeat the following steps for each item in plan.metrics.
      for (const metric of plan.metrics) {
        // Define value for the steps below.
        const value = rawRow[metric.alias]
        // Check whether typeof value !== 'number' || !Number.isFinite(value) before running this branch.
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        // Update normalized[metric.alias] with the value on the right.
        normalized[metric.alias] = value
      }
      // Call normalizedRows.push to run this step.
      normalizedRows.push(Object.fromEntries(selectedKeys.map((key) => [key, normalized[key]])))
    }

    // Check whether plan.dimensions.length === 0 && normalizedRows.length === 0 before running this branch.
    if (plan.dimensions.length === 0 && normalizedRows.length === 0) {
      // Define normalized for the steps below.
      const normalized: AnalyticsRow = {}
      // Repeat the following steps for each item in plan.metrics.
      for (const metric of plan.metrics) {
        // Define value for the steps below.
        const value = data[metric.alias]
        // Check whether typeof value !== 'number' || !Number.isFinite(value) before running this branch.
        if (typeof value !== 'number' || !Number.isFinite(value)) return false
        // Update normalized[metric.alias] with the value on the right.
        normalized[metric.alias] = value
      }
      // Call normalizedRows.push to run this step.
      normalizedRows.push(normalized)
    }

    // Update aiAnalyticsPlan.value with the value on the right.
    aiAnalyticsPlan.value = normalizedPlan
    // Update aiAnalyticsRows.value with the value on the right.
    aiAnalyticsRows.value = normalizedRows
    // Pass true back to the caller.
    return true
  }

  // Define the helper that will analytics field label.
  function analyticsFieldLabel(field: string): string {
    // Define labels for the steps below.
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
    // Pass labels[field] ?? field.split('.').map(toTitleCase).join(' - ') back to the caller.
    return labels[field] ?? field.split('.').map(toTitleCase).join(' - ')
  }

  // Define the helper that will analytics metric label.
  function analyticsMetricLabel(metric: AnalyticsMetric): string {
    // Check whether metric.function === 'countDistinct' && metric.field before running this branch.
    if (metric.function === 'countDistinct' && metric.field) {
      // Pass `Distinct ${analyticsFieldLabel(metric.field)}` back to the caller.
      return `Distinct ${analyticsFieldLabel(metric.field)}`
    }
    // Pass `${aiAnalyticsLabel.value} count` back to the caller.
    return `${aiAnalyticsLabel.value} count`
  }

  // Define the helper that will format analytics value.
  function formatAnalyticsValue(field: string, value: unknown): string {
    // Check whether typeof value === 'number' before running this branch.
    if (typeof value === 'number') return value.toLocaleString()
    // Check whether typeof value === 'boolean' before running this branch.
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    // Check whether typeof value !== 'string' before running this branch.
    if (typeof value !== 'string') return '-'

    // Define labels for the steps below.
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
    // Check whether labels[value] before running this branch.
    if (labels[value]) return labels[value]
    // Check whether field === 'season' || field.endsWith('.season') before running this branch.
    if (field === 'season' || field.endsWith('.season')) return toTitleCase(value)
    // Check whether value.startsWith('EPCS_') before running this branch.
    if (value.startsWith('EPCS_')) return value.replace('_', ' ')
    // Check whether /^[A-Z][A-Z0-9_]*$/.test(value) before running this branch.
    if (/^[A-Z][A-Z0-9_]*$/.test(value)) return toTitleCase(value)
    // Pass value back to the caller.
    return value
  }

  // Define the helper that will to title case.
  function toTitleCase(value: string): string {
    // Pass value .toLowerCase() .split(/[_\s]+/) .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1)  back to the caller.
    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ''))
      .join(' ')
  }

  // Store selectedDashboardProjectId as state so Vue reacts when it changes.
  const selectedDashboardProjectId = ref<string | null>(null)

  // Recalculate selectedDashboardProject when the values it reads change.
  const selectedDashboardProject = computed(
    () => projects.find((project) => project.id === selectedDashboardProjectId.value) ?? null
  )

  // Store popupSemester as state so Vue reacts when it changes.
  const popupSemester = ref('')

  // Recalculate popupTeamSkills when the values it reads change.
  const popupTeamSkills = computed(() => {
    // Define project for the steps below.
    const project = selectedDashboardProject.value
    // Check whether !project || !popupSemester.value before running this branch.
    if (!project || !popupSemester.value) return []

    // Define savedSkills for the steps below.
    const savedSkills = project.semesterDetails?.find(
      (detail) => detail.semesterId === popupSemester.value
    )?.teamSkills

    // Check whether savedSkills?.length before running this branch.
    if (savedSkills?.length) return savedSkills

    // Pass Array.from(new Set(popupStudents.value.flatMap((student) => student.skills))).slice(0, 8) back to the caller.
    return Array.from(new Set(popupStudents.value.flatMap((student) => student.skills))).slice(0, 8)
  })

  // Define the helper that will official student id.
  function officialStudentId(name: string) {
    // Use students.filter to initialize matches.
    const matches = students.filter(
      (student) =>
        student.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        student.semesters.includes(popupSemester.value)
    )
    // Pass matches.length === 1 ? matches[0]?.id : undefined back to the caller.
    return matches.length === 1 ? matches[0]?.id : undefined
  }
  // Recalculate popupStudents when the values it reads change.
  const popupStudents = computed(() => {
    // Check whether !selectedDashboardProject.value || !popupSemester.value before running this branch.
    if (!selectedDashboardProject.value || !popupSemester.value) {
      // Pass [] back to the caller.
      return []
    }

    // Define studentIds for the steps below.
    const studentIds = new Set(
      teams
        .filter(
          (team) =>
            team.projectId === selectedDashboardProject.value!.id &&
            team.semesterId === popupSemester.value
        )
        .flatMap((team) => team.studentIds)
    )

    // Pass students .map((student) => getStudentForSemester(student, popupSemester.value)) .filter((student) => back to the caller.
    return students
      .map((student) => getStudentForSemester(student, popupSemester.value))
      .filter((student) => studentIds.has(student.id))
  })

  // Recalculate filteredProjects when the values it reads change.
  const filteredProjects = computed(() => {
    // Check whether aiMode.value before running this branch.
    if (aiMode.value) return semesterProjects.value

    // Use searchQuery.value.trim().toLowerCase to initialize query.
    const query = searchQuery.value.trim().toLowerCase()

    // Check whether !query before running this branch.
    if (!query) return semesterProjects.value

    // Pass semesterProjects.value.filter( (project) => project.name.toLowerCase().includes(query) || (getPartne back to the caller.
    return semesterProjects.value.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (getPartnerById(project.partnerId)?.name ?? '').toLowerCase().includes(query)
    )
  })

  // Recalculate enrollmentSemesterIds when the values it reads change.
  const enrollmentSemesterIds = computed(() =>
    selectedSemester.value === 'all'
      ? semesters.map((semester) => semester.id)
      : [selectedSemester.value]
  )
  // Recalculate semesterStudents when the values it reads change.
  const semesterStudents = computed(() =>
    students
      .filter((student) => student.semesters.some((id) => enrollmentSemesterIds.value.includes(id)))
      .map((student) => getStudentForSemester(student, enrollmentSemesterIds.value))
  )
  // Recalculate semesterProjects when the values it reads change.
  const semesterProjects = computed(() =>
    projects
      .filter(
        (project) =>
          selectedSemester.value === 'all' || project.semesters.includes(selectedSemester.value)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
  )
  // Recalculate returningStudents when the values it reads change.
  const returningStudents = computed(() =>
    semesterStudents.value.filter((student) =>
      selectedSemester.value === 'all'
        ? student.semesters.length > 1
        : student.semesters.indexOf(selectedSemester.value) > 0
    )
  )
  // Recalculate firstTimeStudents when the values it reads change.
  const firstTimeStudents = computed(() =>
    selectedSemester.value === 'all'
      ? semesterStudents.value.filter((student) => student.semesters.length === 1).length
      : semesterStudents.value.length - returningStudents.value.length
  )
  // Recalculate returningPct when the values it reads change.
  const returningPct = computed(() =>
    semesterStudents.value.length
      ? Math.round((returningStudents.value.length / semesterStudents.value.length) * 100)
      : 0
  )
  // Recalculate selectedSemesterLabel when the values it reads change.
  const selectedSemesterLabel = computed(() =>
    selectedSemester.value === 'all' ? 'All semesters' : getSemesterLabel(selectedSemester.value)
  )

  // Semester IDs use SP, SU, FA followed by the two-digit year.
  function semesterOrder(id: string): number {
    // Use Number to initialize year.
    const year = Number(id.slice(-2))
    // Use id.slice to initialize term.
    const term = id.slice(0, -2)
    // Define termOrder for the steps below.
    const termOrder: Record<string, number> = { SP: 1, SU: 2, FA: 3 }
    // Pass year * 10 + (termOrder[term] ?? 0) back to the caller.
    return year * 10 + (termOrder[term] ?? 0)
  }

  // Define the helper that will get dashboard project status.
  function getDashboardProjectStatus(project: Project): Project['status'] {
    // Define semesterId for the steps below.
    const semesterId =
      selectedSemester.value === 'all' ? latestProjectSemester(project) : selectedSemester.value

    // Pass getDashboardProjectStatusForSemester(project, semesterId) back to the caller.
    return getDashboardProjectStatusForSemester(project, semesterId)
  }

  // Recalculate displayedStudents when the values it reads change.
  const displayedStudents = computed(() =>
    semesterStudents.value
      .map((student) => ({ ...student, recordId: student.id }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }))
  )
  // Recalculate recentSemesterEnrollment when the values it reads change.
  const recentSemesterEnrollment = computed(() =>
    [...semesters]
      .sort((a, b) => semesterOrder(b.id) - semesterOrder(a.id))
      .slice(0, 3)
      .map((semester) => ({
        ...semester,
        count: students.filter((student) => student.semesters.includes(semester.id)).length,
      }))
  )

  // Recalculate enrollmentCount when the values it reads change.
  const enrollmentCount = computed(() => semesterStudents.value.length)

  // Recalculate newProjectsCount when the values it reads change.
  const newProjectsCount = computed(() => {
    // Check whether selectedSemester.value === 'all' before running this branch.
    if (selectedSemester.value === 'all') {
      // Pass projects.length back to the caller.
      return projects.length
    }

    // Pass semesterProjects.value.filter( (project) => getDashboardProjectStatusForSemester(project, selectedSe back to the caller.
    return semesterProjects.value.filter(
      (project) => getDashboardProjectStatusForSemester(project, selectedSemester.value) === 'New'
    ).length
  })

  // Recalculate activeProjectsCount when the values it reads change.
  const activeProjectsCount = computed(
    () =>
      semesterProjects.value.filter((project) => {
        // Check whether selectedSemester.value === 'all' before running this branch.
        if (selectedSemester.value === 'all') {
          // Pass project.semesters.some((semesterId) => { const status = getDashboardProjectStatusForSemester(project back to the caller.
          return project.semesters.some((semesterId) => {
            // Use getDashboardProjectStatusForSemester to initialize status.
            const status = getDashboardProjectStatusForSemester(project, semesterId)

            // Pass status === 'New' || status === 'In Progress' back to the caller.
            return status === 'New' || status === 'In Progress'
          })
        }

        // Use getDashboardProjectStatus to initialize status.
        const status = getDashboardProjectStatus(project)

        // Pass status === 'New' || status === 'In Progress' back to the caller.
        return status === 'New' || status === 'In Progress'
      }).length
  )

  // Recalculate stats when the values it reads change.
  const stats = computed(() => [
    {
      label: selectedSemester.value === 'all' ? 'Unique Students' : 'Enrolled Students',
      value: enrollmentCount.value,
      sub:
        selectedSemester.value === 'all'
          ? `${students.reduce((total, student) => total + enrollmentSemesterIds.value.filter((id) => student.semesters.includes(id)).length, 0)} semester enrollments`
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

  // Define the helper that will count students with course.
  function countStudentsWithCourse(course: string) {
    // Pass students.filter((student) => enrollmentSemesterIds.value.some( (id) => student.semesters.includes(id back to the caller.
    return students.filter((student) =>
      enrollmentSemesterIds.value.some(
        (id) =>
          student.semesters.includes(id) &&
          getStudentCourse(getStudentForSemester(student, id)) === course
      )
    ).length
  }
  // Recalculate unknownCourseCount when the values it reads change.
  const unknownCourseCount = computed(() => countStudentsWithCourse('Unknown'))
  // Recalculate courseStats when the values it reads change.
  const courseStats = computed(() => [
    { label: 'EPCS 2200', value: countStudentsWithCourse('EPCS 2200'), tone: 'gold' },
    { label: 'EPCS 3200', value: countStudentsWithCourse('EPCS 3200'), tone: 'teal' },
  ])

  // Define the helper that will is pinned.
  function isPinned(key: string) {
    // Pass props.pinnedItems.some((item) => item.key === key) back to the caller.
    return props.pinnedItems.some((item) => item.key === key)
  }

  // Recalculate resultPinKey when the values it reads change.
  const resultPinKey = computed(() =>
    aiV1Response.value?.result
      ? `ai:${resultQuestion.value}:${JSON.stringify(aiV1Response.value.result.rows.map((row) => row.values))}`
      : ''
  )

  // Define the helper that will pin airesult.
  function pinAIResult() {
    // Check whether !aiV1Response.value?.result || !resultPinKey.value before running this branch.
    if (!aiV1Response.value?.result || !resultPinKey.value) return
    // Define snapshot for the steps below.
    const snapshot = JSON.parse(JSON.stringify(aiV1Response.value)) as V1Presentation
    // Call emit to run this step.
    emit('togglePin', {
      key: resultPinKey.value,
      id: resultPinKey.value,
      type: 'ai',
      title: resultQuestion.value,
      subtitle: 'Saved AI Result',
      snapshot,
    })
    // Check whether props.assistantOnly before running this branch.
    if (props.assistantOnly) emit('navigate', 'dashboard')
  }

  // Define the helper that will open pinned.
  function openPinned(item: PinnedItem) {
    // Check whether item.type === 'ai' && item.snapshot before running this branch.
    if (item.type === 'ai' && item.snapshot) {
      // Call clearAISearch to run this step.
      clearAISearch()
      // Update aiMode.value with the value on the right.
      aiMode.value = true
      // Update resultQuestion.value with the value on the right.
      resultQuestion.value = item.title
      // Update aiV1Response.value with the value on the right.
      aiV1Response.value = item.snapshot
      // Call nextTick to run this step.
      nextTick(() => printedResult.value?.scrollIntoView({ block: 'start' }))
      return
    }
    // Check whether item.type === 'project' before running this branch.
    if (item.type === 'project')
      // Call emit to run this step.
      emit('openProject', item.id, selectedSemester.value === 'all' ? 'FA26' : selectedSemester.value)
    else emit('openInsight', item.id)
  }
  // Run the callback when the watched values change.
  watch(selectedSemester, () => {
    // Check whether !aiMode.value before running this branch.
    if (!aiMode.value) return
    // Define question for the steps below.
    const question = searchQuery.value
    // Call clearAISearch to run this step.
    clearAISearch()
    // Update searchQuery.value with the value on the right.
    searchQuery.value = question
    // Check whether question.trim() before running this branch.
    if (question.trim()) void runAISearch()
  })
</script>

<template>
  <div class="page-shell">
    <div v-if="!assistantOnly" class="page-header">
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
        v-if="aiMode"
        type="button"
        class="secondary-button"
        :disabled="aiLoading || !searchQuery.trim()"
        @click="runAISearch"
        style="margin-right: 8px"
      >
        {{ aiLoading ? 'Searching...' : 'Ask AI' }}
      </button>
      <button
        type="button"
        class="secondary-button"
        aria-label="Clear dashboard search"
        style="margin-right: 8px"
        @click="clearAISearch"
      >
        Clear
      </button>

      <button
        type="button"
        @click="toggleAIMode"
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
        AI Mode
      </button>
    </div>

    <div
      ref="printedResult"
      v-if="aiMode && (aiLoading || aiError || aiResultOperation || aiV1Response)"
      style="
        margin-bottom: 24px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 10px;
        background: white;
      "
    >
      <p v-if="aiLoading" role="status">{{ slowSearch ? 'Still checking this request. The AI service is taking longer than usual...' : 'Checking ESA records...' }}</p>

      <p v-else-if="aiError" style="color: #b91c1c">
        {{ aiError }}
        <a v-if="needsSignIn" href="/auth" class="secondary-button" style="display:inline-block;margin-left:8px" @click="saveSignInDraft">Sign in to ESA</a>
      </p>

      <template v-else>
        <div data-no-print style="display: flex; justify-content: flex-end; margin-bottom: 12px">
          <button v-if="resultPinKey" type="button" class="secondary-button" :aria-pressed="isPinned(resultPinKey)" @click="pinAIResult">
            {{ isPinned(resultPinKey) ? 'Unpin Result' : 'Pin Result' }}
          </button>
          <button
            v-if="aiResultOperation || aiV1Response?.status === 'answer'"
            type="button"
            :disabled="printing"
            @click="printResult"
            style="
              padding: 8px 14px;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              cursor: pointer;
              color: #075b91;
              background: white;
            "
          >
            {{ printing ? 'Opening print preview…' : 'Print result' }}
          </button>
        </div>
        <p v-if="printError" data-no-print role="alert">{{ printError }}</p>
        <p style="font-size: 13px; color: #475569; margin-bottom: 12px">{{ resultQuestion }}</p>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px">
          <div>
            <h3 style="font-size: 19px; font-weight: 650; color: #1e293b; margin: 0">
              AI Insights
            </h3>

            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0">
              {{
                aiV1Response
                  ? aiV1StatusLabel
                  : aiResultOperation === 'analytics'
                    ? `${aiAnalyticsLabel} analytics from ESA database records`
                    : aiResultOperation === 'count_students'
                      ? 'Student enrollment summary'
                      : aiResultOperation === 'student_count_by_year'
                        ? 'Student enrollment by year'
                        : aiResultOperation === 'student_count_by_major'
                          ? 'Student enrollment by major'
                          : 'Results from ESA database records'
              }}
              {{ aiResultSemester ? `- ${aiResultSemester}` : '' }}
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
              color:
                aiV1Response.status === 'privacy_restricted' ||
                aiV1Response.status === 'execution_error'
                  ? '#9f1239'
                  : '#334155',
              marginBottom: '18px',
            }"
          >
            <strong>{{ aiV1StatusLabel }}:</strong> {{ aiV1Response.explanation }}
            <span v-if="aiV1Response.durationMs !== undefined" style="display:block;margin-top:6px;font-size:12px">Response in {{ (aiV1Response.durationMs / 1000).toFixed(1) }}s</span>
          </div>

          <div v-if="aiV1Response.suggestions?.length" data-no-print style="display:flex;flex-wrap:wrap;gap:10px;margin:16px 0">
            <button v-for="suggestion in aiV1Response.suggestions" :key="suggestion" type="button" class="secondary-button" @click="askSuggestion(suggestion)">{{ suggestion }}</button>
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
              {{ aiV1Response.summary.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}{{ aiV1Response.summary.unit === 'percent' ? '%' : '' }}
            </div>
            <p style="margin: 8px 0 0; color: #64748b">
              {{ aiV1Response.summary.label }}
            </p>
          </div>

          <SankeyChart v-if="aiV1Response.sankey" :data="{...aiV1Response.sankey, sourceLabel: aiV1Response.axisLabels?.x || aiV1Response.sankey.sourceLabel, targetLabel: aiV1Response.axisLabels?.y || aiV1Response.sankey.targetLabel}" />

          <details v-if="aiV1Response.plot || (aiV1Response.chart && !['pie','doughnut','polarArea','radar'].includes(aiV1Response.chart.type))" data-no-print style="margin-bottom:16px">
            <summary style="cursor:pointer">Axis titles</summary>
            <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:10px">
              <label>X-axis title <input v-model="customXLabel" maxlength="80" aria-label="X-axis title" class="search-input" /></label>
              <label>Y-axis title <input v-model="customYLabel" maxlength="80" aria-label="Y-axis title" class="search-input" /></label>
            </div>
            <p style="font-size:12px;color:#64748b">To change the data, ask naturally, such as “use majors for x and student count for y.”</p>
          </details>
          <ClientOnly v-if="aiV1Response.chart || aiV1Response.plot">
            <div :style="aiAnalyticsChartStyle" style="max-width: 100%; margin: 8px 0 24px">
              <Chart
                :type="aiV1ChartRenderType"
                :data="aiV1ChartData"
                :options="aiV1ChartOptions"
              />
            </div>
          </ClientOnly>

          <div
            v-if="
              aiV1Response.result && aiV1Response.result.rows.length > 0 && !aiV1Response.summary
            "
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
                      textAlign:
                        column.role === 'metric' || column.role === 'calculation'
                          ? 'right'
                          : 'left',
                      padding: '16px 20px',
                      color: '#475569',
                      fontWeight: 600,
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'normal',
                      maxWidth: '520px',
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
                      color:
                        column.role === 'metric' || column.role === 'calculation'
                          ? '#075b91'
                          : '#334155',
                      fontWeight:
                        column.role === 'metric' || column.role === 'calculation' ? 700 : 500,
                      textAlign:
                        column.role === 'metric' || column.role === 'calculation'
                          ? 'right'
                          : 'left',
                      borderBottom: '1px solid #f1f5f9',
                      whiteSpace: 'normal',
                    }"
                  >
                    <template v-if="contentReferences(row, column.key).length">
                      <span v-if="['comments','notes','description','skills'].includes(column.key)">{{ formatV1Value(column,row.values[column.key]) }}</span>
                      <a v-for="reference in contentReferences(row, column.key)" :key="reference.type + reference.id + reference.semesterId" :href="contentHref(reference)" :target="reference.type === 'external' ? '_blank' : undefined" rel="noopener noreferrer" style="display:block;color:#075b91;text-decoration:underline">{{ reference.label }}<span v-if="contentReferences(row, column.key).length > 1"> — {{ getSemesterLabel(reference.semesterId ?? '') }}</span></a>
                    </template>
                    <template v-else>{{ formatV1Value(column, row.values[column.key]) }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-if="
              aiV1Response.result && (!aiV1Response.result.complete || aiV1Response.result.hasMore)
            "
            style="margin: 12px 0 20px; font-size: 13px; color: #92400e"
          >
            Results are limited: showing {{ aiV1Response.result.rows.length }}
            {{ aiV1Response.result.kind === 'aggregate' ? 'groups' : 'records' }} (limit
            {{ aiV1Response.result.limit }}).
            {{
              aiV1Response.result.hasMore
                ? 'More results are available.'
                : 'The full result exceeded the display limit.'
            }}
          </p>

          <div data-no-print v-if="aiV1Response.result?.hasMore" style="margin:12px 0">
            <button type="button" class="secondary-button" :disabled="aiLoading" @click="loadMoreResults">Next page of results</button>
            <span style="margin-left:12px">{{ aiV1Response.result.totalRows }} total matching rows</span>
          </div>
          <form v-if="conversationId" data-no-print @submit.prevent="askFollowUp" style="display:flex;gap:10px;flex-wrap:wrap;margin:20px 0">
            <label style="flex:1;min-width:220px">Follow up or adjust this result
              <input v-model="followUpText" maxlength="4000" aria-label="Follow up or adjust this result" placeholder="Only first-years, exclude unknowns, make it pie, show their profiles..." class="search-input" style="width:100%;margin-top:6px" />
            </label>
            <button type="submit" class="secondary-button" :disabled="aiLoading || !followUpText.trim()">Ask follow-up</button>
          </form>
          <details data-no-print v-if="turnHistory.length > 1" style="margin:12px 0">
            <summary>Conversation ({{ turnHistory.length }} questions)</summary>
            <ol><li v-for="(turn,index) in turnHistory" :key="index"><strong>{{ turn.question }}</strong> — {{ turn.explanation }}</li></ol>
          </details>
          <p
            v-if="aiV1Response.result"
            style="margin: 12px 0 20px; font-size: 12px; color: #64748b"
          >
            Source: ESA database - {{ aiV1Response.result.model }} records.
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

        <section
          v-if="!aiV1Response && aiResultOperation === 'analytics'"
          style="min-width: 0; width: 100%"
        >
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
            v-if="
              aiAnalyticsView !== 'summary' &&
              aiAnalyticsView !== 'table' &&
              aiAnalyticsRows.length > 0
            "
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
            Source: ESA database - {{ aiAnalyticsLabel }}.
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
            !aiV1Response &&
            ['student_count_by_major', 'student_count_by_year'].includes(aiResultOperation) &&
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
    <template v-if="!assistantOnly">
    <div class="dashboard-stats">
      <div v-for="stat in stats" :key="stat.label" class="stat-card metric-card">
        <div class="metric-value" :class="`metric-${stat.tone}`">{{ stat.value }}</div>
        <div class="metric-label">{{ stat.label }}</div>
        <div class="metric-sub">{{ stat.sub }}</div>
      </div>

      <section v-if="selectedSemester === 'all'" class="stat-card metric-card">
        <h2 class="metric-label">Enrollment by Semester</h2>
        <dl style="display:grid;gap:8px;margin-top:10px">
          <div v-for="semester in recentSemesterEnrollment" :key="semester.id" style="display:flex;justify-content:space-between;gap:8px">
            <dt>{{ semester.label }}</dt><dd class="mono">{{ semester.count }}</dd>
          </div>
        </dl>
      </section>
      <div class="stat-card metric-card course-enrollment-card">
        <div class="metric-label">EPICS Course Enrollment</div>
        <p v-if="selectedSemester === 'all'" class="metric-sub">Unique students per course. Students may appear in both courses.</p>
        <p v-if="unknownCourseCount" class="metric-sub">Course not listed in the source records for {{ unknownCourseCount }} {{ unknownCourseCount === 1 ? 'student' : 'students' }}. Included in enrollment totals.</p>

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
            <p>{{ selectedSemesterLabel }} project roster · Project name A–Z</p>
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
            <tr v-for="project in filteredProjects.slice(0, 10)" :key="project.id">
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
            <tr v-else-if="filteredProjects.length > 10">
              <td colspan="4" class="empty-cell">
                {{ filteredProjects.length - 10 }} more projects available in the Projects view.
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

          <button class="secondary-button" @click="selectedDashboardProjectId = null">Close</button>
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
            Student Roster - {{ getSemesterLabel(popupSemester) }}
          </h3>

          <div
            v-for="student in getOfficialProjectRoster(selectedDashboardProject.id, popupSemester)"
            :key="`official-${student.name}`"
            style="padding: 10px 0; border-bottom: 1px solid #e2e8dc"
          >
            <template v-if="officialStudentId(student.name)">
              <button type="button" class="record-link" @click="emit('openStudent', officialStudentId(student.name)!, popupSemester)">{{ student.name }}</button>
            </template>
            <strong v-else>{{ student.name }}</strong>
            <div style="font-size: 13px; color: #5a6b52">{{ student.major }}</div>
          </div>

          <div
            v-for="student in popupStudents"
            :key="student.id"
            style="padding: 10px 0; border-bottom: 1px solid #e2e8dc"
          >
            <button type="button" class="record-link" @click="emit('openStudent', student.id, popupSemester)">{{ student.name }}</button>
            <div style="font-size: 13px; color: #5a6b52">{{ student.major }}</div>
          </div>

          <p
            v-if="
              popupStudents.length === 0 &&
              !getOfficialProjectRoster(selectedDashboardProject.id, popupSemester).length
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
              )?.contactName || 'Not Provided'
            }}
          </div>

          <div style="font-size: 13px; color: #5a6b52; margin-top: 4px">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.contactEmail || ''
            }}
          </div>

          <div style="font-size: 13px; color: #5a6b52; margin-top: 4px">
            {{
              selectedDashboardProject.semesterDetails?.find(
                (detail) => detail.semesterId === popupSemester
              )?.contactPhone || ''
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
              )?.mentorName || 'Not Assigned'
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
    <div style="margin-top:24px;display:flex;justify-content:flex-end">
      <button class="secondary-button" @click="emit('navigate', 'settings')">Customize Appearance</button>
    </div>
    </template>
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
