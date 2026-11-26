export type Semester = {
  id: string
  label: string
  year: number
  term: 'Fall' | 'Spring' | 'Summer'
}
export type Partner = {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  activeProjects: number
}
export type Project = {
  id: string
  name: string
  partnerId: string
  status: 'Active' | 'Completed' | 'Paused'
  description: string
  semesters: string[]
}
export type Student = {
  id: string
  name: string
  email: string
  gender: string
  major: string
  year: string
  class: string
  skills: string[]
  semesters: string[]
  projects: string[]
  isMentor: boolean
  meetingDay: string
}
export type Team = {
  id: string
  projectId: string
  semesterId: string
  mentorId: string
  studentIds: string[]
}
export type Choice = { studentId: string; projectId: string; semesterId: string; rank: number }

export const semesters: Semester[] = [
  { id: 'FA24', label: 'Fall 2024', year: 2024, term: 'Fall' },
  { id: 'SP25', label: 'Spring 2025', year: 2025, term: 'Spring' },
  { id: 'SU25', label: 'Summer 2025', year: 2025, term: 'Summer' },
  { id: 'FA25', label: 'Fall 2025', year: 2025, term: 'Fall' },
  { id: 'SP26', label: 'Spring 2026', year: 2026, term: 'Spring' },
]

export const partners: Partner[] = [
  {
    id: 'P1',
    name: 'City Food Bank',
    contact: 'Maria Chen',
    email: 'mchen@cityfoodbank.org',
    phone: '(555) 201-3344',
    activeProjects: 2,
  },
  {
    id: 'P2',
    name: 'Habitat for Humanity',
    contact: 'James Okafor',
    email: 'jokafor@habitat.org',
    phone: '(555) 402-7788',
    activeProjects: 1,
  },
  {
    id: 'P3',
    name: 'Greenway Urban Farm',
    contact: 'Priya Nair',
    email: 'pnair@greenway.org',
    phone: '(555) 509-1122',
    activeProjects: 3,
  },
  {
    id: 'P4',
    name: 'Riverside Literacy Center',
    contact: 'Tom Bradley',
    email: 'tbradley@riverside.org',
    phone: '(555) 608-4456',
    activeProjects: 1,
  },
  {
    id: 'P5',
    name: 'Tech Access Initiative',
    contact: 'Aisha Kamara',
    email: 'akamara@techaccess.org',
    phone: '(555) 712-9900',
    activeProjects: 2,
  },
]

export const projects: Project[] = [
  {
    id: 'PR1',
    name: 'Inventory Tracking System',
    partnerId: 'P1',
    status: 'Active',
    description: 'Web app to manage food bank inventory, donations, and distributions.',
    semesters: ['FA24', 'SP25', 'FA25'],
  },
  {
    id: 'PR2',
    name: 'Volunteer Scheduling App',
    partnerId: 'P1',
    status: 'Active',
    description: 'Mobile-friendly tool for coordinating volunteer shifts.',
    semesters: ['SP25', 'SU25', 'FA25'],
  },
  {
    id: 'PR3',
    name: 'Build Cost Estimator',
    partnerId: 'P2',
    status: 'Completed',
    description: 'Tool for estimating housing project costs and timelines.',
    semesters: ['FA24', 'SP25'],
  },
  {
    id: 'PR4',
    name: 'Crop Yield Dashboard',
    partnerId: 'P3',
    status: 'Active',
    description: 'Data visualization for tracking crop yield and seasonal performance.',
    semesters: ['FA24', 'SP25', 'SU25', 'FA25'],
  },
  {
    id: 'PR5',
    name: 'Soil Sensor IoT',
    partnerId: 'P3',
    status: 'Active',
    description: 'Raspberry Pi-based sensors reporting soil data to cloud dashboard.',
    semesters: ['SP25', 'FA25'],
  },
  {
    id: 'PR6',
    name: 'Composting Tracker',
    partnerId: 'P3',
    status: 'Paused',
    description: 'Track compost batches, inputs, and outputs.',
    semesters: ['FA24'],
  },
  {
    id: 'PR7',
    name: 'Reading Progress Platform',
    partnerId: 'P4',
    status: 'Active',
    description: 'Platform for tracking student reading progress and tutor notes.',
    semesters: ['SU25', 'FA25', 'SP26'],
  },
  {
    id: 'PR8',
    name: 'Device Refurb Tracker',
    partnerId: 'P5',
    status: 'Active',
    description: 'Track donated device intake, refurbishment, and distribution.',
    semesters: ['SP25', 'FA25', 'SP26'],
  },
  {
    id: 'PR9',
    name: 'Digital Skills Curriculum',
    partnerId: 'P5',
    status: 'Active',
    description: 'E-learning modules for digital literacy training.',
    semesters: ['FA25', 'SP26'],
  },
]

