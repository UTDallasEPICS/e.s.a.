/**
 * Purpose
 * Provide the test logic used by other parts of ESA.
 *
 * Inputs
 * - Values passed by callers and any configuration or records imported here.
 *
 * Outputs
 * - The values, types, or functions exported by this file.
 *
 * Pseudocode
 * Load the dependencies → define the file’s rules or helpers → expose them for other files to use.
 */
// Test file for OR-Tools CP-SAT team generation algorithm
import { generateTeamsORTools } from './ortools.ts'
import type { Student, Project } from './ortools.ts'

// ===================== DATA GENERATORS =====================

const firstNames = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'William',
  'Mia',
  'James',
  'Charlotte',
  'Benjamin',
  'Amelia',
  'Lucas',
  'Harper',
  'Henry',
  'Evelyn',
  'Alexander',
  'Abigail',
  'Michael',
  'Emily',
  'Daniel',
  'Elizabeth',
  'Matthew',
  'Sofia',
  'Joseph',
  'Avery',
  'David',
  'Ella',
  'Jackson',
  'Scarlett',
  'Logan',
  'Grace',
  'Sebastian',
  'Chloe',
  'Jack',
  'Victoria',
  'Samuel',
  'Riley',
  'Owen',
  'Aria',
  'Carter',
  'Lily',
  'Wyatt',
  'Aubrey',
  'John',
  'Zoey',
  'Dylan',
]

// Define lastNames for the steps below.
const lastNames = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Green',
  'Adams',
  'Nelson',
  'Baker',
  'Hall',
  'Rivera',
  'Campbell',
  'Mitchell',
  'Carter',
  'Roberts',
]

// Define majors for the steps below.
const majors: Array<'CS' | 'SE' | 'EE' | 'ME' | 'BME' | 'DS' | 'CE' | 'Systems' | 'Other'> = [
  'CS',
  'SE',
  'EE',
  'ME',
  'CE',
  'BME',
  'DS',
]
// Define genders for the steps below.
const genders: Array<'Male' | 'Female' | 'Non-binary' | 'Prefer not to say'> = ['Male', 'Female']
// Define seniorities for the steps below.
const seniorities: Array<'Freshman' | 'Sophomore' | 'Junior' | 'Senior'> = [
  'Freshman',
  'Sophomore',
  'Junior',
  'Senior',
]

