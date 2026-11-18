<script setup lang="ts">
  import { ref, nextTick } from 'vue'
  import { students, projects, partners, semesters, choices } from '../data'

  type Message = { role: 'user' | 'ai'; text: string }

  const messages = ref<Message[]>([
    {
      role: 'ai',
      text: 'Hi Andrea! I\'m your EPICS data assistant. Ask me anything about students, projects, partners, or program trends. For example: "How many students are in Spring 2026?" or "What\'s the first-choice assignment rate?"',
    },
  ])
  const input = ref('')
  const thinking = ref(false)
  const chatEnd = ref<HTMLElement | null>(null)

  const suggestions = [
    'How many students are in Spring 2026?',
    'How many students returned for another semester?',
    'Show first-choice assignment rate',
    'Which partners have the most projects?',
    "What's the average semesters per student?",
    'Gender breakdown of all students',
  ]

  function getAiResponse(q: string): string {
    const ql = q.toLowerCase()
    if (ql.includes('student') && ql.includes('spring 2026'))
      return `In Spring 2026, there are ${students.filter((s) => s.semesters.includes('SP26')).length} students enrolled across ${projects.filter((p) => p.semesters.includes('SP26')).length} projects.`
    if (ql.includes('return') || ql.includes('repeat')) {
      const returning = students.filter((s) => s.semesters.length > 1)
      return `${returning.length} of ${students.length} students (${Math.round((returning.length / students.length) * 100)}%) returned for at least one additional EPICS semester.`
    }
    if (ql.includes('computer science'))
      return `${students.filter((s) => s.major === 'Computer Science').length} students are majoring in Computer Science, making it the most common major in the program.`
    if (ql.includes('first choice') || ql.includes('1st choice'))
      return `${Math.round((choices.filter((c) => c.rank === 1).length / choices.length) * 100)}% of students were assigned their first-choice project. Out of ${choices.length} tracked assignments, ${choices.filter((c) => c.rank === 1).length} were first-choice matches.`
    if (ql.includes('semester') && (ql.includes('average') || ql.includes('avg')))
      return `On average, students participate in ${(students.reduce((a, s) => a + s.semesters.length, 0) / students.length).toFixed(1)} semesters. The most active students have participated in ${Math.max(...students.map((s) => s.semesters.length))} semesters.`
    if (ql.includes('partner'))
      return `The program works with ${partners.length} project partners. The most active is ${[...partners].sort((a, b) => b.activeProjects - a.activeProjects)[0].name} with ${[...partners].sort((a, b) => b.activeProjects - a.activeProjects)[0].activeProjects} active projects.`
    if (ql.includes('project') && ql.includes('active'))
      return `There are ${projects.filter((p) => p.status === 'Active').length} active projects: ${projects
        .filter((p) => p.status === 'Active')
        .map((p) => p.name)
        .join(', ')}.`
    if (ql.includes('gender')) {
      const f = students.filter((s) => s.gender === 'F').length
      const m = students.filter((s) => s.gender === 'M').length
      const nb = students.filter((s) => s.gender === 'NB').length
      return `Gender breakdown: Female ${f} (${Math.round((f / students.length) * 100)}%), Male ${m} (${Math.round((m / students.length) * 100)}%), Non-Binary ${nb} (${Math.round((nb / students.length) * 100)}%).`
    }
    if (ql.includes('race') || ql.includes('ethnicity')) {
      const counts = students.reduce<Record<string, number>>((all, student) => {
        all[student.raceEthnicity] = (all[student.raceEthnicity] ?? 0) + 1
        return all
      }, {})
      return `Race and ethnicity across all students: ${Object.entries(counts)
        .map(
          ([name, count]) => `${name} ${count} (${Math.round((count / students.length) * 100)}%)`
        )
        .join(', ')}.`
    }
    if (ql.includes('major')) {
      const counts = students.reduce<Record<string, number>>((all, student) => {
        all[student.major] = (all[student.major] ?? 0) + 1
        return all
      }, {})
      return `Major distribution: ${Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `${name} ${count}`)
        .join(', ')}.`
    }
    return `Based on the database, the program currently has ${students.length} students, ${projects.length} projects, and ${partners.length} partners across ${semesters.length} semesters. Could you be more specific about what you'd like to know?`
  }

  async function send() {
    if (!input.value.trim()) return
    const userMsg = input.value.trim()
    messages.value.push({ role: 'user', text: userMsg })
    input.value = ''
    thinking.value = true
    await nextTick()
    chatEnd.value?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(async () => {
      messages.value.push({ role: 'ai', text: getAiResponse(userMsg) })
      thinking.value = false
      await nextTick()
      chatEnd.value?.scrollIntoView({ behavior: 'smooth' })
    }, 900)
  }
</script>

<template>
  <div style="padding: 28px 32px; height: 100vh; display: flex; flex-direction: column">
    <h1
      class="font-display"
      style="font-size: 20px; font-weight: 700; color: #1a3a1a; margin-bottom: 6px"
    >
      AI Database Assistant
    </h1>
    <p style="font-size: 12.5px; color: #5a6b52; margin-bottom: 18px">
      Ask natural language questions about your EPICS program data.
    </p>

    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px">
      <button
        v-for="s in suggestions"
        :key="s"
        @click="input = s"
        style="
          padding: 5px 11px;
          background: #f2f0eb;
          border: 1px solid #cdd8c5;
          border-radius: 20px;
          font-size: 12px;
          cursor: pointer;
          color: #1a3a1a;
          font-family: Inter;
          transition: background 0.15s;
        "
        @mouseover="($event.target as HTMLElement).style.background = '#fff8f4'"
        @mouseout="($event.target as HTMLElement).style.background = '#f2f0eb'"
      >
        {{ s }}
      </button>
    </div>

    <div
      style="
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
        min-height: 0;
      "
    >
      <div
        v-for="(m, i) in messages"
        :key="i"
        style="display: flex"
        :style="{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }"
      >
        <div
          v-if="m.role === 'ai'"
          style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #1a3a1a;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            margin-right: 8px;
            flex-shrink: 0;
            margin-top: 2px;
          "
        >
          ⬡
        </div>
        <div :class="m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'">{{ m.text }}</div>
      </div>
      <div v-if="thinking" style="display: flex; align-items: center; gap: 8px">
        <div
          style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #1a3a1a;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          "
        >
          ⬡
        </div>
        <div class="chat-bubble-ai" style="color: #5a6b52; font-style: italic">
          Querying database…
        </div>
      </div>
      <div ref="chatEnd" />
    </div>

    <div style="display: flex; gap: 10px">
      <input
        type="text"
        v-model="input"
        @keydown.enter="send"
        placeholder="Ask about students, projects, partners, or trends…"
        style="flex: 1; padding: 10px 14px; font-size: 13px; border-radius: 8px"
      />
      <button
        @click="send"
        style="
          padding: 10px 20px;
          background: #1a3a1a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          font-family: Inter;
        "
      >
        Send
      </button>
    </div>
  </div>
</template>