export const students: Student[] = [
  {
    id: 'S01',
    name: 'Aaliyah Torres',
    email: 'atorres@uni.edu',
    gender: 'F',
    major: 'Computer Science',
    year: '3rd',
    class: 'Junior',
    skills: ['React', 'Python', 'SQL'],
    semesters: ['FA24', 'SP25', 'FA25'],
    projects: ['PR1', 'PR4'],
    isMentor: true,
    meetingDay: 'Tuesday',
  },
  {
    id: 'S02',
    name: 'Ben Nakamura',
    email: 'bnakamura@uni.edu',
    gender: 'M',
    major: 'Electrical Engineering',
    year: '2nd',
    class: 'Sophomore',
    skills: ['Arduino', 'C++', 'IoT'],
    semesters: ['SP25', 'FA25'],
    projects: ['PR5'],
    isMentor: false,
    meetingDay: 'Thursday',
  },
  {
    id: 'S03',
    name: 'Carmen Diaz',
    email: 'cdiaz@uni.edu',
    gender: 'F',
    major: 'Computer Science',
    year: '4th',
    class: 'Senior',
    skills: ['Vue', 'Node.js', 'PostgreSQL'],
    semesters: ['FA24', 'SP25', 'SU25', 'FA25'],
    projects: ['PR2', 'PR4'],
    isMentor: true,
    meetingDay: 'Wednesday',
  },
  {
    id: 'S04',
    name: 'David Osei',
    email: 'dosei@uni.edu',
    gender: 'M',
    major: 'Mechanical Engineering',
    year: '3rd',
    class: 'Junior',
    skills: ['CAD', 'Python', 'MATLAB'],
    semesters: ['FA24', 'SP25'],
    projects: ['PR3'],
    isMentor: false,
    meetingDay: 'Monday',
  },
  {
    id: 'S05',
    name: 'Elena Popova',
    email: 'epopova@uni.edu',
    gender: 'F',
    major: 'Information Systems',
    year: '2nd',
    class: 'Sophomore',
    skills: ['SQL', 'Tableau', 'Excel'],
    semesters: ['SU25', 'FA25'],
    projects: ['PR7', 'PR8'],
    isMentor: false,
    meetingDay: 'Tuesday',
  },
  {
    id: 'S06',
    name: 'Felix Huang',
    email: 'fhuang@uni.edu',
    gender: 'M',
    major: 'Computer Science',
    year: '3rd',
    class: 'Junior',
    skills: ['React', 'TypeScript', 'AWS'],
    semesters: ['SP25', 'SU25', 'FA25', 'SP26'],
    projects: ['PR2', 'PR9'],
    isMentor: true,
    meetingDay: 'Wednesday',
  },
  {
    id: 'S07',
    name: 'Grace Mensah',
    email: 'gmensah@uni.edu',
    gender: 'F',
    major: 'Environmental Engineering',
    year: '4th',
    class: 'Senior',
    skills: ['Python', 'R', 'Data Analysis'],
    semesters: ['FA24', 'SP25', 'SU25'],
    projects: ['PR4', 'PR6'],
    isMentor: true,
    meetingDay: 'Thursday',
  },
  {
    id: 'S08',
    name: 'Hiro Tanaka',
    email: 'htanaka@uni.edu',
    gender: 'M',
    major: 'Computer Science',
    year: '1st',
    class: 'Freshman',
    skills: ['JavaScript', 'HTML/CSS'],
    semesters: ['FA25', 'SP26'],
    projects: ['PR9'],
    isMentor: false,
    meetingDay: 'Monday',
  },
  {
    id: 'S09',
    name: 'Isabel Reyes',
    email: 'ireyes@uni.edu',
    gender: 'F',
    major: 'Biomedical Engineering',
    year: '3rd',
    class: 'Junior',
    skills: ['Python', 'MATLAB', 'Lab Skills'],
    semesters: ['SP25', 'FA25', 'SP26'],
    projects: ['PR1', 'PR7'],
    isMentor: false,
    meetingDay: 'Tuesday',
  },
  {
    id: 'S10',
    name: 'Jordan Kim',
    email: 'jkim@uni.edu',
    gender: 'NB',
    major: 'Computer Science',
    year: '4th',
    class: 'Senior',
    skills: ['ML', 'Python', 'TensorFlow'],
    semesters: ['FA24', 'SP25', 'SU25', 'FA25', 'SP26'],
    projects: ['PR1', 'PR8'],
    isMentor: true,
    meetingDay: 'Wednesday',
  },
  {
    id: 'S11',
    name: 'Keisha Johnson',
    email: 'kjohnson@uni.edu',
    gender: 'F',
    major: 'Industrial Engineering',
    year: '2nd',
    class: 'Sophomore',
    skills: ['Excel', 'SQL', 'Lean'],
    semesters: ['FA25', 'SP26'],
    projects: ['PR8'],
    isMentor: false,
    meetingDay: 'Thursday',
  },
  {
    id: 'S12',
    name: "Liam O'Brien",
    email: 'lobrien@uni.edu',
    gender: 'M',
    major: 'Software Engineering',
    year: '3rd',
    class: 'Junior',
    skills: ['Java', 'Spring Boot', 'Docker'],
    semesters: ['SP25', 'FA25', 'SP26'],
    projects: ['PR2', 'PR9'],
    isMentor: false,
    meetingDay: 'Monday',
  },
  {
    id: 'S13',
    name: 'Maya Patel',
    email: 'mpatel@uni.edu',
    gender: 'F',
    major: 'Computer Science',
    year: '2nd',
    class: 'Sophomore',
    skills: ['Python', 'React', 'Firebase'],
    semesters: ['SU25', 'FA25'],
    projects: ['PR5'],
    isMentor: false,
    meetingDay: 'Tuesday',
  },
  {
    id: 'S14',
    name: 'Noah Williams',
    email: 'nwilliams@uni.edu',
    gender: 'M',
    major: 'Electrical Engineering',
    year: '4th',
    class: 'Senior',
    skills: ['FPGA', 'Verilog', 'C'],
    semesters: ['FA24', 'SP25'],
    projects: ['PR3'],
    isMentor: true,
    meetingDay: 'Wednesday',
  },
  {
    id: 'S15',
    name: 'Olivia Zhang',
    email: 'ozhang@uni.edu',
    gender: 'F',
    major: 'Computer Science',
    year: '3rd',
    class: 'Junior',
    skills: ['UX Design', 'Figma', 'React'],
    semesters: ['SU25', 'FA25', 'SP26'],
    projects: ['PR7', 'PR9'],
    isMentor: false,
    meetingDay: 'Thursday',
  },
  {
    id: 'S16',
    name: 'Paulo Santos',
    email: 'psantos@uni.edu',
    gender: 'M',
    major: 'Civil Engineering',
    year: '2nd',
    class: 'Sophomore',
    skills: ['AutoCAD', 'Revit'],
    semesters: ['FA24', 'SP25', 'FA25'],
    projects: ['PR3', 'PR4'],
    isMentor: false,
    meetingDay: 'Monday',
  },
  {
    id: 'S17',
    name: 'Quinn Davis',
    email: 'qdavis@uni.edu',
    gender: 'NB',
    major: 'Computer Science',
    year: '3rd',
    class: 'Junior',
    skills: ['React', 'GraphQL', 'MongoDB'],
    semesters: ['SP25', 'SU25', 'FA25', 'SP26'],
    projects: ['PR2', 'PR8'],
    isMentor: false,
    meetingDay: 'Tuesday',
  },
  {
    id: 'S18',
    name: 'Rahul Sharma',
    email: 'rsharma@uni.edu',
    gender: 'M',
    major: 'Computer Science',
    year: '4th',
    class: 'Senior',
    skills: ['ML', 'Python', 'Spark'],
    semesters: ['FA24', 'SP25', 'SU25', 'FA25', 'SP26'],
    projects: ['PR1', 'PR4'],
    isMentor: true,
    meetingDay: 'Wednesday',
  },
  {
    id: 'S19',
    name: 'Sofia Alvarez',
    email: 'salvarez@uni.edu',
    gender: 'F',
    major: 'Information Systems',
    year: '1st',
    class: 'Freshman',
    skills: ['HTML/CSS', 'JavaScript'],
    semesters: ['FA25', 'SP26'],
    projects: ['PR7'],
    isMentor: false,
    meetingDay: 'Thursday',
  },
  {
    id: 'S20',
    name: 'Tyler Brooks',
    email: 'tbrooks@uni.edu',
    gender: 'M',
    major: 'Software Engineering',
    year: '2nd',
    class: 'Sophomore',
    skills: ['React Native', 'JavaScript'],
    semesters: ['SU25', 'FA25', 'SP26'],
    projects: ['PR2', 'PR5'],
    isMentor: false,
    meetingDay: 'Monday',
  },
]

