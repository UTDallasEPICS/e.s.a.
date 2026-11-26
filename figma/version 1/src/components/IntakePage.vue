<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { projects, getPartnerById } from '../data'

  type IntakeEntry = {
    id: string
    name: string
    email: string
    projectRankings: { projectId: string; rank: number }[]
    skill1: string
    skill2: string
    skill3: string
    notes: string
    submittedAt: string
  }

  const activeProjects = projects.filter((p) => p.status === 'Active')
  const maxRank = computed(() => Math.min(6, activeProjects.length))

  const name = ref('')
  const email = ref('')
  const rankings = ref<Record<string, number>>({})
  const skill1 = ref('')
  const skill2 = ref('')
  const skill3 = ref('')
  const notes = ref('')
  const submitted = ref(false)
  const entries = ref<IntakeEntry[]>([])
  const view = ref<'form' | 'submissions'>('form')

  function setRank(projectId: string, rank: number) {
    const next = { ...rankings.value }
    Object.keys(next).forEach((k) => {
      if (next[k] === rank) delete next[k]
    })
    if (next[projectId] === rank || rank === 0) delete next[projectId]
    else next[projectId] = rank
    rankings.value = next
  }

  function isRankTakenByOther(projectId: string, rank: number) {
    return Object.entries(rankings.value).some(([k, v]) => k !== projectId && v === rank)
  }

  function handleSubmit() {
    entries.value.unshift({
      id: Date.now().toString(),
      name: name.value,
      email: email.value,
      projectRankings: Object.entries(rankings.value).map(([projectId, rank]) => ({
        projectId,
        rank,
      })),
      skill1: skill1.value,
      skill2: skill2.value,
      skill3: skill3.value,
      notes: notes.value,
      submittedAt: new Date().toLocaleString(),
    })
    submitted.value = true
  }

  function reset() {
    name.value = ''
    email.value = ''
    rankings.value = {}
    skill1.value = ''
    skill2.value = ''
    skill3.value = ''
    notes.value = ''
    submitted.value = false
  }

  function getProjectName(id: string) {
    return projects.find((p) => p.id === id)?.name ?? id
  }

  const skillFields = computed(() => [
    { label: 'Skill 1 *', model: skill1 },
    { label: 'Skill 2 *', model: skill2 },
    { label: 'Skill 3', model: skill3 },
  ])
</script>

