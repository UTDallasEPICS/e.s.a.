<script setup lang="ts">
  /**
   * Purpose
   * Summarize enrollment and demographics and export a configurable PDF.
   *
   * Inputs
   * - Semester selection, enrollment records, preferences, and chart settings.
   *
   * Outputs
   * - Counts, charts, student lists, and the optional PDF report.
   *
   * Pseudocode
   * Choose a reporting population → calculate the distributions and rates → draw the charts → export the selected sections.
   */
  import { ref, computed, nextTick, onMounted, watch } from 'vue'
  import ChartFontLibrary from './ChartFontLibrary.vue'
  import { Bar, Pie } from 'vue-chartjs'
  import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Title,
  } from 'chart.js'
  import {
    students,
    semesters,
    choices,
    teams,
    officialDemographics,
    getClassStanding,
    getStudentForSemester,
  } from '../data'
  import type { ColorPalette, GraphDisplaySettings, PinnedItem } from '../types'

  // Call ChartJS.register to run this step.
  ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

  // Define valueLabelsPlugin for the steps below.
  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart: ChartJS) {
      // Check whether !(chart.options.plugins as Record<string, { display?: boolean }> | undefined)?.valueLabels ?.display before running this branch.
      if (
        !(chart.options.plugins as Record<string, { display?: boolean }> | undefined)?.valueLabels
          ?.display
      )
        return
      // Define { ctx } for the steps below.
      const { ctx } = chart
      // Call ctx.save to run this step.
      ctx.save()
      // Update ctx.textAlign with the value on the right.
      ctx.textAlign = 'center'
      // Update ctx.textBaseline with the value on the right.
      ctx.textBaseline = 'bottom'
      // Update ctx.font with the value on the right.
      ctx.font = `700 ${graphValueSize('class')}px ${graphFont('class')}, sans-serif`
      // Update ctx.fillStyle with the value on the right.
      ctx.fillStyle = chartTextColor.value
      // Call chart.data.datasets.forEach to run this step.
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        // Use chart.getDatasetMeta to initialize meta.
        const meta = chart.getDatasetMeta(datasetIndex)
        // Call meta.data.forEach to run this step.
        meta.data.forEach((element, index) => {
          // Use Number to initialize value.
          const value = Number(dataset.data[index] ?? 0)
          // Use element.tooltipPosition to initialize position.
          const position = element.tooltipPosition()
          // Call ctx.fillText to run this step.
          ctx.fillText(String(value), position.x, position.y - 5)
        })
      })
      // Call ctx.restore to run this step.
      ctx.restore()
    },
  }

  // Call ChartJS.register to run this step.
  ChartJS.register(valueLabelsPlugin)

  // Use defineProps to initialize props.
  const props = defineProps<{
    pinnedItems: PinnedItem[]
    initialInsightId?: string | null
    theme: 'light' | 'dark'
    palette: ColorPalette
    graphDisplay: GraphDisplaySettings
  }>()
  // Use defineEmits to initialize emit.
  const emit = defineEmits<{
    togglePin: [item: PinnedItem]
    openStudent: [studentId: string]
    updateColor: [key: keyof ColorPalette, value: string]
    updateGraphSetting: [
      key: keyof GraphDisplaySettings,
      value: GraphDisplaySettings[keyof GraphDisplaySettings],
    ]
  }>()
  // Store timeframeMode as state so Vue reacts when it changes.
  const timeframeMode = ref<'all' | 'single' | 'range'>('single')
  // Use useState to initialize semFilter.
  const semFilter = useState<string>('epics-selected-semester', () => 'FA26')
  // Store rangeStart as state so Vue reacts when it changes.
  const rangeStart = ref('SP26')
  // Store rangeEnd as state so Vue reacts when it changes.
  const rangeEnd = ref('FA26')
  // Store demographicCourse as state so Vue reacts when it changes.
  const demographicCourse = ref('all')
  // Store demographicPeriod as state so Vue reacts when it changes.
  const demographicPeriod = ref('Fall 2026')
  // Store exporting as state so Vue reacts when it changes.
  const exporting = ref(false)
  // Store showReturning as state so Vue reacts when it changes.
  const showReturning = ref(false)
  // Store pdfOpen as state so Vue reacts when it changes.
  const pdfOpen = ref(false)
  // Store pdfOptions as state so Vue reacts when it changes.
  const pdfOptions = ref({
    summary: true,
    standing: true,
    majors: true,
    gender: true,
    race: true,
    orientation: 'portrait' as 'portrait' | 'landscape',
    size: 10,
    bars: true,
  })
  // Define pdfSections for the steps below.
  const pdfSections = [
    { key: 'summary', label: 'Summary Metrics' },
    { key: 'standing', label: 'Class Standing' },
    { key: 'majors', label: 'Major Distribution' },
    { key: 'gender', label: 'Gender Distribution' },
    { key: 'race', label: 'Race & Ethnicity' },
  ] as const
  type GraphKey = 'class' | 'major' | 'gender' | 'race'
  // Store graphPrefs as state so Vue reacts when it changes.
  const graphPrefs = ref<
    Partial<Record<GraphKey, { font?: string; size?: number; labels?: number; values?: number }>>
  >({})
  // Call onMounted to run this step.
  onMounted(() => {
    try {
      // Update graphPrefs.value with the value on the right.
      graphPrefs.value = JSON.parse(localStorage.getItem('esa-insight-graphs') || '{}')
    } catch {
      // Update graphPrefs.value with the value on the right.
      graphPrefs.value = {}
    }
  })
  // Run the callback when the watched values change.
  watch(graphPrefs, (value) => localStorage.setItem('esa-insight-graphs', JSON.stringify(value)), {
    deep: true,
  })
  // Define the helper that will update graph.
  function updateGraph(
    key: GraphKey,
    setting: 'font' | 'size' | 'labels' | 'values',
    value: string | number
  ) {
    // Update graphPrefs.value[key] with the value on the right.
    graphPrefs.value[key] = { ...graphPrefs.value[key], [setting]: value }
  }
  // Define the helper that will graph font.
  function graphFont(key: GraphKey) {
    // Pass graphPrefs.value[key]?.font ?? props.graphDisplay.fontFamily back to the caller.
    return graphPrefs.value[key]?.font ?? props.graphDisplay.fontFamily
  }
  // Define the helper that will graph label size.
  function graphLabelSize(key: GraphKey) {
    // Pass graphPrefs.value[key]?.labels ?? props.graphDisplay.fontSize back to the caller.
    return graphPrefs.value[key]?.labels ?? props.graphDisplay.fontSize
  }
  // Define the helper that will graph value size.
  function graphValueSize(key: GraphKey) {
    // Pass graphPrefs.value[key]?.values ?? props.graphDisplay.valueFontSize back to the caller.
    return graphPrefs.value[key]?.values ?? props.graphDisplay.valueFontSize
  }
  // Define graphColors for the steps below.
  const graphColors = {
    class: [{ key: 'chartGrid', label: 'Grid Lines' }],
    major: [{ key: 'majorChart', label: 'Bars' }],
    gender: [
      { key: 'genderChart', label: 'Male' },
      { key: 'genderChartSecondary', label: 'Female' },
      { key: 'raceChart', label: 'Other' },
    ],
    race: [{ key: 'raceChart', label: 'Bars' }],
  } as const

  // Run the callback when the watched values change.
  watch(
    () => props.initialInsightId,
    async (insightId) => {
      // Check whether !insightId before running this branch.
      if (!insightId) return
      await nextTick()
      // Call document .getElementById(`insight-${insightId}`) ?.scrollIntoView to run this step.
      document
        .getElementById(`insight-${insightId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    { immediate: true }
  )

  // Recalculate selectedSemesterIds when the values it reads change.
  const selectedSemesterIds = computed(() => {
    // Check whether timeframeMode.value === 'all' || (timeframeMode.value === 'single' && semFilter.value === 'all') before running this branch.
    if (
      timeframeMode.value === 'all' ||
      (timeframeMode.value === 'single' && semFilter.value === 'all')
    )
      // Pass semesters.map((semester) => semester.id) back to the caller.
      return semesters.map((semester) => semester.id)
    // Check whether timeframeMode.value === 'single' before running this branch.
    if (timeframeMode.value === 'single') return [semFilter.value]
    // Use semesters.findIndex to initialize startIndex.
    const startIndex = semesters.findIndex((semester) => semester.id === rangeStart.value)
    // Use semesters.findIndex to initialize endIndex.
    const endIndex = semesters.findIndex((semester) => semester.id === rangeEnd.value)
    // Use Math.min to initialize from.
    const from = Math.min(startIndex, endIndex)
    // Use Math.max to initialize to.
    const to = Math.max(startIndex, endIndex)
    // Pass semesters.slice(Math.max(0, from), to + 1).map((semester) => semester.id) back to the caller.
    return semesters.slice(Math.max(0, from), to + 1).map((semester) => semester.id)
  })

  // Recalculate timeframeLabel when the values it reads change.
  const timeframeLabel = computed(() => {
    // Check whether timeframeMode.value === 'all' || (timeframeMode.value === 'single' && semFilter.value === 'all') before running this branch.
    if (
      timeframeMode.value === 'all' ||
      (timeframeMode.value === 'single' && semFilter.value === 'all')
    )
      // Pass 'All semesters' back to the caller.
      return 'All semesters'
    // Check whether timeframeMode.value === 'single' before running this branch.
    if (timeframeMode.value === 'single') {
      // Pass semesters.find((semester) => semester.id === semFilter.value)?.label ?? semFilter.value back to the caller.
      return semesters.find((semester) => semester.id === semFilter.value)?.label ?? semFilter.value
    }
    // Define start for the steps below.
    const start =
      semesters.find((semester) => semester.id === rangeStart.value)?.label ?? rangeStart.value
    // Define end for the steps below.
    const end = semesters.find((semester) => semester.id === rangeEnd.value)?.label ?? rangeEnd.value
    // Pass `${start} – ${end}` back to the caller.
    return `${start} – ${end}`
  })

  // Recalculate filteredStudents when the values it reads change.
  const filteredStudents = computed(() =>
    students
      .map((student) => getStudentForSemester(student, selectedSemesterIds.value))
      .filter((student) =>
        student.semesters.some((semesterId) => selectedSemesterIds.value.includes(semesterId))
      )
  )

  // Recalculate demographicRecords when the values it reads change.
  const demographicRecords = computed(() =>
    officialDemographics.filter(
      (record) =>
        record.period === demographicPeriod.value &&
        (demographicCourse.value === 'all' || record.course === demographicCourse.value)
    )
  )
  // Use Array.from to initialize officialCourses.
  const officialCourses = Array.from(new Set(officialDemographics.map((record) => record.course)))

  // Recalculate officialGender when the values it reads change.
  const officialGender = computed(() =>
    demographicRecords.value.reduce<Record<string, number>>((counts, record) => {
      // Call Object.entries(record.gender).forEach to run this step.
      Object.entries(record.gender).forEach(([label, value]) => {
        // Update counts[label] with the value on the right.
        counts[label] = (counts[label] ?? 0) + value
      })
      // Pass counts back to the caller.
      return counts
    }, {})
  )

  // Recalculate officialEthnicity when the values it reads change.
  const officialEthnicity = computed(() =>
    demographicRecords.value.reduce<Record<string, number>>((counts, record) => {
      // Call Object.entries(record.ethnicity).forEach to run this step.
      Object.entries(record.ethnicity).forEach(([label, value]) => {
        // Update counts[label] with the value on the right.
        counts[label] = (counts[label] ?? 0) + value
      })
      // Pass counts back to the caller.
      return counts
    }, {})
  )

  // Recalculate genderChartData when the values it reads change.
  const genderChartData = computed(() => {
    // Use Object.entries to initialize entries.
    const entries = Object.entries(officialGender.value)
    // Use entries.reduce to initialize total.
    const total = entries.reduce((sum, [, value]) => sum + value, 0)
    // Pass { labels: entries.map( ([label, value]) => `${label} — ${value} (${Math.round((value / total) * 100) back to the caller.
    return {
      labels: entries.map(
        ([label, value]) => `${label} — ${value} (${Math.round((value / total) * 100)}%)`
      ),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([label]) =>
            label === 'Unknown'
              ? '#94a3b8'
              : label === 'Other'
                ? props.palette.raceChart
                : label === 'Female'
                  ? props.palette.genderChartSecondary
                  : props.palette.genderChart
          ),
          borderWidth: 2,
          borderColor: props.palette.card,
        },
      ],
    }
  })

  // Define classCategories for the steps below.
  const classCategories = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Unknown'] as const
  type ClassCategory = (typeof classCategories)[number]
  // Store classColors as state so Vue reacts when it changes.
  const classColors = ref<Partial<Record<ClassCategory, string>>>({})
  // Call onMounted to run this step.
  onMounted(() => {
    try {
      // Update classColors.value with the value on the right.
      classColors.value = JSON.parse(localStorage.getItem('esa-class-standing-colors') || '{}')
    } catch {
      // Update classColors.value with the value on the right.
      classColors.value = {}
    }
  })
  // Run the callback when the watched values change.
  watch(
    classColors,
    (value) => localStorage.setItem('esa-class-standing-colors', JSON.stringify(value)),
    { deep: true }
  )
  // Define the helper that will class color.
  function classColor(category: ClassCategory) {
    // Define defaults for the steps below.
    const defaults = {
      '1st Year': props.palette.classChart,
      '2nd Year': '#c65d19',
      '3rd Year': '#4f46e5',
      '4th Year': '#ad2459',
      Unknown: '#64748b',
    }
    // Pass classColors.value[category] ?? defaults[category] back to the caller.
    return classColors.value[category] ?? defaults[category]
  }
  // Recalculate classData when the values it reads change.
  const classData = computed(() => {
    // Define counts for the steps below.
    const counts: Record<string, number> = {}
    // Call filteredStudents.value.forEach to run this step.
    filteredStudents.value.forEach((s) => {
      // Define category for the steps below.
      const category = classCategories.includes(s.class as ClassCategory) ? s.class : 'Unknown'
      // Update counts[category] with the value on the right.
      counts[category] = (counts[category] ?? 0) + 1
    })
    // Use classCategories .filter((category) => counts[category]) .map to initialize entries.
    const entries = classCategories
      .filter((category) => counts[category])
      .map((category) => [category, counts[category]!] as const)
    // Pass { labels: entries.map(([k]) => getClassStanding(k)), datasets: [ { label: 'Students', data: entries. back to the caller.
    return {
      labels: entries.map(([k]) => getClassStanding(k)),
      datasets: [
        {
          label: 'Students',
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([category]) => classColor(category)),
          borderRadius: 4,
        },
      ],
    }
  })

  // Recalculate majorData when the values it reads change.
  const majorData = computed(() => {
    // Define counts for the steps below.
    const counts: Record<string, number> = {}
    // Call filteredStudents.value.forEach to run this step.
    filteredStudents.value.forEach((s) => {
      // Update counts[s.major] with the value on the right.
      counts[s.major] = (counts[s.major] ?? 0) + 1
    })
    // Pass Object.entries(counts).sort((a, b) => b[1] - a[1]) back to the caller.
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  })

  // Recalculate raceData when the values it reads change.
  const raceData = computed(() => {
    // Pass Object.entries(officialEthnicity.value) .filter(([, count]) => count > 0) .sort((a, b) => b[1] - a[1 back to the caller.
    return Object.entries(officialEthnicity.value)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
  })
  // Recalculate officialDemographicTotal when the values it reads change.
  const officialDemographicTotal = computed(() =>
    Object.values(officialGender.value).reduce((sum, count) => sum + count, 0)
  )
  // Recalculate officialEthnicityTotal when the values it reads change.
  const officialEthnicityTotal = computed(() =>
    Object.values(officialEthnicity.value).reduce((sum, count) => sum + count, 0)
  )

  // Recalculate firstChoiceStats when the values it reads change.
  const firstChoiceStats = computed(() => {
    // Define eligibleStudents for the steps below.
    const eligibleStudents = new Set(
      choices.map((choice) => JSON.stringify([choice.studentId, choice.semesterId]))
    )
    // Define topChoices for the steps below.
    const topChoices = new Set(
      choices
        .filter((choice) => choice.rank === 1)
        .map((choice) => JSON.stringify([choice.studentId, choice.semesterId, choice.projectId]))
    )
    // Define realStudents for the steps below.
    const realStudents = new Set(filteredStudents.value.map((student) => student.id))
    // Define eligibleAssignments for the steps below.
    const eligibleAssignments = new Set<string>()
    // Repeat the following steps for each item in teams.
    for (const team of teams) {
      // Check whether !selectedSemesterIds.value.includes(team.semesterId) before running this branch.
      if (!selectedSemesterIds.value.includes(team.semesterId)) continue
      // Repeat the following steps for each item in team.studentIds.
      for (const studentId of team.studentIds) {
        // Check whether !realStudents.has(studentId) || !eligibleStudents.has(JSON.stringify([studentId, team.semesterId])) before running this branch.
        if (
          !realStudents.has(studentId) ||
          !eligibleStudents.has(JSON.stringify([studentId, team.semesterId]))
        )
          continue
        // Call eligibleAssignments.add to run this step.
        eligibleAssignments.add(JSON.stringify([studentId, team.semesterId, team.projectId]))
      }
    }
    // Pass { total: eligibleAssignments.size, first: [...eligibleAssignments].filter((key) => topChoices.has(ke back to the caller.
    return {
      total: eligibleAssignments.size,
      first: [...eligibleAssignments].filter((key) => topChoices.has(key)).length,
    }
  })
  // Recalculate firstChoicePct when the values it reads change.
  const firstChoicePct = computed(() =>
    firstChoiceStats.value.total
      ? `${((firstChoiceStats.value.first / firstChoiceStats.value.total) * 100).toFixed(1)}%`
      : 'Not Available'
  )
  // Recalculate semesterEnrollmentCount when the values it reads change.
  const semesterEnrollmentCount = computed(() =>
    filteredStudents.value.reduce(
      (total, student) =>
        total + selectedSemesterIds.value.filter((id) => student.semesters.includes(id)).length,
      0
    )
  )
  // Recalculate avgSemesters when the values it reads change.
  const avgSemesters = computed(() =>
    filteredStudents.value.length
      ? (
          filteredStudents.value.reduce(
            (total, student) =>
              total +
              student.semesters.filter((semesterId) => selectedSemesterIds.value.includes(semesterId))
                .length,
            0
          ) / filteredStudents.value.length
        ).toFixed(1)
      : '0.0'
  )
  // Recalculate returningStudents when the values it reads change.
  const returningStudents = computed(() =>
    filteredStudents.value
      .filter((student) => student.semesters.length > 1)
      .sort((a, b) => a.name.localeCompare(b.name))
  )
  // Recalculate returningCount when the values it reads change.
  const returningCount = computed(() => returningStudents.value.length)
  // Recalculate returningPct when the values it reads change.
  const returningPct = computed(() =>
    filteredStudents.value.length
      ? Math.round((returningCount.value / filteredStudents.value.length) * 100)
      : 0
  )

  // Recalculate chartTextColor when the values it reads change.
  const chartTextColor = computed(() => props.palette.chartText)
  // Recalculate chartMutedColor when the values it reads change.
  const chartMutedColor = computed(() => props.palette.chartText)
  // Recalculate chartGridColor when the values it reads change.
  const chartGridColor = computed(() => props.palette.chartGrid)
  // Recalculate chartOptions when the values it reads change.
  const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: {
            size: props.graphDisplay.fontSize,
            weight: 600,
            family: props.graphDisplay.fontFamily,
          },
          color: chartTextColor.value,
          padding: 16,
        },
      },
      tooltip: {
        titleFont: {
          size: props.graphDisplay.fontSize,
          weight: 700,
          family: props.graphDisplay.fontFamily,
        },
        bodyFont: {
          size: props.graphDisplay.fontSize,
          weight: 600,
          family: props.graphDisplay.fontFamily,
        },
      },
    },
  }))
  // Recalculate genderOptions when the values it reads change.
  const genderOptions = computed(() => ({
    ...chartOptions.value,
    layout: { padding: 18 },
    plugins: {
      ...chartOptions.value.plugins,
      legend: {
        ...chartOptions.value.plugins.legend,
        display: false,
        position: 'top',
        align: 'center',
      },
      genderSliceLabels: { display: false },
    },
  }))
  // Recalculate barOptions when the values it reads change.
  const barOptions = computed(() => ({
    ...chartOptions.value,
    plugins: {
      ...chartOptions.value.plugins,
      legend: { display: false },
      valueLabels: { display: true },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => {
            // Use Number to initialize value.
            const value = Number(context.raw)
            // Pass `${value} students (${Math.round((value / filteredStudents.value.length) * 100)}%)` back to the caller.
            return `${value} students (${Math.round((value / filteredStudents.value.length) * 100)}%)`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: chartMutedColor.value,
          font: {
            size: graphLabelSize('class'),
            weight: 600,
            family: graphFont('class'),
          },
        },
        grid: { display: false },
      },
      y: {
        grace: '15%',
        ticks: {
          color: chartMutedColor.value,
          font: {
            size: Math.max(10, graphLabelSize('class') - 1),
            weight: 600,
            family: graphFont('class'),
          },
          precision: 0,
        },
        grid: { color: chartGridColor.value },
      },
    },
  }))

  // Define the helper that will is pinned.
  function isPinned(id: string) {
    // Pass props.pinnedItems.some((item) => item.key === `insight:${id}`) back to the caller.
    return props.pinnedItems.some((item) => item.key === `insight:${id}`)
  }

  // Define the helper that will pin insight.
  function pinInsight(id: string, title: string, subtitle: string) {
    // Call emit to run this step.
    emit('togglePin', {
      key: `insight:${id}`,
      type: 'insight',
      id,
      title,
      subtitle,
    })
  }

  // Define the helper that will hex to rgb.
  function hexToRgb(hex: string): [number, number, number] {
    // Use hex.replace to initialize normalized.
    const normalized = hex.replace('#', '')
    // Pass [ Number.parseInt(normalized.slice(0, 2), 16), Number.parseInt(normalized.slice(2, 4), 16), Number.p back to the caller.
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ]
  }

  // Store pdfError as state so Vue reacts when it changes.
  const pdfError = ref('')
  // Define the helper that will export pdf.
  async function exportPdf() {
    // Check whether exporting.value before running this branch.
    if (exporting.value) return
    // Update exporting.value with the value on the right.
    exporting.value = true
    // Update pdfError.value with the value on the right.
    pdfError.value = ''
    try {
      // Define { jsPDF } for the steps below.
      const { jsPDF } = await import('jspdf')
      // Define settings for the steps below.
      const settings = { ...pdfOptions.value }
      // Define doc for the steps below.
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: settings.orientation })
      // Use doc.internal.pageSize.getWidth to initialize width.
      const width = doc.internal.pageSize.getWidth()
      // Use doc.internal.pageSize.getHeight to initialize height.
      const height = doc.internal.pageSize.getHeight()
      // Define margin for the steps below.
      const margin = 16
      // Define bodyWidth for the steps below.
      const bodyWidth = width - margin * 2
      // Define y for the steps below.
      let y = margin
      // Define the helper that will fit.
      function fit(space: number) {
        // Check whether y + space <= height - 18 before running this branch.
        if (y + space <= height - 18) return
        // Call doc.addPage to run this step.
        doc.addPage()
        // Update y with the value on the right.
        y = margin
      }
      // Define the helper that will heading.
      function heading(title: string) {
        // Call fit to run this step.
        fit(18)
        // Call doc.setFont to run this step.
        doc.setFont('helvetica', 'bold')
        // Call doc.setFontSize to run this step.
        doc.setFontSize(settings.size + 3)
        // Call doc.setTextColor to run this step.
        doc.setTextColor(26, 58, 26)
        // Call doc.text to run this step.
        doc.text(title, margin, y)
        y += 8
      }
      // Define the helper that will line.
      function line(text: string) {
        // Call doc.setFont to run this step.
        doc.setFont('helvetica', 'normal')
        // Call doc.setFontSize to run this step.
        doc.setFontSize(settings.size)
        // Call doc.setTextColor to run this step.
        doc.setTextColor(45, 55, 43)
        // Use doc.splitTextToSize to initialize lines.
        const lines: string[] = doc.splitTextToSize(text, bodyWidth)
        // Define step for the steps below.
        const step = settings.size * 0.45 + 1
        // Call fit to run this step.
        fit(lines.length * step)
        // Call doc.text to run this step.
        doc.text(lines, margin, y)
        y += lines.length * step
      }
      // Define the helper that will distribution.
      function distribution(title: string, rows: [string, number][], total: number, color: string) {
        y += 5
        // Call heading to run this step.
        heading(title)
        // Check whether !rows.length || !total before running this branch.
        if (!rows.length || !total) {
          // Call line to run this step.
          line('No recorded data for this selection.')
          return
        }
        // Call rows.forEach to run this step.
        rows.forEach(([label, count]) => {
          // Define percentage for the steps below.
          const percentage = (count / total) * 100
          // Call fit to run this step.
          fit(settings.size + 7)
          // Call line to run this step.
          line(`${label}: ${count} (${percentage.toFixed(1)}%)`)
          // Check whether settings.bars before running this branch.
          if (settings.bars) {
            // Call doc.setFillColor to run this step.
            doc.setFillColor(232, 237, 228)
            // Call doc.rect to run this step.
            doc.rect(margin, y - 1, bodyWidth, 2, 'F')
            // Call doc.setFillColor to run this step.
            doc.setFillColor(...hexToRgb(color))
            // Call doc.rect to run this step.
            doc.rect(margin, y - 1, (bodyWidth * percentage) / 100, 2, 'F')
            y += 5
          }
        })
      }
      // Call heading to run this step.
      heading('EPICS Program Insights')
      // Check whether settings.summary || settings.standing || settings.majors before running this branch.
      if (settings.summary || settings.standing || settings.majors)
        // Call line to run this step.
        line(
          `Student timeframe: ${timeframeLabel.value} | ${filteredStudents.value.length} unique students | ${semesterEnrollmentCount.value} semester enrollments`
        )
      // Check whether settings.gender || settings.race before running this branch.
      if (settings.gender || settings.race)
        // Call line to run this step.
        line(
          `Official demographics: ${demographicPeriod.value} / ${demographicCourse.value === 'all' ? 'All courses' : demographicCourse.value}`
        )
      // Check whether settings.summary before running this branch.
      if (settings.summary) {
        y += 5
        // Call heading to run this step.
        heading('Summary Metrics')
        // Call line to run this step.
        line(`Average semesters per student: ${avgSemesters.value}`)
        // Call line to run this step.
        line(
          `First-choice assignment rate: ${firstChoicePct.value} (${firstChoiceStats.value.first} of ${firstChoiceStats.value.total} eligible assignments)`
        )
        // Call line to run this step.
        line(
          `Enrolled in multiple semesters: ${returningCount.value} students (${returningPct.value}%)`
        )
      }
      // Check whether settings.standing before running this branch.
      if (settings.standing)
        // Call distribution to run this step.
        distribution(
          'Class Standing',
          classData.value.labels.map((label, index) => [
            label,
            classData.value.datasets[0]!.data[index]!,
          ]),
          filteredStudents.value.length,
          props.palette.classChart
        )
      // Check whether settings.majors before running this branch.
      if (settings.majors)
        // Call distribution to run this step.
        distribution(
          'Major Distribution',
          majorData.value,
          filteredStudents.value.length,
          props.palette.majorChart
        )
      // Check whether settings.gender before running this branch.
      if (settings.gender)
        // Call distribution to run this step.
        distribution(
          'Gender Distribution',
          Object.entries(officialGender.value),
          officialDemographicTotal.value,
          props.palette.genderChart
        )
      // Check whether settings.race before running this branch.
      if (settings.race) {
        // Use raceData.value.filter to initialize reported.
        const reported = raceData.value.filter(([name]) => name !== 'Unknown')
        // Call distribution to run this step.
        distribution(
          'Race & Ethnicity',
          reported,
          officialEthnicityTotal.value,
          props.palette.raceChart
        )
      }
      // Use doc.getNumberOfPages to initialize pages.
      const pages = doc.getNumberOfPages()
      for (let page = 1; page <= pages; page++) {
        // Call doc.setPage to run this step.
        doc.setPage(page)
        // Call doc.setFontSize to run this step.
        doc.setFontSize(8)
        // Call doc.text to run this step.
        doc.text(`EPICS Program Tracker / Page ${page} of ${pages}`, width / 2, height - 8, {
          align: 'center',
        })
      }
      // Call doc.save to run this step.
      doc.save('epics-program-insights.pdf')
      // Update pdfOpen.value with the value on the right.
      pdfOpen.value = false
    } catch {
      // Update pdfError.value with the value on the right.
      pdfError.value = 'Could not create the PDF. Please try again.'
    } finally {
      // Update exporting.value with the value on the right.
      exporting.value = false
    }
  }
