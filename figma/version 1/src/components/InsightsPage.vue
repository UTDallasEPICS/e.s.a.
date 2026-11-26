<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Bar, Pie, Doughnut } from 'vue-chartjs'
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
  import { students, projects, partners, semesters, choices } from '../data'

  ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

  const semFilter = ref('all')

  const filteredStudents = computed(() =>
    semFilter.value === 'all'
      ? students
      : students.filter((s) => s.semesters.includes(semFilter.value))
  )

  const COLORS = ['#c45c1a', '#2d6a2d', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6']

  const genderChartData = computed(() => {
    const counts: Record<string, number> = {}
    filteredStudents.value.forEach((s) => {
      counts[s.gender] = (counts[s.gender] ?? 0) + 1
    })
    const labels: Record<string, string> = { F: 'Female', M: 'Male', NB: 'Non-Binary' }
    const entries = Object.entries(counts)
    return {
      labels: entries.map(([k]) => labels[k] ?? k),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: COLORS,
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    }
  })

  const semVolumeData = computed(() => ({
    labels: semesters.map((s) => s.label.replace(' 20', " '")),
    datasets: [
      {
        label: 'Students',
        data: semesters.map((s) => students.filter((st) => st.semesters.includes(s.id)).length),
        backgroundColor: '#c45c1a',
        borderRadius: 3,
      },
      {
        label: 'Projects',
        data: semesters.map((s) => projects.filter((p) => p.semesters.includes(s.id)).length),
        backgroundColor: '#2d6a2d',
        borderRadius: 3,
      },
    ],
  }))

  const classData = computed(() => {
    const order = ['Freshman', 'Sophomore', 'Junior', 'Senior']
    const counts: Record<string, number> = {}
    filteredStudents.value.forEach((s) => {
      counts[s.class] = (counts[s.class] ?? 0) + 1
    })
    const entries = order.filter((c) => counts[c]).map((c) => [c, counts[c]] as [string, number])
    return {
      labels: entries.map(([k]) => k),
      datasets: [
        {
          label: 'Students',
          data: entries.map(([, v]) => v),
          backgroundColor: '#10b981',
          borderRadius: 3,
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

  const firstChoicePct = Math.round(
    (choices.filter((c) => c.rank === 1).length / choices.length) * 100
  )
  const avgSemesters = (
    students.reduce((a, s) => a + s.semesters.length, 0) / students.length
  ).toFixed(1)
  const mentorPct = Math.round((students.filter((s) => s.isMentor).length / students.length) * 100)

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { font: { size: 12 }, color: '#1a3a1a' } } },
  }
  const barOptions = {
    ...chartOptions,
    scales: {
      x: { ticks: { color: '#5a6b52', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#5a6b52', font: { size: 11 } }, grid: { color: '#e8ede4' } },
    },
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
        <select v-model="semFilter">
          <option value="all">All Semesters</option>
          <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
        <button
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
        >
          Export PDF ↓
        </button>
      </div>
    </div>

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
          {{ mentorPct }}%
        </div>
        <div style="font-size: 12.5px; color: #5a6b52; font-weight: 500">Mentor Percentage</div>
      </div>
    </div>

    <!-- Charts row 1 -->
    <div style="display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; margin-bottom: 18px">
      <div class="stat-card">
        <div
          class="font-display"
          style="font-weight: 700; font-size: 13.5px; color: #1a3a1a; margin-bottom: 16px"
        >
          Student & Project Volume by Semester
        </div>
        <div style="height: 220px">
          <Bar :data="semVolumeData" :options="barOptions" />
        </div>
      </div>
      <div class="stat-card">
        <div
          class="font-display"
          style="font-weight: 700; font-size: 13.5px; color: #1a3a1a; margin-bottom: 16px"
        >
          Gender Distribution
        </div>
        <div style="height: 220px">
          <Doughnut :data="genderChartData" :options="chartOptions" />
        </div>
      </div>
    </div>

    <!-- Charts row 2 -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px">
      <div class="stat-card">
        <div
          class="font-display"
          style="font-weight: 700; font-size: 13.5px; color: #1a3a1a; margin-bottom: 16px"
        >
          Major Distribution
        </div>
        <div v-for="([name, count], i) in majorData" :key="name" style="margin-bottom: 10px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
            <span style="font-size: 12.5px">{{ name }}</span>
            <span class="mono" style="font-size: 12px; color: #5a6b52">{{ count }}</span>
          </div>
          <div style="background: #e8ede4; border-radius: 3px; height: 5px; overflow: hidden">
            <div
              :style="{
                background: COLORS[i % COLORS.length],
                height: '100%',
                width: (count / filteredStudents.length) * 100 + '%',
                borderRadius: '3px',
                transition: 'width 0.4s',
              }"
            />
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div
          class="font-display"
          style="font-weight: 700; font-size: 13.5px; color: #1a3a1a; margin-bottom: 16px"
        >
          Class Standing
        </div>
        <div style="height: 200px">
          <Bar :data="classData" :options="{ ...barOptions, indexAxis: 'y' }" />
        </div>
      </div>
    </div>
  </div>
</template>
