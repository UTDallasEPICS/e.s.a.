<script setup lang="ts">
  import { ref, computed, nextTick, watch } from 'vue'
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
  import { students, semesters, choices, officialDemographics, getClassStanding } from '../data'
  import type { ColorPalette, GraphDisplaySettings, PinnedItem } from '../types'

  ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

  const valueLabelsPlugin = {
    id: 'valueLabels',
    afterDatasetsDraw(chart: ChartJS) {
      if (
        !(chart.options.plugins as Record<string, { display?: boolean }> | undefined)?.valueLabels
          ?.display
      )
        return
      const { ctx } = chart
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.font = `700 ${props.graphDisplay.valueFontSize}px ${props.graphDisplay.fontFamily}, sans-serif`
      ctx.fillStyle = chartTextColor.value
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex)
        meta.data.forEach((element, index) => {
          const value = Number(dataset.data[index] ?? 0)
          const position = element.tooltipPosition()
          ctx.fillText(String(value), position.x, position.y - 5)
        })
      })
      ctx.restore()
    },
  }

  const genderSliceLabelsPlugin = {
    id: 'genderSliceLabels',
    afterDatasetsDraw(chart: ChartJS) {
      if (
        !(chart.options.plugins as Record<string, { display?: boolean }> | undefined)
          ?.genderSliceLabels?.display
      )
        return
      const dataset = chart.data.datasets[0]
      if (!dataset) return
      const values = dataset.data.map((value) => Number(value ?? 0))
      const total = values.reduce((sum, value) => sum + value, 0)
      const { ctx } = chart
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      chart.getDatasetMeta(0).data.forEach((element, index) => {
        const arc = element.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true) as {
          x: number
          y: number
          startAngle: number
          endAngle: number
          outerRadius: number
        }
        const angle = (arc.startAngle + arc.endAngle) / 2
        const labelRadius = arc.outerRadius * 0.62
        const x = arc.x + Math.cos(angle) * labelRadius
        const y = arc.y + Math.sin(angle) * labelRadius
        ctx.font = `700 ${props.graphDisplay.valueFontSize}px ${props.graphDisplay.fontFamily}, sans-serif`
        const category = String(chart.data.labels?.[index] ?? '').split(' — ')[0]
        const percentage = total ? Math.round((values[index] / total) * 100) : 0
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)'
        ctx.fillStyle = '#ffffff'
        ctx.strokeText(category, x, y - 8)
        ctx.fillText(category, x, y - 8)
        ctx.font = `600 ${Math.max(10, props.graphDisplay.valueFontSize - 1)}px ${props.graphDisplay.fontFamily}, sans-serif`
        const valueLabel = `${values[index]} students · ${percentage}%`
        ctx.strokeText(valueLabel, x, y + 9)
        ctx.fillText(valueLabel, x, y + 9)
      })
      ctx.restore()
    },
  }

  ChartJS.register(valueLabelsPlugin, genderSliceLabelsPlugin)

  const props = defineProps<{
    pinnedItems: PinnedItem[]
    initialInsightId?: string | null
    theme: 'light' | 'dark'
    palette: ColorPalette
    graphDisplay: GraphDisplaySettings
  }>()
  const emit = defineEmits<{
    togglePin: [item: PinnedItem]
    updateColor: [key: keyof ColorPalette, value: string]
    updateGraphSetting: [
      key: keyof GraphDisplaySettings,
      value: GraphDisplaySettings[keyof GraphDisplaySettings],
    ]
  }>()
  const timeframeMode = ref<'all' | 'single' | 'range'>('all')
  const semFilter = ref('SP26')
  const rangeStart = ref('FA24')
  const rangeEnd = ref('SP26')
  const demographicCourse = ref('all')
  const demographicPeriod = ref('All Recorded Semesters')
  const exporting = ref(false)
  const showGraphControls = ref(false)

  watch(
    () => props.initialInsightId,
    async (insightId) => {
      if (!insightId) return
      await nextTick()
      document
        .getElementById(`insight-${insightId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    { immediate: true }
  )

  const selectedSemesterIds = computed(() => {
    if (timeframeMode.value === 'all') return semesters.map((semester) => semester.id)
    if (timeframeMode.value === 'single') return [semFilter.value]
    const startIndex = semesters.findIndex((semester) => semester.id === rangeStart.value)
    const endIndex = semesters.findIndex((semester) => semester.id === rangeEnd.value)
    const from = Math.min(startIndex, endIndex)
    const to = Math.max(startIndex, endIndex)
    return semesters.slice(Math.max(0, from), to + 1).map((semester) => semester.id)
  })

  const timeframeLabel = computed(() => {
    if (timeframeMode.value === 'all') return 'All semesters'
    if (timeframeMode.value === 'single') {
      return semesters.find((semester) => semester.id === semFilter.value)?.label ?? semFilter.value
    }
    const start =
      semesters.find((semester) => semester.id === rangeStart.value)?.label ?? rangeStart.value
    const end =
      semesters.find((semester) => semester.id === rangeEnd.value)?.label ?? rangeEnd.value
    return `${start} – ${end}`
  })

  const filteredStudents = computed(() =>
    students.filter(
      (student) =>
        student.participationStatus !== 'Exited Program' &&
        student.semesters.some((semesterId) => selectedSemesterIds.value.includes(semesterId))
    )
  )

  const demographicRecords = computed(() =>
    officialDemographics.filter(
      (record) =>
        record.period === demographicPeriod.value &&
        (demographicCourse.value === 'all' || record.course === demographicCourse.value)
    )
  )
  const officialCourses = Array.from(new Set(officialDemographics.map((record) => record.course)))

  const officialGender = computed(() =>
    demographicRecords.value.reduce<Record<string, number>>((counts, record) => {
      Object.entries(record.gender).forEach(([label, value]) => {
        counts[label] = (counts[label] ?? 0) + value
      })
      return counts
    }, {})
  )

  const officialEthnicity = computed(() =>
    demographicRecords.value.reduce<Record<string, number>>((counts, record) => {
      Object.entries(record.ethnicity).forEach(([label, value]) => {
        counts[label] = (counts[label] ?? 0) + value
      })
      return counts
    }, {})
  )

  const genderChartData = computed(() => {
    const entries = Object.entries(officialGender.value)
    const total = entries.reduce((sum, [, value]) => sum + value, 0)
    return {
      labels: entries.map(
        ([label, value]) => `${label} — ${value} (${Math.round((value / total) * 100)}%)`
      ),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: [props.palette.genderChart, props.palette.genderChartSecondary],
          borderWidth: 2,
          borderColor: props.palette.card,
        },
      ],
    }
  })

  const classData = computed(() => {
    const order = ['1st Year', '2nd Year', '3rd Year', '4th Year']
    const counts: Record<string, number> = {}
    filteredStudents.value.forEach((s) => {
      counts[s.class] = (counts[s.class] ?? 0) + 1
    })
    const entries = order.filter((c) => counts[c]).map((c) => [c, counts[c]] as [string, number])
    return {
      labels: entries.map(([k]) => getClassStanding(k)),
      datasets: [
        {
          label: 'Students',
          data: entries.map(([, v]) => v),
          backgroundColor: props.palette.classChart,
          borderRadius: 4,
        },
      ],
    }
  })

  const majorData = computed(() => {
    const counts: Record<string, number> = {}
    filteredStudents.value.forEach((s) => {
      counts[s.major] = (counts[s.major] ?? 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  })

  const raceData = computed(() => {
    return Object.entries(officialEthnicity.value)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
  })
  const officialDemographicTotal = computed(() =>
    Object.values(officialGender.value).reduce((sum, count) => sum + count, 0)
  )
  const officialEthnicityTotal = computed(() =>
    Object.values(officialEthnicity.value).reduce((sum, count) => sum + count, 0)
  )

  const filteredChoices = computed(() =>
    choices.filter((choice) => selectedSemesterIds.value.includes(choice.semesterId))
  )
  const firstChoicePct = computed(() =>
    filteredChoices.value.length
      ? Math.round(
          (filteredChoices.value.filter((choice) => choice.rank === 1).length /
            filteredChoices.value.length) *
            100
        )
      : 0
  )
  const avgSemesters = computed(() =>
    filteredStudents.value.length
      ? (
          filteredStudents.value.reduce(
            (total, student) =>
              total +
              student.semesters.filter((semesterId) =>
                selectedSemesterIds.value.includes(semesterId)
              ).length,
            0
          ) / filteredStudents.value.length
        ).toFixed(1)
      : '0.0'
  )
  const returningCount = computed(
    () =>
      filteredStudents.value.filter(
        (student) =>
          student.semesters.filter((semesterId) => selectedSemesterIds.value.includes(semesterId))
            .length > 1
      ).length
  )
  const returningPct = computed(() =>
    filteredStudents.value.length
      ? Math.round((returningCount.value / filteredStudents.value.length) * 100)
      : 0
  )

  const chartTextColor = computed(() => props.palette.chartText)
  const chartMutedColor = computed(() => props.palette.chartText)
  const chartGridColor = computed(() => props.palette.chartGrid)
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
  const genderOptions = computed(() => ({
    ...chartOptions.value,
    layout: { padding: 18 },
    plugins: {
      ...chartOptions.value.plugins,
      legend: {
        ...chartOptions.value.plugins.legend,
        display: true,
        position: 'top',
        align: 'center',
      },
      genderSliceLabels: { display: true },
    },
  }))
  const barOptions = computed(() => ({
    ...chartOptions.value,
    plugins: {
      ...chartOptions.value.plugins,
      valueLabels: { display: true },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => {
            const value = Number(context.raw)
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
            size: props.graphDisplay.fontSize,
            weight: 600,
            family: props.graphDisplay.fontFamily,
          },
        },
        grid: { display: false },
      },
      y: {
        grace: '15%',
        ticks: {
          color: chartMutedColor.value,
          font: {
            size: Math.max(10, props.graphDisplay.fontSize - 1),
            weight: 600,
            family: props.graphDisplay.fontFamily,
          },
          precision: 0,
        },
        grid: { color: chartGridColor.value },
      },
    },
  }))

  function isPinned(id: string) {
    return props.pinnedItems.some((item) => item.key === `insight:${id}`)
  }

  function pinInsight(id: string, title: string, subtitle: string) {
    emit('togglePin', {
      key: `insight:${id}`,
      type: 'insight',
      id,
      title,
      subtitle,
    })
  }

  function hexToRgb(hex: string): [number, number, number] {
    const normalized = hex.replace('#', '')
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ]
  }

  async function exportPdf() {
    exporting.value = true
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const margin = 16
      const contentWidth = 178
      let y = 18
      const semesterLabel = timeframeLabel.value
      const courseLabel =
        demographicCourse.value === 'all' ? 'EPCS 2200 + EPCS 3200' : demographicCourse.value

      const ensureSpace = (height: number) => {
        if (y + height > 280) {
          doc.addPage()
          y = 18
        }
      }

      const addDistribution = (
        title: string,
        rows: [string, number][],
        total: number,
        color: [number, number, number]
      ) => {
        ensureSpace(16 + rows.length * 9)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(26, 58, 26)
        doc.text(title, margin, y)
        y += 7
        rows.forEach(([label, count]) => {
          const percentage = total ? Math.round((count / total) * 100) : 0
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.setTextColor(45, 55, 43)
          doc.text(label, margin, y)
          doc.text(`${count} · ${percentage}%`, margin + contentWidth, y, { align: 'right' })
          doc.setFillColor(232, 237, 228)
          doc.roundedRect(margin, y + 2, contentWidth, 2.2, 1, 1, 'F')
          doc.setFillColor(...color)
          doc.roundedRect(margin, y + 2, contentWidth * (percentage / 100), 2.2, 1, 1, 'F')
          y += 9
        })
        y += 5
      }

      doc.setFillColor(18, 38, 18)
      doc.rect(0, 0, 210, 34, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(19)
      doc.text('EPICS Program Insights', margin, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Generated ${new Date().toLocaleString()}`, margin, 24)
      y = 44

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(26, 58, 26)
      doc.text('Report scope', margin, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 107, 82)
      doc.text(`Student profile semester: ${semesterLabel}`, margin, y)
      y += 5
      doc.text(`Official demographics: ${demographicPeriod.value} · ${courseLabel}`, margin, y)
      y += 10

      const metrics = [
        ['Avg. semesters per student', avgSemesters.value],
        ['1st choice assignment rate', `${firstChoicePct.value}%`],
        ['Returned for 2+ semesters', `${returningPct.value}% (${returningCount.value} students)`],
      ]
      metrics.forEach(([label, value], index) => {
        const x = margin + index * 59.5
        doc.setFillColor(248, 247, 243)
        doc.setDrawColor(205, 216, 197)
        doc.roundedRect(x, y, 55, 23, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(index === 0 ? 196 : 45, index === 0 ? 92 : 106, index === 0 ? 26 : 45)
        doc.text(String(value), x + 4, y + 9)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(90, 107, 82)
        doc.text(label, x + 4, y + 17, { maxWidth: 48 })
      })
      y += 32

      const classCounts: Record<string, number> = {}
      filteredStudents.value.forEach((student) => {
        const label = getClassStanding(student.class)
        classCounts[label] = (classCounts[label] ?? 0) + 1
      })
      addDistribution(
        'Class Standing',
        Object.entries(classCounts),
        filteredStudents.value.length,
        hexToRgb(props.palette.classChart)
      )
      addDistribution(
        'Major Distribution',
        majorData.value,
        filteredStudents.value.length,
        hexToRgb(props.palette.majorChart)
      )
      addDistribution(
        'Gender Distribution',
        Object.entries(officialGender.value),
        officialDemographicTotal.value,
        hexToRgb(props.palette.genderChart)
      )
      addDistribution(
        'Race & Ethnicity',
        raceData.value,
        officialEthnicityTotal.value,
        hexToRgb(props.palette.raceChart)
      )

      const pageCount = doc.getNumberOfPages()
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(90, 107, 82)
        doc.text(`EPICS Program Tracker · Page ${page} of ${pageCount}`, 105, 291, {
          align: 'center',
        })
      }

      const fileScope = semesterLabel.toLowerCase().replaceAll(' ', '-')
      doc.save(`epics-insights-${fileScope}.pdf`)
    } finally {
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
        <button class="secondary-button" @click="showGraphControls = !showGraphControls">
          {{ showGraphControls ? 'Close Graph Controls' : 'Customize Graphs' }}
        </button>
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
          @click="exportPdf"
        >
          {{ exporting ? 'Preparing PDF…' : 'Export PDF' }}
        </button>
      </div>
    </div>

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
          >{{ timeframeLabel }} · {{ filteredStudents.length }} students</span
        >
      </div>
    </section>

    <section v-if="showGraphControls" class="stat-card live-graph-controls">
      <div class="panel-heading">
        <div>
          <h2>Live Graph Controls</h2>
          <p>Changes apply instantly and are also available in Settings.</p>
        </div>
      </div>
      <div class="graph-control-grid">
        <label>
          <span>Graph Text</span>
          <input
            type="color"
            :value="palette.chartText"
            @input="emit('updateColor', 'chartText', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Grid Lines</span>
          <input
            type="color"
            :value="palette.chartGrid"
            @input="emit('updateColor', 'chartGrid', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Class Standing</span>
          <input
            type="color"
            :value="palette.classChart"
            @input="emit('updateColor', 'classChart', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Major Distribution</span>
          <input
            type="color"
            :value="palette.majorChart"
            @input="emit('updateColor', 'majorChart', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Gender Primary</span>
          <input
            type="color"
            :value="palette.genderChart"
            @input="emit('updateColor', 'genderChart', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Gender Secondary</span>
          <input
            type="color"
            :value="palette.genderChartSecondary"
            @input="
              emit('updateColor', 'genderChartSecondary', ($event.target as HTMLInputElement).value)
            "
          />
        </label>
        <label>
          <span>Race & Ethnicity</span>
          <input
            type="color"
            :value="palette.raceChart"
            @input="emit('updateColor', 'raceChart', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          <span>Font Family</span>
          <select
            :value="graphDisplay.fontFamily"
            @change="
              emit(
                'updateGraphSetting',
                'fontFamily',
                ($event.target as HTMLSelectElement).value as GraphDisplaySettings['fontFamily']
              )
            "
          >
            <option value="Inter">Inter</option>
            <option value="Roboto Slab">Roboto Slab</option>
            <option value="JetBrains Mono">JetBrains Mono</option>
          </select>
        </label>
        <label>
          <span>Text Size · {{ graphDisplay.fontSize }}px</span>
          <input
            type="range"
            min="10"
            max="18"
            :value="graphDisplay.fontSize"
            @input="
              emit(
                'updateGraphSetting',
                'fontSize',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Value Size · {{ graphDisplay.valueFontSize }}px</span>
          <input
            type="range"
            min="10"
            max="20"
            :value="graphDisplay.valueFontSize"
            @input="
              emit(
                'updateGraphSetting',
                'valueFontSize',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Bar Thickness · {{ graphDisplay.barThickness }}px</span>
          <input
            type="range"
            min="5"
            max="16"
            :value="graphDisplay.barThickness"
            @input="
              emit(
                'updateGraphSetting',
                'barThickness',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Class Graph Height · {{ graphDisplay.classChartHeight }}px</span>
          <input
            type="range"
            min="220"
            max="420"
            step="10"
            :value="graphDisplay.classChartHeight"
            @input="
              emit(
                'updateGraphSetting',
                'classChartHeight',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
        <label>
          <span>Gender Graph Height · {{ graphDisplay.genderChartHeight }}px</span>
          <input
            type="range"
            min="220"
            max="420"
            step="10"
            :value="graphDisplay.genderChartHeight"
            @input="
              emit(
                'updateGraphSetting',
                'genderChartHeight',
                Number(($event.target as HTMLInputElement).value)
              )
            "
          />
        </label>
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
          {{ firstChoicePct }}%
        </div>
        <div style="font-size: 12.5px; color: #5a6b52; font-weight: 500">
          1st Choice Assignment Rate
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
          Returned for 2+ Semesters · {{ returningCount }} students
        </div>
      </div>
    </div>

    <!-- Student profile charts -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px">
      <div id="insight-class-standing" class="stat-card">
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
        <div :style="{ height: `${graphDisplay.classChartHeight}px` }">
          <Bar :data="classData" :options="barOptions" />
        </div>
      </div>
      <div id="insight-major-distribution" class="stat-card">
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
                fontSize: `${graphDisplay.fontSize}px`,
                fontFamily: graphDisplay.fontFamily,
                fontWeight: 600,
              }"
              >{{ name }}</span
            >
            <span
              class="mono"
              :style="{
                fontSize: `${graphDisplay.valueFontSize}px`,
                fontFamily: graphDisplay.fontFamily,
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
              height: `${graphDisplay.barThickness}px`,
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
          {{ demographicPeriod }} census data supplied by the EPICS program ·
          {{ officialDemographicTotal }} students
        </p>
      </div>
      <div class="demographic-filters">
        <select
          v-model="demographicPeriod"
          aria-label="Filter official demographics by reporting period"
        >
          <option value="All Recorded Semesters">Since Program Beginning</option>
          <option value="Fall 2025">Fall 2025</option>
        </select>
        <select v-model="demographicCourse" aria-label="Filter official demographics by course">
          <option value="all">EPCS 2200 + 3200</option>
          <option v-for="course in officialCourses" :key="course" :value="course">
            {{ course }}
          </option>
        </select>
      </div>
    </div>

    <!-- Official demographic charts -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px">
      <div id="insight-gender-distribution" class="stat-card">
        <div class="chart-title-row">
          <div class="font-display">Gender Distribution</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('gender-distribution') }"
            @click="
              pinInsight(
                'gender-distribution',
                'Gender Distribution',
                `${demographicPeriod} · ${demographicCourse === 'all' ? 'EPCS 2200 + 3200' : demographicCourse}`
              )
            "
          >
            {{ isPinned('gender-distribution') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <div :style="{ height: `${graphDisplay.genderChartHeight}px` }">
          <Pie :data="genderChartData" :options="genderOptions" />
        </div>
      </div>
      <div id="insight-race-ethnicity" class="stat-card">
        <div class="chart-title-row">
          <div class="font-display">Race & Ethnicity</div>
          <button
            class="pin-button"
            :class="{ active: isPinned('race-ethnicity') }"
            @click="
              pinInsight(
                'race-ethnicity',
                'Race & Ethnicity',
                `${demographicPeriod} · ${demographicCourse === 'all' ? 'EPCS 2200 + 3200' : demographicCourse}`
              )
            "
          >
            {{ isPinned('race-ethnicity') ? 'Pinned' : 'Pin' }}
          </button>
        </div>
        <div v-for="([name, count], i) in raceData" :key="name" style="margin-bottom: 10px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
            <span
              :style="{
                fontSize: `${graphDisplay.fontSize}px`,
                fontFamily: graphDisplay.fontFamily,
                fontWeight: 600,
              }"
              >{{ name }}</span
            >
            <span
              class="mono"
              :style="{
                fontSize: `${graphDisplay.valueFontSize}px`,
                fontFamily: graphDisplay.fontFamily,
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
              height: `${graphDisplay.barThickness}px`,
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