// Define the helper that will generate projects.
function generateProjects(): Project[] {
  // Real EPICS distribution:
  // Wednesday: 7 SW, 4 Both, 1 HW = 12 projects
  // Thursday: 11 SW, 5 Both, 0 HW = 16 projects
  // Total: 28 projects (18 SW, 9 Both, 1 HW)

  const swTemplates = [
    {
      name: 'AI Research Lab',
      skills: ['Python', 'Machine Learning', 'Data Analysis'],
      majors: ['CS', 'DS'],
    },
    {
      name: 'Web Platform',
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Mobile App',
      skills: ['Swift', 'Kotlin', 'React Native', 'Flutter'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Cloud Infrastructure',
      skills: ['DevOps', 'Docker', 'Kubernetes', 'AWS'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Database System',
      skills: ['SQL', 'Database Design', 'Python', 'Backend'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'ML Pipeline',
      skills: ['Python', 'TensorFlow', 'Data Analysis', 'ML'],
      majors: ['CS', 'DS'],
    },
    {
      name: 'Gaming Engine',
      skills: ['C++', 'Graphics', 'Game Design', 'Physics'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Security Platform',
      skills: ['Cybersecurity', 'Networking', 'Python', 'Cryptography'],
      majors: ['CS', 'CE'],
    },
    {
      name: 'Data Visualization',
      skills: ['JavaScript', 'D3.js', 'Data Analysis', 'Visualization'],
      majors: ['CS', 'DS'],
    },
    { name: 'Healthcare App', skills: ['React', 'Node.js', 'SQL', 'HIPAA'], majors: ['CS', 'SE'] },
    {
      name: 'Education Platform',
      skills: ['JavaScript', 'React', 'Python', 'API Design'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Finance Dashboard',
      skills: ['Python', 'SQL', 'Data Analysis', 'Visualization'],
      majors: ['CS', 'DS'],
    },
    {
      name: 'Social Impact App',
      skills: ['React Native', 'Node.js', 'MongoDB'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Accessibility Tool',
      skills: ['JavaScript', 'TypeScript', 'UX Design'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Climate Data Hub',
      skills: ['Python', 'Data Analysis', 'Visualization', 'API Design'],
      majors: ['CS', 'DS'],
    },
    {
      name: 'Volunteer Tracker',
      skills: ['React', 'Node.js', 'SQL', 'TypeScript'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Smart Campus',
      skills: ['Python', 'Machine Learning', 'IoT', 'API Design'],
      majors: ['CS', 'SE'],
    },
    {
      name: 'Food Bank System',
      skills: ['JavaScript', 'React', 'SQL', 'Node.js'],
      majors: ['CS', 'SE'],
    },
  ]

  // Define bothTemplates for the steps below.
  const bothTemplates = [
    {
      name: 'IoT Platform',
      skills: ['Embedded Systems', 'Networking', 'Arduino', 'C'],
      majors: ['EE', 'CE', 'CS'],
    },
    {
      name: 'Drone System',
      skills: ['Mechanical Design', 'Embedded Systems', 'Control Systems'],
      majors: ['ME', 'EE', 'CE'],
    },
    {
      name: 'Autonomous Vehicle',
      skills: ['Machine Learning', 'Computer Vision', 'Embedded Systems'],
      majors: ['CS', 'EE', 'ME'],
    },
    {
      name: 'Smart Agriculture',
      skills: ['Sensors', 'Embedded Systems', 'Python', 'Data Analysis'],
      majors: ['EE', 'CS', 'CE'],
    },
    {
      name: 'Wearable Health',
      skills: ['Circuit Design', 'Embedded Systems', 'Python', 'BLE'],
      majors: ['BME', 'EE', 'CS'],
    },
    {
      name: 'Robot Assistant',
      skills: ['Mechanical Design', 'Python', 'Computer Vision', 'ROS'],
      majors: ['ME', 'CS', 'EE'],
    },
    {
      name: 'Energy Monitor',
      skills: ['Circuit Design', 'Python', 'Data Analysis', 'Sensors'],
      majors: ['EE', 'CS', 'CE'],
    },
    {
      name: 'Smart Home',
      skills: ['Embedded Systems', 'Networking', 'Python', 'Arduino'],
      majors: ['CE', 'EE', 'CS'],
    },
    {
      name: 'Assistive Device',
      skills: ['Mechanical Design', 'Embedded Systems', 'Sensors'],
      majors: ['BME', 'ME', 'EE'],
    },
  ]

  // Define hwTemplates for the steps below.
  const hwTemplates = [
    {
      name: 'Robotics System',
      skills: ['Mechanical Design', 'Circuit Design', 'Embedded Systems'],
      majors: ['ME', 'EE', 'BME'],
    },
  ]

  // Define projects for the steps below.
  const projects: Project[] = []
  // Define id for the steps below.
  let id = 1

  // Wednesday: 7 SW, 4 Both, 1 HW
  const wedSW = swTemplates.slice(0, 7)
  // Use bothTemplates.slice to initialize wedBoth.
  const wedBoth = bothTemplates.slice(0, 4)
  // Use hwTemplates.slice to initialize wedHW.
  const wedHW = hwTemplates.slice(0, 1)

  // Repeat the following steps for each item in wedSW.
  for (const t of wedSW) {
    // Call projects.push to run this step.
    projects.push({ id: `p${id++}`, name: t.name, type: 'SW', day: 'Wednesday' })
  }
  // Repeat the following steps for each item in wedBoth.
  for (const t of wedBoth) {
    // Call projects.push to run this step.
    projects.push({ id: `p${id++}`, name: t.name, type: 'Both', day: 'Wednesday' })
  }
  // Repeat the following steps for each item in wedHW.
  for (const t of wedHW) {
    // Call projects.push to run this step.
    projects.push({ id: `p${id++}`, name: t.name, type: 'HW', day: 'Wednesday' })
  }

  // Thursday: 11 SW, 5 Both, 0 HW
  const thuSW = swTemplates.slice(7, 18)
  // Use bothTemplates.slice to initialize thuBoth.
  const thuBoth = bothTemplates.slice(4, 9)

  // Repeat the following steps for each item in thuSW.
  for (const t of thuSW) {
    // Call projects.push to run this step.
    projects.push({ id: `p${id++}`, name: t.name, type: 'SW', day: 'Thursday' })
  }
  // Repeat the following steps for each item in thuBoth.
  for (const t of thuBoth) {
    // Call projects.push to run this step.
    projects.push({ id: `p${id++}`, name: t.name, type: 'Both', day: 'Thursday' })
  }

  // Pass projects back to the caller.
  return projects
}

// Define the helper that will generate students.
function generateStudents(
  count: number,
  projects: Project[],
  upperClassCount: number = 37
): Student[] {
  // Define students for the steps below.
  const students: Student[] = []

  // EPICS has significantly more SW students than HW students (~75% SW, ~25% HW)
  const swMajors: Array<(typeof majors)[number]> = ['CS', 'SE', 'DS']
  // Define hwMajors for the steps below.
  const hwMajors: Array<(typeof majors)[number]> = ['EE', 'ME', 'BME', 'CE']
  // Weighted major selection: ~75% chance SW major, ~25% chance HW major
  function pickMajor(): (typeof majors)[number] {
    // Check whether Math.random() < 0.75 before running this branch.
    if (Math.random() < 0.75) {
      // Pass swMajors[Math.floor(Math.random() * swMajors.length)] back to the caller.
      return swMajors[Math.floor(Math.random() * swMajors.length)]
    } else {
      // Pass hwMajors[Math.floor(Math.random() * hwMajors.length)] back to the caller.
      return hwMajors[Math.floor(Math.random() * hwMajors.length)]
    }
  }

  // Split students across days proportionally to project count
  const wedProjects = projects.filter((p) => p.day === 'Wednesday')
  // Use projects.filter to initialize thuProjects.
  const thuProjects = projects.filter((p) => p.day === 'Thursday')
  // Define wedRatio for the steps below.
  const wedRatio = wedProjects.length / projects.length

  // Split 3200 students proportionally across days
  const wed3200Count = Math.round(upperClassCount * wedRatio)
  // Define thu3200Count for the steps below.
  const thu3200Count = upperClassCount - wed3200Count

  // Split 2200 students proportionally
  const lowerClassCount = count - upperClassCount
  // Use Math.round to initialize wed2200Count.
  const wed2200Count = Math.round(lowerClassCount * wedRatio)
  // Define thu2200Count for the steps below.
  const thu2200Count = lowerClassCount - wed2200Count

  // Build students in order: Wed 3200, Thu 3200, Wed 2200, Thu 2200
  const studentConfigs: { day: 'Wednesday' | 'Thursday'; is3200: boolean }[] = []
  for (let i = 0; i < wed3200Count; i++) studentConfigs.push({ day: 'Wednesday', is3200: true })
  for (let i = 0; i < thu3200Count; i++) studentConfigs.push({ day: 'Thursday', is3200: true })
  for (let i = 0; i < wed2200Count; i++) studentConfigs.push({ day: 'Wednesday', is3200: false })
  for (let i = 0; i < thu2200Count; i++) studentConfigs.push({ day: 'Thursday', is3200: false })

  for (let i = 0; i < studentConfigs.length; i++) {
    // Define { day, is3200 } for the steps below.
    const { day, is3200 } = studentConfigs[i]
    // Define dayProjects for the steps below.
    const dayProjects = day === 'Wednesday' ? wedProjects : thuProjects
    // Use pickMajor to initialize major.
    const major = pickMajor()
    // Define gender for the steps below.
    const gender = genders[Math.floor(Math.random() * genders.length)]
    // Define seniority for the steps below.
    const seniority = is3200
      ? Math.random() > 0.5
        ? 'Senior'
        : 'Junior'
      : Math.random() > 0.5
        ? 'Sophomore'
        : 'Freshman'

    // Generate name
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    // Define lastName for the steps below.
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    // Define name for the steps below.
    const name = `${firstName} ${lastName}`

    // Generate realistic choices ONLY from projects on the student's day
    // SW students prefer SW/Both projects; HW students prefer Both projects (since HW is scarce)
    const softwareMajors = ['CS', 'SE', 'DS']
    // Define hardwareMajors for the steps below.
    const hardwareMajors = ['EE', 'ME', 'BME', 'CE']

    // Define choices for the steps below.
    const choices: string[] = []

    // Check whether softwareMajors.includes(major) before running this branch.
    if (softwareMajors.includes(major)) {
      // SW students: top choices are SW/Both (which is most projects anyway)
      const preferredProjects = dayProjects
        .filter((p) => p.type === 'SW' || p.type === 'Both')
        .sort(() => Math.random() - 0.5)
      // Use dayProjects .filter((p) => p.type === 'HW') .sort to initialize otherProjects.
      const otherProjects = dayProjects
        .filter((p) => p.type === 'HW')
        .sort(() => Math.random() - 0.5)

      // Define topCount for the steps below.
      const topCount = 3 + Math.floor(Math.random() * 2)
      for (let j = 0; j < topCount && j < preferredProjects.length; j++) {
        // Call choices.push to run this step.
        choices.push(preferredProjects[j].name)
      }
      for (let j = 0; choices.length < 6 && j < otherProjects.length; j++) {
        // Check whether !choices.includes(otherProjects[j].name) before running this branch.
        if (!choices.includes(otherProjects[j].name)) {
          // Call choices.push to run this step.
          choices.push(otherProjects[j].name)
        }
      }
      for (let j = topCount; choices.length < 6 && j < preferredProjects.length; j++) {
        // Check whether !choices.includes(preferredProjects[j].name) before running this branch.
        if (!choices.includes(preferredProjects[j].name)) {
          // Call choices.push to run this step.
          choices.push(preferredProjects[j].name)
        }
      }
    } else if (hardwareMajors.includes(major)) {
      // HW students: prefer Both and HW projects, but also consider some SW projects
      // On days with few/no HW projects, they shouldn't stack ALL Both as top picks
      // since that creates a bottleneck. Realistically they'd find some SW projects interesting too.
      const hwAndBothProjects = dayProjects
        .filter((p) => p.type === 'HW' || p.type === 'Both')
        .sort(() => Math.random() - 0.5)
      // Use dayProjects.filter((p) => p.type === 'SW').sort to initialize swProjects.
      const swProjects = dayProjects.filter((p) => p.type === 'SW').sort(() => Math.random() - 0.5)

      // Top 3-4 picks from HW/Both
      const topCount = Math.min(3 + Math.floor(Math.random() * 2), hwAndBothProjects.length)
      for (let j = 0; j < topCount; j++) {
        // Call choices.push to run this step.
        choices.push(hwAndBothProjects[j].name)
      }

      // Mix in 1-2 SW projects they find interesting (before remaining Both projects)
      const swMix = Math.min(1 + Math.floor(Math.random() * 2), swProjects.length)
      for (let j = 0; j < swMix && choices.length < 6; j++) {
        // Call choices.push to run this step.
        choices.push(swProjects[j].name)
      }

      // Fill remaining slots with leftover Both/HW projects
      for (let j = topCount; choices.length < 6 && j < hwAndBothProjects.length; j++) {
        // Check whether !choices.includes(hwAndBothProjects[j].name) before running this branch.
        if (!choices.includes(hwAndBothProjects[j].name)) {
          // Call choices.push to run this step.
          choices.push(hwAndBothProjects[j].name)
        }
      }

      // Fill any remaining with more SW
      for (let j = swMix; choices.length < 6 && j < swProjects.length; j++) {
        // Check whether !choices.includes(swProjects[j].name) before running this branch.
        if (!choices.includes(swProjects[j].name)) {
          // Call choices.push to run this step.
          choices.push(swProjects[j].name)
        }
      }
    } else {
      // Use [...dayProjects].sort to initialize allProjects.
      const allProjects = [...dayProjects].sort(() => Math.random() - 0.5)
      for (let j = 0; j < 6 && j < allProjects.length; j++) {
        // Call choices.push to run this step.
        choices.push(allProjects[j].name)
      }
    }

    // 80% of 3200 students are returning to a previous project (first choice)
    const isReturning = is3200 && Math.random() < 0.8
    // Define previousProject for the steps below.
    const previousProject = isReturning ? choices[0] : undefined

    // Call students.push to run this step.
    students.push({
      id: `s${i + 1}`,
      name,
      major,
      seniority,
      choices,
      choicesString: choices.join(', '),
      class: is3200 ? '3200' : '2200',
      gender,
      previousProject,
      day,
    })
  }

  // Pass students back to the caller.
  return students
}

// ===================== TEST DATA =====================

const testProjects: Project[] = generateProjects()
// Use generateStudents to initialize testStudents.
const testStudents: Student[] = generateStudents(150, testProjects)

// ===================== TEST FUNCTIONS =====================

async function runTest() {
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log('OR-TOOLS CP-SAT TEAM BUILDING ALGORITHM TEST')
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log(`Total Students: ${testStudents.length}`)
  // Call console.log to run this step.
  console.log(`  - 3200 level: ${testStudents.filter((s) => s.class === '3200').length}`)
  // Call console.log to run this step.
  console.log(`  - 2200 level: ${testStudents.filter((s) => s.class === '2200').length}`)
  // Call console.log to run this step.
  console.log(`Total Projects: ${testProjects.length}`)
  // Call console.log to run this step.
  console.log()

  // Use testStudents.filter to initialize wedStudents.
  const wedStudents = testStudents.filter((s) => s.day === 'Wednesday')
  // Use testStudents.filter to initialize thuStudents.
  const thuStudents = testStudents.filter((s) => s.day === 'Thursday')
  // Use testProjects.filter to initialize wedProjects.
  const wedProjects = testProjects.filter((p) => p.day === 'Wednesday')
  // Use testProjects.filter to initialize thuProjects.
  const thuProjects = testProjects.filter((p) => p.day === 'Thursday')
  // Define swMajorsList for the steps below.
  const swMajorsList = ['CS', 'SE', 'DS']
  // Call console.log to run this step.
  console.log(
    `Wednesday: ${wedStudents.length} students (${wedStudents.filter((s) => s.class === '3200').length} 3200, ${wedStudents.filter((s) => s.class === '2200').length} 2200) → ${wedProjects.length} projects (${wedProjects.filter((p) => p.type === 'SW').length} SW, ${wedProjects.filter((p) => p.type === 'Both').length} Both, ${wedProjects.filter((p) => p.type === 'HW').length} HW)`
  )
  // Call console.log to run this step.
  console.log(
    `Thursday:  ${thuStudents.length} students (${thuStudents.filter((s) => s.class === '3200').length} 3200, ${thuStudents.filter((s) => s.class === '2200').length} 2200) → ${thuProjects.length} projects (${thuProjects.filter((p) => p.type === 'SW').length} SW, ${thuProjects.filter((p) => p.type === 'Both').length} Both, ${thuProjects.filter((p) => p.type === 'HW').length} HW)`
  )
  // Call console.log to run this step.
  console.log(
    `Majors: ${testStudents.filter((s) => swMajorsList.includes(s.major)).length} SW-track (${((testStudents.filter((s) => swMajorsList.includes(s.major)).length / testStudents.length) * 100).toFixed(0)}%), ${testStudents.filter((s) => !swMajorsList.includes(s.major)).length} HW-track (${((testStudents.filter((s) => !swMajorsList.includes(s.major)).length / testStudents.length) * 100).toFixed(0)}%)`
  )
  // Call console.log to run this step.
  console.log()

  // Run the algorithm
  const startTime = Date.now()
  // Define teams for the steps below.
  let teams: Record<string, Student[]>
  try {
    ;({ assignments: teams } = await generateTeamsORTools(testStudents, testProjects))
  } catch (err: any) {
    // Call console.error to run this step.
    console.error('CP-SAT run failed:', err?.message ?? err)
    // Call process.exit to run this step.
    process.exit(1)
  }
  // Use Date.now to initialize endTime.
  const endTime = Date.now()

  // Call console.log to run this step.
  console.log()
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log('RESULTS')
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log()

  // Display results
  for (const project of testProjects) {
    // Define team for the steps below.
    const team = teams[project.name] ?? []
    // Call console.log to run this step.
    console.log(`\n📋 ${project.name} (${project.type}) [${project.day}]`)
    // Call console.log to run this step.
    console.log(`   Team Size: ${team.length}`)

    // Count 3200 students
    const upperCount = team.filter((s) => s.class === '3200').length
    // Call console.log to run this step.
    console.log(`   3200 Students: ${upperCount} ✓`)

    // Count majors
    const hwCount = team.filter((s) => ['EE', 'ME', 'BME', 'CE'].includes(s.major)).length
    // Define swCount for the steps below.
    const swCount = team.filter((s) => ['CS', 'SE', 'DS'].includes(s.major)).length
    // Call console.log to run this step.
    console.log(`   Major Distribution: ${hwCount} HW, ${swCount} SW`)

    // Count genders
    const genderCounts = team.reduce(
      (acc, s) => {
        // Define g for the steps below.
        const g = s.gender || 'Unknown'
        // Update acc[g] with the value on the right.
        acc[g] = (acc[g] || 0) + 1
        // Pass acc back to the caller.
        return acc
      },
      {} as Record<string, number>
    )
    // Use Object.entries(genderCounts) .map(([g, c]) => `${c} ${g}`) .join to initialize genderStr.
    const genderStr = Object.entries(genderCounts)
      .map(([g, c]) => `${c} ${g}`)
      .join(', ')
    // Call console.log to run this step.
    console.log(`   Gender Distribution: ${genderStr}`)

    // Count classifications
    const classificationCounts = team.reduce(
      (acc, s) => {
        // Update acc[s.seniority] with the value on the right.
        acc[s.seniority] = (acc[s.seniority] || 0) + 1
        // Pass acc back to the caller.
        return acc
      },
      {} as Record<string, number>
    )
    // Use Object.entries(classificationCounts) .map(([c, n]) => `${n} ${c}`) .join to initialize classStr.
    const classStr = Object.entries(classificationCounts)
      .map(([c, n]) => `${n} ${c}`)
      .join(', ')
    // Call console.log to run this step.
    console.log(`   Classification: ${classStr}`)

    // Show team members (sorted: 3200 first, then 2200)
    console.log('   Members:')
    // Use [...team].sort to initialize sortedTeam.
    const sortedTeam = [...team].sort((a, b) => {
      // 3200 comes before 2200
      if (a.class === '3200' && b.class === '2200') return -1
      // Check whether a.class === '2200' && b.class === '3200' before running this branch.
      if (a.class === '2200' && b.class === '3200') return 1
      // Pass 0 back to the caller.
      return 0
    })

    // Repeat the following steps for each item in sortedTeam.
    for (const student of sortedTeam) {
      // Use student.choices.indexOf to initialize prefIndex.
      const prefIndex = student.choices.indexOf(project.name)
      // Define prefLabel for the steps below.
      const prefLabel = prefIndex === -1 ? '❌ Not in preferences' : `✓ Choice #${prefIndex + 1}`

      // Define returningLabel for the steps below.
      const returningLabel = student.previousProject === project.name ? ' 🔁 RETURNING' : ''

      // Call console.log to run this step.
      console.log(
        `     • ${student.name} (${student.major}, ${student.seniority}, ${student.class}) ${prefLabel}${returningLabel}`
      )
    }
  }

  // Call console.log to run this step.
  console.log()
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log('STATISTICS')
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log()

  // Calculate statistics
  const stats = calculateStatistics(teams, testStudents)

  // Call console.log to run this step.
  console.log(`Execution Time: ${endTime - startTime}ms`)
  // Call console.log to run this step.
  console.log()
  // Call console.log to run this step.
  console.log('Preference Satisfaction:')
  // Call console.log to run this step.
  console.log(
    `  - First Choice:  ${stats.firstChoice} students (${((stats.firstChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Second Choice: ${stats.secondChoice} students (${((stats.secondChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Third Choice:  ${stats.thirdChoice} students (${((stats.thirdChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Fourth Choice: ${stats.fourthChoice} students (${((stats.fourthChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Fifth Choice:  ${stats.fifthChoice} students (${((stats.fifthChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Sixth Choice:  ${stats.sixthChoice} students (${((stats.sixthChoice / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Not in Choices: ${stats.noMatch} students (${((stats.noMatch / testStudents.length) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('3200 Student Satisfaction:')
  // Call console.log to run this step.
  console.log(
    `  - First Choice:  ${stats.upperFirstChoice} / ${stats.totalUpper} (${((stats.upperFirstChoice / stats.totalUpper) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Top 3 Choices: ${stats.upperTop3} / ${stats.totalUpper} (${((stats.upperTop3 / stats.totalUpper) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('2200 Student Satisfaction:')
  // Call console.log to run this step.
  console.log(
    `  - First Choice:  ${stats.lowerFirstChoice} / ${stats.totalLower} (${((stats.lowerFirstChoice / stats.totalLower) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log(
    `  - Top 3 Choices: ${stats.lowerTop3} / ${stats.totalLower} (${((stats.lowerTop3 / stats.totalLower) * 100).toFixed(1)}%)`
  )
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('Team Balance:')
  // Call console.log to run this step.
  console.log(`  - Average Team Size: ${stats.avgTeamSize.toFixed(1)}`)
  // Call console.log to run this step.
  console.log(`  - Smallest Team: ${stats.minTeamSize}`)
  // Call console.log to run this step.
  console.log(`  - Largest Team: ${stats.maxTeamSize}`)
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('Major Matching:')
  // Define majorTypeMatchPercent for the steps below.
  const majorTypeMatchPercent =
    stats.totalStudents > 0
      ? ((stats.majorTypeMatches / stats.totalStudents) * 100).toFixed(1)
      : 'N/A'
  // Call console.log to run this step.
  console.log(
    `  - Students in Compatible Major Type: ${stats.majorTypeMatches} / ${stats.totalStudents} (${majorTypeMatchPercent}%)`
  )
  // Call console.log to run this step.
  console.log(`    (SW students → SW/Both projects, HW students → HW/Both projects)`)
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('Returning Students:')
  // Use testStudents.filter to initialize returningStudents.
  const returningStudents = testStudents.filter((s) => s.previousProject)
  // Use returningStudents.filter to initialize returningMatched.
  const returningMatched = returningStudents.filter((s) => {
    // Repeat the following steps for each item in Object.entries(teams).
    for (const [projectName, team] of Object.entries(teams)) {
      // Check whether team.some((t) => t.id === s.id) && projectName === s.previousProject before running this branch.
      if (team.some((t) => t.id === s.id) && projectName === s.previousProject) {
        // Pass true back to the caller.
        return true
      }
    }
    // Pass false back to the caller.
    return false
  })
  // Call console.log to run this step.
  console.log(
    `  - Returning to Same Project: ${returningMatched.length} / ${returningStudents.length} (${returningStudents.length > 0 ? ((returningMatched.length / returningStudents.length) * 100).toFixed(1) : 0}%)`
  )
  // Call console.log to run this step.
  console.log()

  // Call console.log to run this step.
  console.log('Gender Balance:')
  // Define isolatedGenderCount for the steps below.
  let isolatedGenderCount = 0
  // Repeat the following steps for each item in Object.entries(teams).
  for (const [projectName, team] of Object.entries(teams)) {
    // Define maleCount for the steps below.
    const maleCount = team.filter((s) => s.gender === 'Male').length
    // Define femaleCount for the steps below.
    const femaleCount = team.filter((s) => s.gender === 'Female').length
    // Check whether (maleCount === 1 && femaleCount > 1) || (femaleCount === 1 && maleCount > 1) before running this branch.
    if ((maleCount === 1 && femaleCount > 1) || (femaleCount === 1 && maleCount > 1)) {
      isolatedGenderCount++
    }
  }
  // Call console.log to run this step.
  console.log(
    `  - Teams with Gender Isolation: ${isolatedGenderCount} / ${Object.keys(teams).length}`
  )
  // Call console.log to run this step.
  console.log()

  // Validate constraints
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log('CONSTRAINT VALIDATION')
  // Call console.log to run this step.
  console.log('='.repeat(80))
  // Call console.log to run this step.
  console.log()

  // Use validateConstraints to initialize violations.
  const violations = validateConstraints(teams, testStudents)
  // Check whether violations.length === 0 before running this branch.
  if (violations.length === 0) {
    // Call console.log to run this step.
    console.log('✓ All constraints satisfied!')
  } else {
    // Call console.log to run this step.
    console.log('❌ Constraint violations found:')
    // Call violations.forEach to run this step.
    violations.forEach((v) => console.log(`  - ${v}`))
  }

  // Call console.log to run this step.
  console.log()
  // Call console.log to run this step.
  console.log('='.repeat(80))
}

// Define the helper that will calculate statistics.
function calculateStatistics(teams: Record<string, Student[]>, allStudents: Student[]) {
  // Define firstChoice for the steps below.
  let firstChoice = 0,
    secondChoice = 0,
    thirdChoice = 0,
    fourthChoice = 0,
    fifthChoice = 0,
    sixthChoice = 0,
    noMatch = 0
  // Define upperFirstChoice for the steps below.
  let upperFirstChoice = 0,
    upperTop3 = 0,
    totalUpper = 0
  // Define lowerFirstChoice for the steps below.
  let lowerFirstChoice = 0,
    lowerTop3 = 0,
    totalLower = 0
  // Define majorTypeMatches for the steps below.
  let majorTypeMatches = 0,
    totalStudents = 0

  // Define teamSizes for the steps below.
  const teamSizes: number[] = []
  // Define swMajors for the steps below.
  const swMajors = ['CS', 'SE', 'DS']
  // Define hwMajors for the steps below.
  const hwMajors = ['EE', 'ME', 'BME', 'CE']

  // Repeat the following steps for each item in Object.entries(teams).
  for (const [projectName, team] of Object.entries(teams)) {
    // Call teamSizes.push to run this step.
    teamSizes.push(team.length)

    // Find the project object
    const project = testProjects.find((p) => p.name === projectName)

    // Repeat the following steps for each item in team.
    for (const student of team) {
      // Use student.choices.indexOf to initialize prefIndex.
      const prefIndex = student.choices.indexOf(projectName)

      // Check whether prefIndex === 0 before running this branch.
      if (prefIndex === 0) firstChoice++
      else if (prefIndex === 1) secondChoice++
      else if (prefIndex === 2) thirdChoice++
      else if (prefIndex === 3) fourthChoice++
      else if (prefIndex === 4) fifthChoice++
      else if (prefIndex === 5) sixthChoice++
      else noMatch++ // Only counts if truly not in their choices

      // Check major TYPE matching (SW student → SW/Both project, HW student → HW/Both project)
      if (project) {
        totalStudents++
        // Use swMajors.includes to initialize isSWStudent.
        const isSWStudent = swMajors.includes(student.major)
        // Use hwMajors.includes to initialize isHWStudent.
        const isHWStudent = hwMajors.includes(student.major)
        // Define isSWProject for the steps below.
        const isSWProject = project.type === 'SW'
        // Define isHWProject for the steps below.
        const isHWProject = project.type === 'HW'
        // Define isBothProject for the steps below.
        const isBothProject = project.type === 'Both'

        // Check whether (isSWStudent && (isSWProject || isBothProject)) || (isHWStudent && (isHWProject || isBothProject)) before running this branch.
        if (
          (isSWStudent && (isSWProject || isBothProject)) ||
          (isHWStudent && (isHWProject || isBothProject))
        ) {
          majorTypeMatches++
        }
      }

      // Check whether student.class === '3200' before running this branch.
      if (student.class === '3200') {
        totalUpper++
        // Check whether prefIndex === 0 before running this branch.
        if (prefIndex === 0) upperFirstChoice++
        // Check whether prefIndex >= 0 && prefIndex <= 2 before running this branch.
        if (prefIndex >= 0 && prefIndex <= 2) upperTop3++
      } else {
        totalLower++
        // Check whether prefIndex === 0 before running this branch.
        if (prefIndex === 0) lowerFirstChoice++
        // Check whether prefIndex >= 0 && prefIndex <= 2 before running this branch.
        if (prefIndex >= 0 && prefIndex <= 2) lowerTop3++
      }
    }
  }

  // Pass { firstChoice, secondChoice, thirdChoice, fourthChoice, fifthChoice, sixthChoice, noMatch, upperFirs back to the caller.
  return {
    firstChoice,
    secondChoice,
    thirdChoice,
    fourthChoice,
    fifthChoice,
    sixthChoice,
    noMatch,
    upperFirstChoice,
    upperTop3,
    totalUpper,
    lowerFirstChoice,
    lowerTop3,
    totalLower,
    majorTypeMatches,
    totalStudents,
    avgTeamSize: teamSizes.reduce((a, b) => a + b, 0) / teamSizes.length,
    minTeamSize: Math.min(...teamSizes),
    maxTeamSize: Math.max(...teamSizes),
  }
}

// Define the helper that will validate constraints.
function validateConstraints(teams: Record<string, Student[]>, allStudents: Student[]): string[] {
  // Define violations for the steps below.
  const violations: string[] = []

  // Check all students assigned
  const assignedCount = Object.values(teams).flat().length
  // Check whether assignedCount !== allStudents.length before running this branch.
  if (assignedCount !== allStudents.length) {
    // Call violations.push to run this step.
    violations.push(`Not all students assigned: ${assignedCount}/${allStudents.length}`)
  }

  // Check no duplicates
  const assignedIds = new Set<string>()
  // Repeat the following steps for each item in Object.values(teams).
  for (const team of Object.values(teams)) {
    // Repeat the following steps for each item in team.
    for (const student of team) {
      // Check whether assignedIds.has(student.id) before running this branch.
      if (assignedIds.has(student.id)) {
        // Call violations.push to run this step.
        violations.push(`Student ${student.name} assigned to multiple teams`)
      }
      // Call assignedIds.add to run this step.
      assignedIds.add(student.id)
    }
  }

  // Check team constraints
  for (const [projectName, team] of Object.entries(teams)) {
    // Check team size against config constraints (min: 4, max: 6)
    const minSize = 4
    // Define maxSize for the steps below.
    const maxSize = 6

    // Check whether team.length < minSize before running this branch.
    if (team.length < minSize) {
      // Call violations.push to run this step.
      violations.push(`Team "${projectName}" too small (${team.length} < ${minSize})`)
    }
    // Check whether team.length > maxSize before running this branch.
    if (team.length > maxSize) {
      // Call violations.push to run this step.
      violations.push(`Team "${projectName}" too large (${team.length} > ${maxSize})`)
    }

    // Check day matching
    const project = testProjects.find((p) => p.name === projectName)
    // Check whether project?.day before running this branch.
    if (project?.day) {
      // Repeat the following steps for each item in team.
      for (const student of team) {
        // Check whether student.day && student.day !== project.day before running this branch.
        if (student.day && student.day !== project.day) {
          // Call violations.push to run this step.
          violations.push(
            `Student ${student.name} (${student.day}) assigned to "${projectName}" (${project.day})`
          )
        }
      }
    }
  }

  // Pass violations back to the caller.
  return violations
}

// Run the test
runTest().catch((error) => {
  // Call console.error to run this step.
  console.error('Test failed:', error)
  // Call process.exit to run this step.
  process.exit(1)
})
