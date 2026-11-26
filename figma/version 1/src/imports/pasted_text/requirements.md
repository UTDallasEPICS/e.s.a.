Info from 09/09 [ignore teambuilding part]
Goals:
tie projects to project partners
keep track of mentors on projects across semesters
EPICs projects should store students across semesters
andrea should be able to filter across these apps easily, so she can access info,
should be able to come up with insights from this data (maybe have export as pdf function if she needs to send to others)

Additional Things to Consider:
1 project partner can have multiple projects
projects have multiple semesters (continuation)
each semester has multiple students, mentor (maybe figure out a way to log this)
⟶ query: sorting, be able to see any semester and projects and see all students, what they did, how many semesters, how many projects they did, etc
⟶ additional details for these cases include:
Demographics
average project completion length
Contact information

Problem:
our issue is with query and insights

What we want to achieve
condensed into requirements put into file

Me and lamiah: verify if database is set up properly or not
if tables r laid out properly, normalizations: diff levels, normal fomr
⟶ 4-5 levels of nfs, higher u go more normalized it is->table of data but have to make sure, lots of redundant table data, normalization takes the table into multiple tables to relate them with one another make data less redundant, makes it easier for updating across tables

make sure there's no redundant data, shape of database -> tables need to be made sure to have no update anomalies
current database is properly set up, if it is, how is it set up, why is it not set up properly

next week i need: verifying and being expert on database

[database needs to be set up properly so that insights can update automatically, sorting algorithm: benchmark where we are with current algo, means that we want to see how it compares to teams last sems, get inputs and outputs from them,
input: bids -> wed,thu
2 kinds of outputs: teams 1 (regular), teams 2(new ppl joining, dropping, cancelled projects, new added projects)
figure out and get two sets of teams for summer and fall 26,
how bad/good are those teams compared to the others.

sorting algorithms: brainstorm ways of mixing llm and deterministic algo together to remove hallucinations, rns..?
]

translate this into requirements

esa->database,teambuilding->come up with functional/nonfunctional requirements
db and what database enables, query and insinght is functional requirements, the quality is nonfunctional

tb -> seeing where we are is non funct, oneshotting team 1, make sure no one edits team 1, should react on output of teams (dropping, entereing class, etc) -> figure out how to get

Findings for 09/16

-the core database structure is pretty good. Student, enrollment, semester, project, team, partner, contact, choice, membership are separated into their related tables and do not repeat info
-student and enrollment correctly separate identity info from the semester info
-normalization/query issue is prevalent in the skills part, as all the skills are stored in one string, would be annoying to get query for
-data model shows clear demographics: gender, major, year, class are in enrollment, can be queried using semesterId
-prisma studio: studentId, semesterId, gender, major, year, class, meetingDay, skills, comments
-structure of partner/contacts are good; uses partnerId to store info, but can choose many primary contacts per partner
-choice table is structured well for insights; studentId, projectId, semesterId, rank
-team is structured well: connects to projectId and semesterId -> can represent project across multiple semesters
-student query filters students by semester, getAllstudents(semesterId) finds students in specific semester
-student_include retrieves all enrollments and choices, finds correct enrollment thru semesterId
-maybe we should query the semester specific records directly instead of thru enrollment..?
-createdAt/updatedAt is used as project start/completion dates
-checking project completion length is not the most clear, as database only shows the current status, and our returning project only found one team semester in the current data
-only database seems to be missing all the historical project-semester records
-membership is empty; we cannot get insight on the percentage of students assigned their first choice project
-noticed that isMentor is on both student and membership -> redundant…? (when one qualifies for both)
-major is freeform; could cause issues for query when someone mispells/abbreviates their major…?
-database structure is: studentsTab.vue -> students API -> studentService -> Prisma -> Database
-backend goes: GET /api/students?semesterId -> index.get.ts -> getQuery() [retrieves semesterId] -> studentService.getAllStudents(semesterId) -> prisma.student.findMany() -> student, enrollment, choice, membership

-

Student: student’s identity info
Enrollment: connects student to a specific semester and shows their major, year, class, gender, meeting day, skills during that semester
Project: belongs to partners
Team: Project that is operating in a specific semester
Membership: connects students to those teams
Choice: stores each student’s ranked project preferences during that semester

Info from 9/16
Focus on UI
As user friendly as possible;
LLM for insights -> LLM interface that creates charts..?(also filtering)
Figma fein
Sorting and filters, find a way for query based on her needs
Check to see if an LLM could help, maybe like a chat assistant and have the little robot check the database instead
Penicia (google it)
Right now it is filtering out what is in the front end
Think about format/layout
Redesign + LLM integration
Page for insights, demo graphic information → export button? For collective data
Unify individual on one page instead and use filters (for maybe)

Main Goal by the End of Semester
Want UI/UX for looking at/interacting with database to be complete
Come up with design, have it approved and refined by Andrea
Come up with examples, email/schedule meetings with her outside of lab for additional input
Come up with maybe 3 ex by the end of the week (use things like canva/or.. Other platforms to come up with stuff)
