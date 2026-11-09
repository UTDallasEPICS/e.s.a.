/**
 * GET /api/team-formation/finalize-summary?semesterId=&day=WEDNESDAY|THURSDAY&minTeamSize=4&maxTeamSize=6&min3200=1
 *
 * Everything the Finalize step shows for one day, in one read-only call: a readiness checklist,
 * how well students did on their picks, one row per team, and the students staff should look at
 * before signing off. Nothing is written. Same rules as the board's own warnings (team size,
 * 3200 coverage, "not top 3"), so this page never disagrees with the Manage Teams cards.
 */
import {prisma} from '#server/utils/prisma'

type MeetingDay = 'WEDNESDAY' | 'THURSDAY'
type CheckStatus = 'pass' | 'warn' | 'fail'

const CLASS_LABEL: Record<string, string> = {EPCS_3200: '3200', EPCS_2200: '2200'}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const semesterId = String(query.semesterId ?? '')
  const day = String(query.day ?? '') as MeetingDay
  const minTeamSize = Math.max(1, Math.floor(Number(query.minTeamSize) || 4))
  const maxTeamSize = Math.max(minTeamSize, Math.floor(Number(query.maxTeamSize) || 6))
  const min3200 = Math.max(0, Math.floor(Number(query.min3200 ?? 1)))

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
    include: {Project: {include: {Partner: true}}, Memberships: {include: {Student: true}}},
  })

  const studentById = new Map(students.map((s) => [s.id, s] as const))
  const nameOf = (s: {firstName: string; lastName: string}) => `${s.firstName} ${s.lastName}`.trim()
  const classOf = (id: string) => CLASS_LABEL[studentById.get(id)?.Enrollments[0]?.class ?? ''] ?? '?'
  const rankOf = (studentId: string, projectId: string) =>
    studentById.get(studentId)?.Choices.find((c) => c.projectId === projectId)?.rank ?? null
  const isNoBid = (id: string) =>
    !!studentById.get(id)?.Enrollments[0]?.noBid

  // ── Placement outcomes ──────────────────────────────────────────────────────
  const placedProjectByStudent = new Map<string, {teamId: string; projectId: string; projectName: string}>()
  for (const t of teams) {
    for (const m of t.Memberships) {
      if (!m.isMentor) {
        placedProjectByStudent.set(m.studentId, {teamId: t.id, projectId: t.projectId, projectName: t.Project.name})
      }
    }
  }

  const dist = {first: 0, second: 0, third: 0, fourthOrLower: 0, noBid: 0}
  const attention: {
    studentId: string
    name: string
    className: string
    placedAt: string
    pickLabel: string
    firstChoice: string | null
  }[] = []
  const unplaced: {studentId: string; name: string; className: string; firstChoice: string | null; hasBid: boolean}[] = []
  const projectNameById = new Map(teams.map((t) => [t.projectId, t.Project.name] as const))

  for (const s of students) {
    const sorted = s.Choices.slice().sort((a, b) => a.rank - b.rank)
    const firstChoice = sorted[0] ? (projectNameById.get(sorted[0].projectId) ?? null) : null
    const placed = placedProjectByStudent.get(s.id)
    if (!placed) {
      unplaced.push({studentId: s.id, name: nameOf(s), className: classOf(s.id), firstChoice, hasBid: sorted.length > 0})
      continue
    }
    if (isNoBid(s.id)) {
      dist.noBid++
      continue
    }
    const rank = rankOf(s.id, placed.projectId)
    if (rank === 1) dist.first++
    else if (rank === 2) dist.second++
    else if (rank === 3) dist.third++
    else {
      dist.fourthOrLower++
      attention.push({
        studentId: s.id,
        name: nameOf(s),
        className: classOf(s.id),
        placedAt: placed.projectName,
        pickLabel: rank ? `their #${rank} pick` : 'not one of their picks',
        firstChoice,
      })
    }
  }

  const placedCount = placedProjectByStudent.size
  const bidders = placedCount - dist.noBid
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

  // ── Per-team rows ───────────────────────────────────────────────────────────
  const teamRows = teams
    .map((t) => {
      const members = t.Memberships.filter((m) => !m.isMentor)
      const mentors = t.Memberships.filter((m) => m.isMentor).map((m) => nameOf(m.Student))
      const count3200 = members.filter((m) => classOf(m.studentId) === '3200').length
      const gotTop3 = members.filter((m) => {
        if (isNoBid(m.studentId)) return false
        const r = rankOf(m.studentId, t.projectId)
        return !!r && r <= 3
      }).length
      const firstPicks = members.filter((m) => !isNoBid(m.studentId) && rankOf(m.studentId, t.projectId) === 1).length
      const warnings: string[] = []
      if (members.length) {
        if (members.length < minTeamSize) warnings.push(`Too small (${members.length}, needs ${minTeamSize})`)
        if (members.length > maxTeamSize) warnings.push(`Too big (${members.length}, max ${maxTeamSize})`)
        if (count3200 < min3200) warnings.push(count3200 ? `Only ${count3200} × 3200` : 'No 3200 student')
        if (!mentors.length) warnings.push('No mentor yet')
      }
      return {
        teamId: t.id,
        projectName: t.Project.name,
        partnerName: t.Project.Partner.name,
        size: members.length,
        count3200,
        mentors,
        firstPicks,
        gotTop3,
        locked: members.length > 0 && members.every((m) => m.locked),
        warnings,
      }
    })
    .sort((a, b) => a.projectName.localeCompare(b.projectName))

  const activeTeams = teamRows.filter((t) => t.size > 0)
  const sizeProblems = activeTeams.filter((t) => t.size < minTeamSize || t.size > maxTeamSize)
  const no3200 = activeTeams.filter((t) => t.count3200 < min3200)
  const noMentor = activeTeams.filter((t) => !t.mentors.length)
  const unlockedTeams = activeTeams.filter((t) => !t.locked)

  const check = (id: string, label: string, status: CheckStatus, detail: string) => ({id, label, status, detail})
  const checks = [
    check(
      'placed',
      'Every student has a team',
      unplaced.length ? 'fail' : 'pass',
      unplaced.length
        ? `${unplaced.length} student${unplaced.length === 1 ? ' is' : 's are'} not on a team.`
        : `All ${students.length} students are placed.`
    ),
    check(
      'sizes',
      `Team sizes are ${minTeamSize} to ${maxTeamSize}`,
      sizeProblems.length ? 'fail' : 'pass',
      sizeProblems.length
        ? `${sizeProblems.length} team${sizeProblems.length === 1 ? '' : 's'} outside the range: ${sizeProblems.map((t) => t.projectName).slice(0, 3).join(', ')}${sizeProblems.length > 3 ? '…' : ''}.`
        : 'Every team is within the range.'
    ),
    check(
      'upperclass',
      min3200 ? `Every team has ${min3200 === 1 ? 'a' : min3200} 3200 student${min3200 === 1 ? '' : 's'}` : '3200 coverage',
      min3200 && no3200.length ? 'fail' : 'pass',
      min3200 && no3200.length
        ? `${no3200.length} team${no3200.length === 1 ? '' : 's'} short on 3200s: ${no3200.map((t) => t.projectName).slice(0, 3).join(', ')}${no3200.length > 3 ? '…' : ''}.`
        : 'Every team meets the 3200 rule.'
    ),
    check(
      'mentors',
      'Every team has a mentor',
      noMentor.length ? 'warn' : 'pass',
      noMentor.length
        ? `${noMentor.length} team${noMentor.length === 1 ? ' has' : 's have'} no mentor yet. Mentors are assigned separately.`
        : 'Every team has a mentor.'
    ),
    check(
      'top3',
      'Nearly everyone is on a top-3 pick',
      dist.fourthOrLower === 0 ? 'pass' : pct(dist.fourthOrLower, bidders) > 10 ? 'warn' : 'pass',
      dist.fourthOrLower === 0
        ? 'Every student with a bid got one of their top three.'
        : `${dist.fourthOrLower} student${dist.fourthOrLower === 1 ? '' : 's'} (${pct(dist.fourthOrLower, bidders)}%) are not on a top-3 pick. See the list below.`
    ),
    check(
      'locked',
      'Teams are locked in',
      unlockedTeams.length ? 'warn' : 'pass',
      unlockedTeams.length
        ? `${unlockedTeams.length} team${unlockedTeams.length === 1 ? ' is' : 's are'} not locked yet. Making the version final locks them all.`
        : 'Every team is locked.'
    ),
  ]

  return {
    day,
    minTeamSize,
    maxTeamSize,
    min3200,
    totals: {
      students: students.length,
      placed: placedCount,
      unplaced: unplaced.length,
      teams: activeTeams.length,
      projects: teamRows.length,
      avgTeamSize: activeTeams.length ? Math.round((placedCount / activeTeams.length) * 10) / 10 : 0,
      with3200: activeTeams.length - no3200.length,
      mentored: activeTeams.length - noMentor.length,
    },
    distribution: {
      ...dist,
      bidders,
      firstPct: pct(dist.first, bidders),
      topTwoPct: pct(dist.first + dist.second, bidders),
      topThreePct: pct(dist.first + dist.second + dist.third, bidders),
    },
    checks,
    teams: teamRows,
    unplaced: unplaced.sort((a, b) => a.name.localeCompare(b.name)),
    attention: attention.sort((a, b) => a.name.localeCompare(b.name)),
  }
})
