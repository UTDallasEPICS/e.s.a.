/**
 * GET /api/team-formation/tie-breaks?semesterId=&day=WEDNESDAY|THURSDAY&maxTeamSize=6&topN=3
 *
 * A read-only report on who is competing for each project and in what order the tie-break rules
 * put them, so staff can see why a contested spot went the way it did. Nothing is written.
 *
 * A project is "contested" when more students ranked it in their top N than a team can hold.
 * Within a project, students are ordered by the same rules the solver uses for its tie-break:
 *   1. higher choice position (1st pick before 2nd),
 *   2. 3200 before 2200,
 *   3. has done 3200 before,
 *   4. more semesters in EPICS,
 *   5. better skill fit (local TF-IDF of the student's skills vs the project's skills).
 * With `skillProvider=gemini` (and a key on the server) the skill-fit column shows Gemini's 0-1
 * score for contested projects, the same numbers the solver uses; otherwise the local TF-IDF.
 * `placedHere` says where the board actually has them, which is what the solver decided.
 * Also returns students who are not on any team yet.
 */
import {prisma} from '#server/utils/prisma'
import {getPriorExperience} from '#server/utils/priorExperience'
import {tfidfScores} from '#server/utils/skillFit'
import {computeSkillScoresDetailed, resolveProvider} from '#server/services/skillFitService'

type MeetingDay = 'WEDNESDAY' | 'THURSDAY'

