<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { students, projects, semesters, getSemesterLabel } from '../data'

  const semester = ref('all')
  const major = ref('all')
  const year = ref('all')
  const mentor = ref('all')
  const search = ref('')
  const expanded = ref<string | null>(null)

  const majors = Array.from(new Set(students.map((s) => s.major))).sort()
  const years = Array.from(new Set(students.map((s) => s.year))).sort()

  const filtered = computed(() =>
    students.filter((s) => {
      if (semester.value !== 'all' && !s.semesters.includes(semester.value)) return false
      if (major.value !== 'all' && s.major !== major.value) return false
      if (year.value !== 'all' && s.year !== year.value) return false
      if (mentor.value === 'yes' && !s.isMentor) return false
      if (mentor.value === 'no' && s.isMentor) return false
      if (
        search.value &&
        !s.name.toLowerCase().includes(search.value.toLowerCase()) &&
        !s.email.toLowerCase().includes(search.value.toLowerCase())
      )
        return false
      return true
    })
  )

  function toggleExpand(id: string) {
    expanded.value = expanded.value === id ? null : id
  }

  function getProject(id: string) {
    return projects.find((p) => p.id === id)
  }
</script>

<template>
  <div style="padding: 28px 32px">
    <h1
      class="font-display"
      style="font-size: 20px; font-weight: 700; color: #1a3a1a; margin-bottom: 18px"
    >
      Students
    </h1>

    <div class="filter-bar" style="margin-bottom: 16px">
      <input
        type="search"
        placeholder="Search name or email…"
        v-model="search"
        style="width: 220px"
      />
      <select v-model="semester">
        <option value="all">All Semesters</option>
        <option v-for="s in semesters" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
      <select v-model="major">
        <option value="all">All Majors</option>
        <option v-for="m in majors" :key="m" :value="m">{{ m }}</option>
      </select>
      <select v-model="year">
        <option value="all">All Years</option>
        <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
      </select>
      <select v-model="mentor">
        <option value="all">Mentors: All</option>
        <option value="yes">Mentors Only</option>
        <option value="no">Non-Mentors</option>
      </select>
      <span style="color: #5a6b52; font-size: 12px; margin-left: auto"
        >{{ filtered.length }} results</span
      >
    </div>

    <div class="stat-card" style="padding: 0; overflow: hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Major</th>
            <th>Year</th>
            <th>Gender</th>
            <th>Meeting Day</th>
            <th>Semesters</th>
            <th>Projects</th>
            <th>Skills</th>
            <th>Mentor</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="s in filtered" :key="s.id">
            <tr @click="toggleExpand(s.id)" style="cursor: pointer">
              <td>
                <div style="font-weight: 600">{{ s.name }}</div>
                <div style="font-size: 11px; color: #5a6b52">{{ s.email }}</div>
              </td>
              <td>{{ s.major }}</td>
              <td>
                <span class="mono">{{ s.year }}</span>
              </td>
              <td>
                <span class="mono" style="font-size: 11px">{{ s.gender }}</span>
              </td>
              <td style="color: #5a6b52">{{ s.meetingDay }}</td>
              <td>
                <span class="badge" style="background: #d4edda; color: #145214">{{
                  s.semesters.length
                }}</span>
              </td>
              <td>
                <span class="badge" style="background: #f3e8ff; color: #7e22ce">{{
                  s.projects.length
                }}</span>
              </td>
              <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; max-width: 200px">
                  <span
                    v-for="sk in s.skills.slice(0, 2)"
                    :key="sk"
                    class="badge"
                    style="background: #fff8f4; color: #a0440e; font-size: 10.5px"
                    >{{ sk }}</span
                  >
                  <span v-if="s.skills.length > 2" style="font-size: 10.5px; color: #5a6b52"
                    >+{{ s.skills.length - 2 }}</span
                  >
                </div>
              </td>
              <td>
                <span v-if="s.isMentor" class="badge" style="background: #fef9c3; color: #854d0e"
                  >Mentor</span
                >
              </td>
            </tr>
            <tr v-if="expanded === s.id" style="background: #f6f8f3">
              <td colspan="9" style="padding: 12px 18px">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px">
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      Semesters Enrolled
                    </div>
                    <div
                      v-for="sem in s.semesters"
                      :key="sem"
                      style="font-size: 12px; color: #1a3a1a; margin-bottom: 3px"
                    >
                      · {{ getSemesterLabel(sem) }}
                    </div>
                  </div>
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      Projects
                    </div>
                    <div
                      v-for="pid in s.projects"
                      :key="pid"
                      style="font-size: 12px; color: #1a3a1a; margin-bottom: 3px"
                    >
                      · {{ getProject(pid)?.name }}
                    </div>
                  </div>
                  <div>
                    <div
                      style="
                        font-size: 10.5px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #5a6b52;
                        margin-bottom: 6px;
                      "
                    >
                      All Skills
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap">
                      <span
                        v-for="sk in s.skills"
                        :key="sk"
                        class="badge"
                        style="background: #fff8f4; color: #a0440e; font-size: 10.5px"
                        >{{ sk }}</span
                      >
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