export const choices: Choice[] = [
  { studentId: 'S01', projectId: 'PR1', semesterId: 'FA24', rank: 1 },
  { studentId: 'S01', projectId: 'PR4', semesterId: 'FA25', rank: 1 },
  { studentId: 'S02', projectId: 'PR5', semesterId: 'SP25', rank: 1 },
  { studentId: 'S03', projectId: 'PR2', semesterId: 'SU25', rank: 2 },
  { studentId: 'S04', projectId: 'PR3', semesterId: 'FA24', rank: 1 },
  { studentId: 'S05', projectId: 'PR7', semesterId: 'SU25', rank: 1 },
  { studentId: 'S05', projectId: 'PR8', semesterId: 'FA25', rank: 1 },
  { studentId: 'S06', projectId: 'PR2', semesterId: 'SP25', rank: 1 },
  { studentId: 'S07', projectId: 'PR4', semesterId: 'FA24', rank: 1 },
  { studentId: 'S08', projectId: 'PR9', semesterId: 'FA25', rank: 2 },
  { studentId: 'S09', projectId: 'PR7', semesterId: 'SP25', rank: 1 },
  { studentId: 'S10', projectId: 'PR1', semesterId: 'FA24', rank: 1 },
  { studentId: 'S11', projectId: 'PR8', semesterId: 'FA25', rank: 1 },
  { studentId: 'S12', projectId: 'PR2', semesterId: 'SP25', rank: 1 },
  { studentId: 'S13', projectId: 'PR5', semesterId: 'SU25', rank: 2 },
  { studentId: 'S14', projectId: 'PR3', semesterId: 'FA24', rank: 1 },
  { studentId: 'S15', projectId: 'PR7', semesterId: 'SU25', rank: 1 },
  { studentId: 'S16', projectId: 'PR4', semesterId: 'FA24', rank: 2 },
  { studentId: 'S17', projectId: 'PR2', semesterId: 'SP25', rank: 1 },
  { studentId: 'S18', projectId: 'PR1', semesterId: 'FA24', rank: 1 },
  { studentId: 'S19', projectId: 'PR7', semesterId: 'FA25', rank: 1 },
  { studentId: 'S20', projectId: 'PR2', semesterId: 'SU25', rank: 1 },
]

export const getPartnerById = (id: string) => partners.find((p) => p.id === id)
export const getProjectById = (id: string) => projects.find((p) => p.id === id)
export const getStudentById = (id: string) => students.find((s) => s.id === id)
export const getSemesterLabel = (id: string) => semesters.find((s) => s.id === id)?.label ?? id