const CLASS_LABEL: Record<string, string> = {EPCS_3200: '3200', EPCS_2200: '2200'}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const semesterId = String(query.semesterId ?? '')
  const day = String(query.day ?? '') as MeetingDay
  const maxTeamSize = Math.max(1, Math.floor(Number(query.maxTeamSize) || 6))
  const topN = Math.min(6, Math.max(1, Math.floor(Number(query.topN) || 3)))

  if (!semesterId) throw createError({statusCode: 400, message: 'semesterId is required.'})
  if (day !== 'WEDNESDAY' && day !== 'THURSDAY') {
    throw createError({statusCode: 400, message: 'day must be WEDNESDAY or THURSDAY.'})
  }

  const students = await prisma.student.findMany({
    where: {isMentor: false, Enrollments: {some: {semesterId, meetingDay: day}}},
    include: {Choices: {where: {semesterId}}, Enrollments: {where: {semesterId}}},
  })
  const teams = await prisma.team.findMany({
    where: {semesterId, meetingDay: day},
    include: {Project: true, Memberships: {where: {isMentor: false}}},
  })
  const prior = await getPriorExperience(students.map((s) => s.id), semesterId)

  const projectById = new Map(teams.map((t) => [t.projectId, t.Project] as const))
  const placement = new Map<string, {projectId: string; projectName: string; locked: boolean}>()
  for (const t of teams) {
    for (const m of t.Memberships) {
      placement.set(m.studentId, {projectId: t.projectId, projectName: t.Project.name, locked: m.locked})
    }
  }

  const provider = resolveProvider(typeof query.skillProvider === 'string' ? query.skillProvider : undefined)

  const fit = tfidfScores(
    Object.fromEntries(students.map((s) => [s.id, s.Enrollments[0]?.skills ?? ''])),
    Object.fromEntries(teams.map((t) => [t.projectId, t.Project.skills ?? '']))
  )

  interface Candidate {
    studentId: string
    name: string
    className: string
    position: number
    prior3200Semesters: number
    priorSemesters: number
    skills: string
    skillFit: number | null // null when the student or the project has no skills text
    placedHere: boolean
    placedAt: string | null
    locked: boolean
    why: string | null // why this student is ahead of the next one down the list
  }

  const wantingByProject = new Map<string, Candidate[]>()
  const unplaced: {
    studentId: string
    name: string
    className: string
    topChoice: string | null
    hasBid: boolean
    skills: string
  }[] = []

  for (const s of students) {
    const e = s.Enrollments[0]
    if (!e) continue
    const name = `${s.firstName} ${s.lastName}`.trim()
    const className = CLASS_LABEL[e.class] ?? String(e.class)
    const choices = s.Choices.slice()
      .sort((a, b) => a.rank - b.rank)
      .filter((c) => projectById.has(c.projectId))
    const placed = placement.get(s.id)

    if (!placed) {
      unplaced.push({
        studentId: s.id,
        name,
        className,
        topChoice: choices[0] ? projectById.get(choices[0].projectId)!.name : null,
        hasBid: choices.length > 0,
        skills: e.skills ?? '',
      })
    }

    choices.slice(0, topN).forEach((c, i) => {
      const project = projectById.get(c.projectId)!
      const hasText = !!(e.skills ?? '').trim() && !!(project.skills ?? '').trim()
      const experience = prior.get(s.id)
      const list = wantingByProject.get(c.projectId) ?? []
      list.push({
        studentId: s.id,
        name,
        className,
        position: i + 1,
        prior3200Semesters: experience?.prior3200Semesters ?? 0,
        priorSemesters: experience?.priorSemesters ?? 0,
        skills: e.skills ?? '',
        skillFit: hasText ? (fit.get(`${s.id}|${c.projectId}`) ?? 0) : null,
        placedHere: placed?.projectId === c.projectId,
        placedAt: placed?.projectName ?? null,
        locked: placed?.locked ?? false,
        why: null,
      })
      wantingByProject.set(c.projectId, list)
    })
  }

  // Ask Gemini only for projects that are actually contested here, and only if asked to.
  let skillSource: 'tfidf' | 'gemini' = 'tfidf'
  let skillNote: string | null = null
  if (provider === 'gemini') {
    const {scores, stats} = await computeSkillScoresDetailed(
      'gemini',
      students.map((s) => ({
        id: s.id,
        skills: s.Enrollments[0]?.skills ?? '',
        choices: s.Choices.slice()
          .sort((a, b) => a.rank - b.rank)
          .map((c) => projectById.get(c.projectId)?.name)
          .filter((n): n is string => !!n),
      })),
      teams.map((t) => ({name: t.Project.name, skills: t.Project.skills ?? ''})),
      maxTeamSize,
      topN
    )
    for (const [projectId, list] of wantingByProject) {
      const name = projectById.get(projectId)!.name
      for (const c of list) {
        const g = scores[c.studentId]?.[name]
        if (g !== undefined) c.skillFit = g
      }
    }
    skillSource = stats.provider
    if (stats.projectsFellBack.length || stats.error) {
      skillNote = `Gemini could not score ${stats.projectsFellBack.length || 'some'} project(s); those show the local score.${stats.error ? ` (${stats.error})` : ''}`
    }
  }

  const rank3200 = (c: Candidate) => (c.className === '3200' ? 0 : 1)
  const compare = (a: Candidate, b: Candidate) =>
    a.position - b.position ||
    rank3200(a) - rank3200(b) ||
    Number(b.prior3200Semesters > 0) - Number(a.prior3200Semesters > 0) ||
    b.priorSemesters - a.priorSemesters ||
    (b.skillFit ?? 0) - (a.skillFit ?? 0) ||
    a.name.localeCompare(b.name)

  function whyAhead(a: Candidate, b: Candidate): string {
    if (a.position !== b.position) return `ranked it higher (#${a.position} vs #${b.position})`
    if (a.className !== b.className) return `${a.className} before ${b.className}`
    if (a.prior3200Semesters > 0 !== b.prior3200Semesters > 0) return 'has done 3200 before'
    if (a.priorSemesters !== b.priorSemesters) return `more semesters (${a.priorSemesters} vs ${b.priorSemesters})`
    const fa = a.skillFit ?? 0
    const fb = b.skillFit ?? 0
    if (Math.abs(fa - fb) >= 0.005) return `better skill fit (${fa.toFixed(2)} vs ${fb.toFixed(2)})`
    return 'tied on every rule (name order only)'
  }

  const contested = [...wantingByProject]
    .filter(([, list]) => list.length > maxTeamSize)
    .map(([projectId, list]) => {
      const project = projectById.get(projectId)!
      const sorted = list.slice().sort(compare)
      sorted.forEach((c, i) => (c.why = sorted[i + 1] ? whyAhead(c, sorted[i + 1]!) : null))
      return {
        projectId,
        projectName: project.name,
        projectSkills: project.skills ?? '',
        seats: maxTeamSize,
        wanting: sorted,
      }
    })
    .sort((a, b) => b.wanting.length - b.seats - (a.wanting.length - a.seats) || a.projectName.localeCompare(b.projectName))

  return {
    topN,
    maxTeamSize,
    skillSource,
    skillNote,
    contested,
    unplaced: unplaced.sort((a, b) => a.name.localeCompare(b.name)),
  }
})