</script>

<template>
  <div style="padding: 28px 32px">
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      "
    >
      <h1 class="font-display" style="font-size: 20px; font-weight: 700; color: #1a3a1a">
        Program Insights
      </h1>
      <div style="display: flex; gap: 10px; align-items: center">
        <button
          :disabled="exporting"
          style="
            padding: 6px 14px;
            background: #1a3a1a;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            font-family: Inter;
          "
          @click="pdfOpen = !pdfOpen"
        >
          {{ exporting ? 'Preparing PDF…' : 'Export PDF' }}
        </button>
      </div>
    </div>

    <form v-if="pdfOpen" class="stat-card" style="margin-bottom:18px" @submit.prevent="exportPdf">
      <h2>PDF Export Settings</h2>
      <fieldset style="display:flex;flex-wrap:wrap;gap:14px;margin:12px 0">
        <legend>Include in Report</legend>
        <label v-for="section in pdfSections" :key="section.key"><input v-model="pdfOptions[section.key]" type="checkbox" /> {{ section.label }}</label>
      </fieldset>
      <div class="graph-control-grid">
        <label>Orientation <select v-model="pdfOptions.orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
        <label>Text Size · {{ pdfOptions.size }}pt <input v-model.number="pdfOptions.size" type="range" min="8" max="14" /></label>
        <label><input v-model="pdfOptions.bars" type="checkbox" /> Include Distribution Bars</label>
      </div>
      <p v-if="pdfError" role="alert">{{ pdfError }}</p>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button type="submit" class="primary-button" :disabled="exporting || !pdfSections.some(section => pdfOptions[section.key])">{{ exporting ? 'Preparing PDF…' : 'Download PDF' }}</button>
        <button type="button" class="secondary-button" @click="pdfOpen = false">Cancel</button>
      </div>
    </form>
    <section class="stat-card insight-timeframe">
      <div>
        <div class="settings-label">Student data timeframe</div>
        <p>Metrics, class standing, and major distribution update together.</p>
      </div>
      <div class="timeframe-controls">
        <select v-model="timeframeMode" aria-label="Choose timeframe type">
          <option value="all">All Semesters</option>
          <option value="single">Single Semester</option>
          <option value="range">Semester Range</option>
        </select>
        <select v-if="timeframeMode === 'single'" v-model="semFilter" aria-label="Choose semester">
          <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
            {{ semester.label }}
          </option>
        </select>
        <template v-if="timeframeMode === 'range'">
          <label>
            <span>From</span>
            <select v-model="rangeStart">
              <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
                {{ semester.label }}
              </option>
            </select>
          </label>
          <label>
            <span>To</span>
            <select v-model="rangeEnd">
              <option v-for="semester in semesters" :key="semester.id" :value="semester.id">
                {{ semester.label }}
              </option>
            </select>
          </label>
        </template>
        <span class="timeframe-summary"
          >{{ timeframeLabel }} · {{ filteredStudents.length }} unique students · {{ semesterEnrollmentCount }} semester enrollments</span
        >
      </div>
    </section>



    <!-- Key metrics -->
    <div
      style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px"
    >
      <div class="stat-card" style="text-align: center; padding: 20px">
        <div
          style="
            font-size: 34px;
            font-weight: 700;
            color: #c45c1a;
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 6px;
          "
        >
          {{ avgSemesters }}
        </div>
        <div style="font-size: 12.5px; color: #5a6b52; font-weight: 500">
          Avg. Semesters per Student
        </div>
      </div>
      <div class="stat-card" style="text-align: center; padding: 20px">
        <div
          style="
            font-size: 34px;
            font-weight: 700;
            color: #10b981;
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 6px;
          "
        >
          {{ firstChoicePct }}
        </div>
        <div style="font-size: 12.5px; color: #5a6b52; font-weight: 500">
          1st Choice Assignment Rate
          <span style="display: block; font-size: 11px">{{ firstChoiceStats.first }} of {{ firstChoiceStats.total }} assignments with submitted preferences</span>
        </div>
      </div>
      <div class="stat-card" style="text-align: center; padding: 20px">
        <div
          style="
            font-size: 34px;
            font-weight: 700;
            color: #f59e0b;
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 6px;
          "
        >
          {{ returningPct }}%
        </div>
        <div style="font-size: 12.5px; color: #5a6b52; font-weight: 500">
          Students enrolled in multiple semesters
          <span style="display:block;font-size:11px">{{ returningCount }} students in this view · across recorded semesters</span>
          <button type="button" class="secondary-button" style="margin-top:8px" :aria-expanded="showReturning" @click="showReturning = !showReturning">
            {{ showReturning ? 'Hide Student List' : 'View Student List' }}
          </button>
        </div>
      </div>
    </div>

    <section v-if="showReturning" class="stat-card" style="margin-bottom:18px">
      <h2>Students Enrolled in Multiple Semesters</h2>
      <p v-if="!returningStudents.length">No students in this view have multiple recorded semesters.</p>
      <ul v-else>
        <li v-for="student in returningStudents" :key="student.id">
          <button type="button" class="record-link" @click="emit('openStudent', student.id)">{{ student.name }}</button>
          · {{ student.semesters.map(id => semesters.find(semester => semester.id === id)?.label ?? id).join(', ') }}
        </li>
      </ul>
    </section>
    <!-- Student profile charts -->
    <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: 18px; margin-bottom: 18px">
      <div id="insight-class-standing" class="stat-card">
        <details class="graph-card-controls">
          <summary>Customize Graph</summary>
          <div class="graph-control-grid">
            <ChartFontLibrary :model-value="graphFont('class')" @update:model-value="updateGraph('class', 'font', $event)" />
            <label>Label Size · {{ graphLabelSize('class') }}px
              <input type="range" min="10" max="21" :value="graphLabelSize('class')" @input="updateGraph('class', 'labels', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label>Value Size · {{ graphValueSize('class') }}px
              <input type="range" min="10" max="21" :value="graphValueSize('class')" @input="updateGraph('class', 'values', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label v-for="category in classCategories" :key="category">{{ getClassStanding(category) }} Color
              <input type="color" :value="classColor(category)" @input="classColors[category] = ($event.target as HTMLInputElement).value" />
            </label>
            <label v-for="color in graphColors.class" :key="color.key">{{ color.label }}
              <input type="color" :value="palette[color.key]" @input="emit('updateColor', color.key, ($event.target as HTMLInputElement).value)" />
            </label>
            <label>Chart Height · {{ graphPrefs.class?.size ?? graphDisplay.classChartHeight }}px
              <input type="range" min="220" max="420" step="10" :value="graphPrefs.class?.size ?? graphDisplay.classChartHeight" @input="updateGraph('class', 'size', Number(($event.target as HTMLInputElement).value))" />
            </label>
          </div>
        </details>
        <div class="chart-title-row">
          <div class="font-display">Class Standing</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('class-standing') }"
            @click="pinInsight('class-standing', 'Class Standing', timeframeLabel)"
          >
            {{ isPinned('class-standing') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <div :style="{ height: `${graphPrefs.class?.size ?? graphDisplay.classChartHeight}px` }">
          <Bar :data="classData" :options="barOptions" />
        </div>
        <table class="insight-values" aria-label="Class standing counts and percentages">
          <thead><tr><th scope="col">Class standing</th><th scope="col">Students</th><th scope="col">Percentage</th></tr></thead>
          <tbody><tr v-for="(label, index) in classData.labels" :key="label">
            <th scope="row"><span class="insight-swatch" :style="{ background: classData.datasets[0].backgroundColor[index] }" />{{ label }}</th>
            <td>{{ classData.datasets[0].data[index] }}</td>
            <td>{{ filteredStudents.length ? (classData.datasets[0].data[index] / filteredStudents.length * 100).toFixed(1) : '0.0' }}%</td>
          </tr></tbody>
          <tfoot><tr><th scope="row">Total</th><td>{{ filteredStudents.length }}</td><td>{{ filteredStudents.length ? '100' : '0' }}%</td></tr></tfoot>
        </table>
        <p style="font-size:12px;margin-top:10px;color:var(--muted-foreground)">Percentage of students in {{ timeframeLabel }}.</p>
      </div>
      <div id="insight-major-distribution" class="stat-card">
        <details class="graph-card-controls">
          <summary>Customize Graph</summary>
          <div class="graph-control-grid">
            <ChartFontLibrary :model-value="graphFont('major')" @update:model-value="updateGraph('major', 'font', $event)" />
            <label>Label Size · {{ graphLabelSize('major') }}px
              <input type="range" min="10" max="21" :value="graphLabelSize('major')" @input="updateGraph('major', 'labels', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label>Value Size · {{ graphValueSize('major') }}px
              <input type="range" min="10" max="21" :value="graphValueSize('major')" @input="updateGraph('major', 'values', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label v-for="color in graphColors.major" :key="color.key">{{ color.label }}
              <input type="color" :value="palette[color.key]" @input="emit('updateColor', color.key, ($event.target as HTMLInputElement).value)" />
            </label>
            <label>Bar Thickness · {{ graphPrefs.major?.size ?? graphDisplay.barThickness }}px
              <input type="range" min="5" max="18" :value="graphPrefs.major?.size ?? graphDisplay.barThickness" @input="updateGraph('major', 'size', Number(($event.target as HTMLInputElement).value))" />
            </label>
          </div>
        </details>
        <div class="chart-title-row">
          <div class="font-display">Major Distribution</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('major-distribution') }"
            @click="pinInsight('major-distribution', 'Major Distribution', timeframeLabel)"
          >
            {{ isPinned('major-distribution') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <div v-for="([name, count], i) in majorData" :key="name" style="margin-bottom: 10px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
            <span
              :style="{
                fontSize: `${graphLabelSize('major')}px`,
                fontFamily: graphFont('major'),
                fontWeight: 600,
              }"
              >{{ name }}</span
            >
            <span
              class="mono"
              :style="{
                fontSize: `${graphValueSize('major')}px`,
                fontFamily: graphFont('major'),
                fontWeight: 700,
                color: palette.chartText,
              }"
              >{{ count }} · {{ Math.round((count / filteredStudents.length) * 100) }}%</span
            >
          </div>
          <div
            :style="{
              background: palette.chartGrid,
              borderRadius: '3px',
              height: `${graphPrefs.major?.size ?? graphDisplay.barThickness}px`,
              overflow: 'hidden',
            }"
          >
            <div
              :style="{
                background: palette.majorChart,
                height: '100%',
                width: (count / filteredStudents.length) * 100 + '%',
                borderRadius: '3px',
                transition: 'width 0.4s',
              }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="demographic-heading">
      <div>
        <h2>Official Enrollment Demographics</h2>
        <p>
          {{ demographicPeriod }} source roster data ·
          {{ officialDemographicTotal }} students
        </p>
      </div>
      <div class="demographic-filters">
        <select
          v-model="demographicPeriod"
          aria-label="Filter official demographics by reporting period"
        >
          <option v-for="period in [...new Set(officialDemographics.map(record => record.period))]" :key="period" :value="period">{{ period }}</option>
        </select>
        <select v-model="demographicCourse" aria-label="Filter official demographics by course">
          <option value="all">All courses</option>
          <option v-for="course in officialCourses" :key="course" :value="course">
            {{ course }}
          </option>
        </select>
      </div>
    </div>

    <p style="margin-bottom: 12px; color: var(--muted-foreground)">
      Source roster and survey records. Missing fields are marked unknown. Race and ethnicity were not supplied.
    </p>
    <!-- Official demographic charts -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px">
      <div id="insight-gender-distribution" class="stat-card">
        <details class="graph-card-controls">
          <summary>Customize Graph</summary>
          <div class="graph-control-grid">
            <ChartFontLibrary :model-value="graphFont('gender')" @update:model-value="updateGraph('gender', 'font', $event)" />
            <label>Label Size · {{ graphLabelSize('gender') }}px
              <input type="range" min="10" max="21" :value="graphLabelSize('gender')" @input="updateGraph('gender', 'labels', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label>Value Size · {{ graphValueSize('gender') }}px
              <input type="range" min="10" max="21" :value="graphValueSize('gender')" @input="updateGraph('gender', 'values', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label v-for="color in graphColors.gender" :key="color.key">{{ color.label }}
              <input type="color" :value="palette[color.key]" @input="emit('updateColor', color.key, ($event.target as HTMLInputElement).value)" />
            </label>
            <label>Chart Height · {{ graphPrefs.gender?.size ?? graphDisplay.genderChartHeight }}px
              <input type="range" min="220" max="420" step="10" :value="graphPrefs.gender?.size ?? graphDisplay.genderChartHeight" @input="updateGraph('gender', 'size', Number(($event.target as HTMLInputElement).value))" />
            </label>
          </div>
        </details>
        <div class="chart-title-row">
          <div class="font-display">Gender Distribution</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('gender-distribution') }"
            @click="
              pinInsight(
                'gender-distribution',
                'Gender Distribution',
                `${demographicPeriod} · ${demographicCourse === 'all' ? 'All courses' : demographicCourse}`
              )
            "
          >
            {{ isPinned('gender-distribution') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <div class="gender-chart-layout"><ul class="insight-gender-summary" :style="{ fontFamily: graphFont('gender'), fontSize: graphLabelSize('gender') + 'px', '--gender-value-size': graphValueSize('gender') + 'px' }"  aria-label="Gender distribution summary">
          <li v-for="(label, index) in genderChartData.labels" :key="label">
            <span class="insight-swatch" :style="{ background: genderChartData.datasets[0].backgroundColor[index] }" /><span>{{ label.split(' — ')[0] }}</span><strong>{{ label.split(' — ')[1] }}</strong>
          </li>
        </ul>
        <div :style="{ height: `${graphPrefs.gender?.size ?? graphDisplay.genderChartHeight}px` }">
          <Pie :data="genderChartData" :options="genderOptions" />
        </div></div>
      </div>
      <div id="insight-race-ethnicity" class="stat-card">
        <details class="graph-card-controls">
          <summary>Customize Graph</summary>
          <div class="graph-control-grid">
            <ChartFontLibrary :model-value="graphFont('race')" @update:model-value="updateGraph('race', 'font', $event)" />
            <label>Label Size · {{ graphLabelSize('race') }}px
              <input type="range" min="10" max="21" :value="graphLabelSize('race')" @input="updateGraph('race', 'labels', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label>Value Size · {{ graphValueSize('race') }}px
              <input type="range" min="10" max="21" :value="graphValueSize('race')" @input="updateGraph('race', 'values', Number(($event.target as HTMLInputElement).value))" />
            </label>
            <label v-for="color in graphColors.race" :key="color.key">{{ color.label }}
              <input type="color" :value="palette[color.key]" @input="emit('updateColor', color.key, ($event.target as HTMLInputElement).value)" />
            </label>
            <label>Bar Thickness · {{ graphPrefs.race?.size ?? graphDisplay.barThickness }}px
              <input type="range" min="5" max="18" :value="graphPrefs.race?.size ?? graphDisplay.barThickness" @input="updateGraph('race', 'size', Number(($event.target as HTMLInputElement).value))" />
            </label>
          </div>
        </details>
        <div class="chart-title-row">
          <div class="font-display">Race & Ethnicity</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('race-ethnicity') }"
            @click="
              pinInsight(
                'race-ethnicity',
                'Race & Ethnicity',
                `${demographicPeriod} · ${demographicCourse === 'all' ? 'All courses' : demographicCourse}`
              )
            "
          >
            {{ isPinned('race-ethnicity') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <p v-if="!raceData.some(([name]) => name !== 'Unknown')">Race and ethnicity were not supplied for this selection.</p>
        <div v-for="([name, count], i) in raceData.filter(([name]) => name !== 'Unknown')" :key="name" style="margin-bottom: 10px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
            <span
              :style="{
                fontSize: `${graphLabelSize('race')}px`,
                fontFamily: graphFont('race'),
                fontWeight: 600,
              }"
              >{{ name }}</span
            >
            <span
              class="mono"
              :style="{
                fontSize: `${graphValueSize('race')}px`,
                fontFamily: graphFont('race'),
                fontWeight: 700,
                color: palette.chartText,
              }"
              >{{ count }} · {{ Math.round((count / officialEthnicityTotal) * 100) }}%</span
            >
          </div>
          <div
            :style="{
              background: palette.chartGrid,
              borderRadius: '3px',
              height: `${graphPrefs.race?.size ?? graphDisplay.barThickness}px`,
              overflow: 'hidden',
            }"
          >
            <div
              :style="{
                background: palette.raceChart,
                height: '100%',
                width: (count / officialEthnicityTotal) * 100 + '%',
                borderRadius: '3px',
                transition: 'width 0.4s',
              }"
            />
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.insight-values { width:100%; border-collapse:collapse; margin-top:22px; font-size:13px; }
.insight-values th, .insight-values td { padding:11px 8px; border-bottom:1px solid var(--border, #d5dfcf); text-align:right; }
.insight-values th:first-child { text-align:left; }
.insight-values tbody tr:nth-child(even) { background:rgba(127,147,120,.08); }
.insight-values tfoot { font-weight:700; }
.insight-swatch { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:8px; vertical-align:middle; flex-shrink:0; }
.insight-gender-summary { list-style:none; padding:0; margin:0 0 18px; display:grid; gap:10px; }
.insight-gender-summary li { display:flex; flex-wrap:wrap; align-items:center; font-size:inherit; font-weight:600; }
.insight-gender-summary strong { font-size:var(--gender-value-size); margin-left:6px; }
.gender-chart-layout { display:grid; grid-template-columns:minmax(112px, .8fr) minmax(120px, 1.2fr); align-items:center; gap:10px; }
.graph-card-controls { margin-bottom:12px; }
.graph-card-controls summary { cursor:pointer; color:var(--primary); font-size:13px; font-weight:600; }
.graph-card-controls .graph-control-grid { margin:12px 0; padding:0; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); }
@media (max-width:650px) { .gender-chart-layout { grid-template-columns:1fr; } }
@media (max-width:700px) { .insight-values th, .insight-values td { padding:9px 4px; font-size:12px; } }
</style>