<template>
  <div style="padding: 28px 32px">
    <div
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
      "
    >
      <div>
        <h1
          class="font-display"
          style="font-size: 20px; font-weight: 700; color: #1a3a1a; margin-bottom: 4px"
        >
          Student Intake Form
        </h1>
        <p style="font-size: 12.5px; color: #5a6b52">
          Students fill out their project preferences, skills, and any notes for the semester.
        </p>
      </div>
      <div style="display: flex; gap: 8px">
        <button
          @click="view = 'form'"
          :style="{
            padding: '7px 16px',
            borderRadius: '6px',
            border: '1px solid #cdd8c5',
            background: view === 'form' ? '#1a3a1a' : '#fff',
            color: view === 'form' ? '#fff' : '#1a3a1a',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter',
          }"
        >
          Form
        </button>
        <button
          @click="view = 'submissions'"
          :style="{
            padding: '7px 16px',
            borderRadius: '6px',
            border: '1px solid #cdd8c5',
            background: view === 'submissions' ? '#1a3a1a' : '#fff',
            color: view === 'submissions' ? '#fff' : '#1a3a1a',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter',
          }"
        >
          Submissions
          <span
            v-if="entries.length > 0"
            style="
              background: #c45c1a;
              color: #fff;
              border-radius: 10px;
              padding: 1px 7px;
              font-size: 11px;
              margin-left: 4px;
            "
            >{{ entries.length }}</span
          >
        </button>
      </div>
    </div>

    <!-- Form view -->
    <template v-if="view === 'form'">
      <!-- Success state -->
      <div
        v-if="submitted"
        class="stat-card"
        style="max-width: 580px; text-align: center; padding: 48px 32px"
      >
        <div style="font-size: 40px; margin-bottom: 16px">✅</div>
        <h2
          class="font-display"
          style="font-size: 18px; font-weight: 700; color: #1a3a1a; margin-bottom: 8px"
        >
          Submission Received
        </h2>
        <p style="color: #5a6b52; font-size: 13px; margin-bottom: 24px">
          Thanks! Your preferences and skills have been recorded for this semester.
        </p>
        <button
          @click="reset"
          style="
            padding: 9px 22px;
            background: #c45c1a;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: Inter;
          "
        >
          Submit Another Response
        </button>
      </div>

      <!-- Form -->
      <form
        v-else
        @submit.prevent="handleSubmit"
        style="max-width: 680px; display: flex; flex-direction: column; gap: 22px"
      >
        <!-- Basic info -->
        <div class="stat-card" style="display: flex; flex-direction: column; gap: 14px">
          <div
            class="font-display"
            style="font-weight: 700; font-size: 14px; color: #1a3a1a; margin-bottom: 2px"
          >
            Your Information
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px">
            <div>
              <label
                style="
                  display: block;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #5a6b52;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                "
                >Full Name *</label
              >
              <input
                required
                type="text"
                v-model="name"
                placeholder="e.g. Jordan Kim"
                style="
                  width: 100%;
                  padding: 8px 11px;
                  border-radius: 6px;
                  border: 1px solid #cdd8c5;
                  font-size: 13px;
                  font-family: Inter;
                  background: #fafaf8;
                  color: #1a1200;
                "
              />
            </div>
            <div>
              <label
                style="
                  display: block;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #5a6b52;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                "
                >University Email *</label
              >
              <input
                required
                type="email"
                v-model="email"
                placeholder="e.g. jkim@uni.edu"
                style="
                  width: 100%;
                  padding: 8px 11px;
                  border-radius: 6px;
                  border: 1px solid #cdd8c5;
                  font-size: 13px;
                  font-family: Inter;
                  background: #fafaf8;
                  color: #1a1200;
                "
              />
            </div>
          </div>
        </div>

        <!-- Project preferences -->
        <div class="stat-card">
          <div
            class="font-display"
            style="font-weight: 700; font-size: 14px; color: #1a3a1a; margin-bottom: 4px"
          >
            Project Preferences
          </div>
          <p style="font-size: 12px; color: #5a6b52; margin-bottom: 14px">
            Rank up to {{ maxRank }} projects using 1 (most preferred) to {{ maxRank }}. Leave
            unranked to skip a project.
          </p>
          <div style="border-radius: 6px; overflow: hidden; border: 1px solid #cdd8c5">
            <div
              style="
                display: grid;
                grid-template-columns: 1fr auto;
                padding: 7px 14px;
                background: #e8ede4;
              "
            >
              <span
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                "
                >Project</span
              >
              <span
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                "
                >Rank</span
              >
            </div>
            <div
              v-for="(pr, i) in activeProjects"
              :key="pr.id"
              :style="{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                padding: '11px 14px',
                borderTop: i === 0 ? 'none' : '1px solid #cdd8c5',
                background: rankings[pr.id] ? '#fff8f4' : '#fff',
              }"
            >
              <div>
                <div style="font-weight: 600; font-size: 13px; color: #1a3a1a">{{ pr.name }}</div>
                <div style="font-size: 11.5px; color: #5a6b52">
                  {{ getPartnerById(pr.partnerId)?.name }} · {{ pr.description.slice(0, 60) }}…
                </div>
              </div>
              <div style="display: flex; gap: 5px; align-items: center">
                <button
                  v-for="r in maxRank"
                  :key="r"
                  type="button"
                  :title="isRankTakenByOther(pr.id, r) ? `Rank ${r} already used` : `Rank ${r}`"
                  @click="!isRankTakenByOther(pr.id, r) && setRank(pr.id, r)"
                  :style="{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '2px solid',
                    borderColor:
                      rankings[pr.id] === r
                        ? '#c45c1a'
                        : isRankTakenByOther(pr.id, r)
                          ? '#e2e8dc'
                          : '#cdd8c5',
                    background:
                      rankings[pr.id] === r
                        ? '#c45c1a'
                        : isRankTakenByOther(pr.id, r)
                          ? '#f2f0eb'
                          : '#fff',
                    color:
                      rankings[pr.id] === r
                        ? '#fff'
                        : isRankTakenByOther(pr.id, r)
                          ? '#bbb'
                          : '#5a6b52',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: isRankTakenByOther(pr.id, r) ? 'not-allowed' : 'pointer',
                    fontFamily: 'JetBrains Mono',
                    transition: 'all 0.15s',
                  }"
                >
                  {{ r }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div class="stat-card" style="display: flex; flex-direction: column; gap: 14px">
          <div>
            <div
              class="font-display"
              style="font-weight: 700; font-size: 14px; color: #1a3a1a; margin-bottom: 4px"
            >
              Top 3 Skills
            </div>
            <p style="font-size: 12px; color: #5a6b52">
              List the three skills most relevant to your EPICS work (e.g. React, Python, CAD, UX
              Design).
            </p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px">
            <div>
              <label
                style="
                  display: block;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #5a6b52;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                "
                >Skill 1 *</label
              >
              <input
                required
                type="text"
                v-model="skill1"
                placeholder="e.g. Python"
                style="
                  width: 100%;
                  padding: 8px 11px;
                  border-radius: 6px;
                  border: 1px solid #cdd8c5;
                  font-size: 13px;
                  font-family: Inter;
                  background: #fafaf8;
                  color: #1a1200;
                "
              />
            </div>
            <div>
              <label
                style="
                  display: block;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #5a6b52;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                "
                >Skill 2 *</label
              >
              <input
                required
                type="text"
                v-model="skill2"
                placeholder="e.g. React"
                style="
                  width: 100%;
                  padding: 8px 11px;
                  border-radius: 6px;
                  border: 1px solid #cdd8c5;
                  font-size: 13px;
                  font-family: Inter;
                  background: #fafaf8;
                  color: #1a1200;
                "
              />
            </div>
            <div>
              <label
                style="
                  display: block;
                  font-size: 11.5px;
                  font-weight: 600;
                  color: #5a6b52;
                  margin-bottom: 5px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                "
                >Skill 3</label
              >
              <input
                type="text"
                v-model="skill3"
                placeholder="e.g. SQL"
                style="
                  width: 100%;
                  padding: 8px 11px;
                  border-radius: 6px;
                  border: 1px solid #cdd8c5;
                  font-size: 13px;
                  font-family: Inter;
                  background: #fafaf8;
                  color: #1a1200;
                "
              />
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="stat-card">
          <div
            class="font-display"
            style="font-weight: 700; font-size: 14px; color: #1a3a1a; margin-bottom: 4px"
          >
            Additional Notes
          </div>
          <p style="font-size: 12px; color: #5a6b52; margin-bottom: 12px">
            Anything else you'd like Andrea to know — scheduling constraints, past experience,
            interests, or questions.
          </p>
          <textarea
            v-model="notes"
            placeholder="e.g. I have experience with the City Food Bank from last semester and would love to continue that work. I'm also available Monday/Wednesday only."
            rows="5"
            style="
              width: 100%;
              padding: 10px 12px;
              border-radius: 6px;
              border: 1px solid #cdd8c5;
              font-size: 13px;
              font-family: Inter;
              background: #fafaf8;
              color: #1a1200;
              resize: vertical;
              line-height: 1.6;
            "
          />
        </div>

        <div style="display: flex; gap: 12px; align-items: center">
          <button
            type="submit"
            style="
              padding: 10px 28px;
              background: #c45c1a;
              color: #fff;
              border: none;
              border-radius: 6px;
              font-size: 13.5px;
              font-weight: 700;
              cursor: pointer;
              font-family: Inter;
            "
          >
            Submit Preferences
          </button>
          <button
            type="button"
            @click="reset"
            style="
              padding: 10px 18px;
              background: none;
              color: #5a6b52;
              border: 1px solid #cdd8c5;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
              font-family: Inter;
            "
          >
            Reset
          </button>
        </div>
      </form>
    </template>

    <!-- Submissions view -->
    <template v-else>
      <div
        v-if="entries.length === 0"
        class="stat-card"
        style="max-width: 480px; text-align: center; padding: 40px 32px; color: #5a6b52"
      >
        <div style="font-size: 32px; margin-bottom: 12px">📭</div>
        <p style="font-size: 13px">
          No submissions yet. Share the form with students to collect responses.
        </p>
      </div>
      <div v-else style="display: flex; flex-direction: column; gap: 14px">
        <div v-for="entry in entries" :key="entry.id" class="stat-card">
          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 14px;
            "
          >
            <div>
              <div style="font-weight: 700; font-size: 15px; color: #1a3a1a">{{ entry.name }}</div>
              <div style="font-size: 12px; color: #5a6b52">
                {{ entry.email }} · Submitted {{ entry.submittedAt }}
              </div>
            </div>
            <span class="badge" style="background: #d4edda; color: #145214">Received</span>
          </div>
          <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 20px">
            <div>
              <div
                style="
                  font-size: 10.5px;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  color: #5a6b52;
                  margin-bottom: 8px;
                "
              >
                Project Rankings
              </div>
              <span
                v-if="entry.projectRankings.length === 0"
                style="font-size: 12px; color: #5a6b52"
                >No rankings provided</span
              >
              <div
                v-else
                v-for="r in [...entry.projectRankings].sort((a, b) => a.rank - b.rank)"
                :key="r.projectId"
                style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px"
              >
                <span
                  style="
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background: #c45c1a;
                    color: #fff;
                    font-size: 11px;
                    font-weight: 700;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'JetBrains Mono';
                    flex-shrink: 0;
                  "
                  >{{ r.rank }}</span
                >
                <span style="font-size: 12.5px">{{ getProjectName(r.projectId) }}</span>
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
                  margin-bottom: 8px;
                "
              >
                Skills
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px">
                <span
                  v-for="sk in [entry.skill1, entry.skill2, entry.skill3].filter(Boolean)"
                  :key="sk"
                  class="badge"
                  style="background: #fff8f4; color: #a0440e; align-self: flex-start"
                  >{{ sk }}</span
                >
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
                  margin-bottom: 8px;
                "
              >
                Notes
              </div>
              <p v-if="entry.notes" style="font-size: 12.5px; color: #1a3a1a; line-height: 1.6">
                {{ entry.notes }}
              </p>
              <span v-else style="font-size: 12.5px; color: #5a6b52; font-style: italic">None</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
