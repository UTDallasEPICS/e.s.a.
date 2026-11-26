/**
 * Purpose
 * Run the import verified data maintenance task.
 *
 * Inputs
 * - The project files, configuration, or data read by this task.
 *
 * Outputs
 * - The task’s output, file or database changes, or an error when a check fails.
 *
 * Pseudocode
 * Load the task inputs → run its steps → report the outcome.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../server/utils/prisma'
import type { Gender, Year, Class, ProjectStatus, ProjectMeetingDay, Season } from '../prisma/generated/client'

// Use JSON.parse to initialize data.
const data = JSON.parse(readFileSync(new URL('../app/components/verified-data.json', import.meta.url), 'utf8'))
// Define gender for the steps below.
const gender: Record<string, Gender> = { F: 'FEMALE', M: 'MALE', Other: 'OTHER', Unknown: 'UNKNOWN' }
// Define year for the steps below.
const year: Record<string, Year> = { '1st Year': 'FRESHMAN', '2nd Year': 'SOPHOMORE', '3rd Year': 'JUNIOR', '4th Year': 'SENIOR' }
// Define course for the steps below.
const course: Record<string, Class> = { 'EPCS 2200': 'EPCS_2200', 'EPCS 3200': 'EPCS_3200' }
// Define status for the steps below.
const status: Record<string, ProjectStatus> = { New: 'NEW', 'In Progress': 'RETURNING', Active: 'RETURNING', Completed: 'COMPLETE', Paused: 'HOLD', Dropped: 'WITHDRAWN' }
// Define day for the steps below.
const day: Record<string, ProjectMeetingDay> = { Wednesday: 'WEDNESDAY', Thursday: 'THURSDAY' }

// Define the helper that will main.
async function main() {
  await prisma.$transaction(async tx => {
    // Repeat the following steps for each item in data.semesters.
    for (const semester of data.semesters) {
      // Define saved for the steps below.
      const saved = await tx.semester.upsert({
        where: { year_season: { year: semester.year, season: (semester.term.toUpperCase() as Season) } },
        create: { id: semester.id, year: semester.year, season: (semester.term.toUpperCase() as Season) }, update: {},
      })
      // Check whether saved.id !== semester.id before running this branch.
      if (saved.id !== semester.id) throw new Error('Resolve the existing semester ID before importing.')
    }
    // Repeat the following steps for each item in data.partners.
    for (const partner of data.partners) {
      await tx.partner.upsert({
        where: { id: partner.id },
        create: { id: partner.id, name: partner.name }, update: { name: partner.name },
      })
      // Check whether partner.contact || partner.email before running this branch.
      if (partner.contact || partner.email) {
        // Define contact for the steps below.
        const contact = { partnerId: partner.id, name: partner.contact, email: partner.email, phone: partner.phone || null, isPrimary: true }
        await tx.contact.upsert({
          where: { id: 'SOURCE-CONTACT-' + partner.id },
          create: { id: 'SOURCE-CONTACT-' + partner.id, ...contact }, update: contact,
        })
      }
    }
    // Repeat the following steps for each item in data.projects.
    for (const project of data.projects) {
      // Define fields for the steps below.
      const fields = {
        name: project.name, partnerId: project.partnerId, description: project.description,
        type: project.type ?? 'UNKNOWN', status: status[project.status], repoURL: '',
      }
      await tx.project.upsert({ where: { id: project.id }, create: { id: project.id, ...fields }, update: fields })
    }
    // Repeat the following steps for each item in data.students.
    for (const student of data.students) {
      // Define fields for the steps below.
      const fields = {
        firstName: student.firstName, lastName: student.lastName,
        email: student.email || null, netID: student.netID || null,
      }
      await tx.student.upsert({ where: { id: student.id }, create: { id: student.id, ...fields }, update: fields })
      // Repeat the following steps for each item in student.semesters.
      for (const semesterId of student.semesters) {
        // Define enrollment for the steps below.
        const enrollment = student.enrollmentDetails[semesterId]
        // Check whether !enrollment before running this branch.
        if (!enrollment) throw new Error('Enrollment is missing source details.')
        // Define fields for the steps below.
        const fields = {
          gender: gender[enrollment.gender] ?? 'UNKNOWN', major: enrollment.major,
          year: year[enrollment.year] ?? 'UNKNOWN', class: course[enrollment.courseEnrollment] ?? 'UNKNOWN',
          meetingDay: day[enrollment.meetingDay] ?? 'UNKNOWN', skills: enrollment.skills.join(', '),
          comments: 'Imported from verified semester roster sources. Unknown fields were not supplied. Internal record IDs are not student NetIDs.',
        }
        await tx.enrollment.upsert({
          where: { studentId_semesterId: { studentId: student.id, semesterId } },
          create: { id: 'SOURCE-ENR-' + semesterId + '-' + student.id, studentId: student.id, semesterId, ...fields },
          update: fields,
        })
      }
    }
    // Repeat the following steps for each item in data.teams.
    for (const team of data.teams) {
      // Define saved for the steps below.
      const saved = await tx.team.upsert({
        where: { projectId_semesterId: { projectId: team.projectId, semesterId: team.semesterId } },
        create: { id: 'SOURCE-TEAM-' + team.semesterId + '-' + team.projectId, projectId: team.projectId, semesterId: team.semesterId, meetingDay: day[team.meetingDay] ?? 'UNKNOWN' },
        update: { meetingDay: day[team.meetingDay] ?? 'UNKNOWN' },
      })
      // Repeat the following steps for each item in team.studentIds.
      for (const studentId of team.studentIds) {
        await tx.membership.upsert({
          where: { teamId_studentId: { teamId: saved.id, studentId } },
          create: { id: 'SOURCE-MEM-' + saved.id + '-' + studentId, teamId: saved.id, studentId },
          update: {},
        })
      }
    }
    // Repeat the following steps for each item in data.choices.
    for (const choice of data.choices) {
      // Define { studentId, projectId, semesterId, rank } for the steps below.
      const { studentId, projectId, semesterId, rank } = choice
      await tx.choice.upsert({
        where: { studentId_semesterId_rank: { studentId, semesterId, rank } },
        create: { id: 'SOURCE-CHO-' + semesterId + '-' + studentId + '-' + rank, studentId, projectId, semesterId, rank },
        update: { projectId },
      })
    }
  }, { timeout: 60_000 })
  // Repeat the following steps for each item in data.semesters.
  for (const semester of data.semesters) {
    // Call console.log to run this step.
    console.log(JSON.stringify({
      semester: semester.label,
      enrollments: await prisma.enrollment.count({ where: { semesterId: semester.id } }),
      projects: await prisma.team.count({ where: { semesterId: semester.id } }),
    }))
  }
}
// Call main().finally to run this step.
main().finally(() => prisma.$disconnect())
