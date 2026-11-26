/**
 * Purpose
 * Provide the bid csv logic used by other parts of ESA.
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
// Parsing/validation for the UTDesign/EPICS student bid CSV, mirroring the row shape
// expected by server/api/team-formation/bids.post.ts.

export function parseCsv(text: string): Record<string, string>[] {
  // Define rows for the steps below.
  const rows: string[][] = []
  // Define field for the steps below.
  let field = ''
  // Define row for the steps below.
  let row: string[] = []
  // Define inQuotes for the steps below.
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    // Define char for the steps below.
    const char = text[i]

    // Check whether inQuotes before running this branch.
    if (inQuotes) {
      // Check whether char === '"' before running this branch.
      if (char === '"') {
        // Check whether text[i + 1] === '"' before running this branch.
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          // Update inQuotes with the value on the right.
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    // Check whether char === '"' before running this branch.
    if (char === '"') {
      // Update inQuotes with the value on the right.
      inQuotes = true
    } else if (char === ',') {
      // Call row.push to run this step.
      row.push(field)
      // Update field with the value on the right.
      field = ''
    } else if (char === '\n' || char === '\r') {
      // Check whether char === '\r' && text[i + 1] === '\n' before running this branch.
      if (char === '\r' && text[i + 1] === '\n') i++
      // Call row.push to run this step.
      row.push(field)
      // Update field with the value on the right.
      field = ''
      // Check whether row.some((v) => v !== '') before running this branch.
      if (row.some((v) => v !== '')) rows.push(row)
      // Update row with the value on the right.
      row = []
    } else {
      field += char
    }
  }
  // Check whether field !== '' || row.length before running this branch.
  if (field !== '' || row.length) {
    // Call row.push to run this step.
    row.push(field)
    // Check whether row.some((v) => v !== '') before running this branch.
    if (row.some((v) => v !== '')) rows.push(row)
  }

  // Check whether !rows.length before running this branch.
  if (!rows.length) return []
  // Use rows[0]!.map to initialize header.
  const header = rows[0]!.map((h) => h.trim())
  // Pass rows.slice(1).map((r) => { const obj: Record<string, string> = {} header.forEach((h, i) => { obj[h]  back to the caller.
  return rows.slice(1).map((r) => {
    // Define obj for the steps below.
    const obj: Record<string, string> = {}
    // Call header.forEach to run this step.
    header.forEach((h, i) => {
      // Update obj[h] with the value on the right.
      obj[h] = (r[i] ?? '').trim()
    })
    // Pass obj back to the caller.
    return obj
  })
}

// Define NAME_KEYS for the steps below.
const NAME_KEYS = ['Student Name', 'Name', 'Full Name', 'Student', 'student name', 'name']
// Define NETID_KEYS for the steps below.
const NETID_KEYS = ['SSO ID', 'ssoid', 'netID', 'netid', 'id']
// Define CLASSIFICATION_KEYS for the steps below.
const CLASSIFICATION_KEYS = ['Classification', 'classification']
// Define ENROLLMENT_KEYS for the steps below.
const ENROLLMENT_KEYS = ['Enrollment', 'enrollment']
// Define MAJOR_KEYS for the steps below.
const MAJOR_KEYS = ['School and Major', 'school and major', 'major']
// Define GENDER_KEYS for the steps below.
const GENDER_KEYS = ['Gender', 'gender']

// Define VALID_CLASSIFICATIONS for the steps below.
const VALID_CLASSIFICATIONS = new Set(['freshman', 'sophomore', 'junior', 'senior'])
// Define VALID_GENDERS for the steps below.
const VALID_GENDERS = new Set(['male', 'female', 'non-binary', 'prefer not to say'])

// Define the helper that will read first.
function readFirst(row: Record<string, string>, keys: string[]): string {
  // Repeat the following steps for each item in keys.
  for (const key of keys) {
    // Define value for the steps below.
    const value = row[key]
    // Check whether value before running this branch.
    if (value) return value
  }
  // Pass '' back to the caller.
  return ''
}

export interface BidRowError {
  row: number
  message: string
}

export interface BidValidationResult {
  errors: BidRowError[]
  missingColumns: string[]
  rowCount: number
}

// Define REQUIRED_COLUMN_GROUPS for the steps below.
const REQUIRED_COLUMN_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Student Name', keys: NAME_KEYS },
  { label: 'SSO ID', keys: NETID_KEYS },
  { label: 'Classification', keys: CLASSIFICATION_KEYS },
  { label: 'Enrollment', keys: ENROLLMENT_KEYS },
  { label: 'School and Major', keys: MAJOR_KEYS },
  { label: 'Gender', keys: GENDER_KEYS },
]

// Define the helper that will validate bid rows.
export function validateBidRows(rows: Record<string, string>[]): BidValidationResult {
  // Check whether !rows.length before running this branch.
  if (!rows.length) {
    // Pass { errors: [{ row: 0, message: 'File contains no data rows.' }], missingColumns: [], rowCount: 0, } back to the caller.
    return {
      errors: [{ row: 0, message: 'File contains no data rows.' }],
      missingColumns: [],
      rowCount: 0,
    }
  }

  // Define header for the steps below.
  const header = new Set(Object.keys(rows[0]!))
  // Use REQUIRED_COLUMN_GROUPS.filter( (group) => !group.keys.some((k) => header.has(k)) ).map to initialize missingColumns.
  const missingColumns = REQUIRED_COLUMN_GROUPS.filter(
    (group) => !group.keys.some((k) => header.has(k))
  ).map((group) => group.label)

  // Check whether missingColumns.length before running this branch.
  if (missingColumns.length) {
    // Pass { errors: [], missingColumns, rowCount: rows.length } back to the caller.
    return { errors: [], missingColumns, rowCount: rows.length }
  }

  // Define errors for the steps below.
  const errors: BidRowError[] = []
  // Define seenNetIds for the steps below.
  const seenNetIds = new Set<string>()

  // Call rows.forEach to run this step.
  rows.forEach((row, idx) => {
    // Define rowNum for the steps below.
    const rowNum = idx + 2 // account for header row + 1-index
    // Use readFirst to initialize name.
    const name = readFirst(row, NAME_KEYS)
    // Use readFirst to initialize netID.
    const netID = readFirst(row, NETID_KEYS)
    // Use readFirst to initialize classification.
    const classification = readFirst(row, CLASSIFICATION_KEYS)
    // Use readFirst to initialize enrollment.
    const enrollment = readFirst(row, ENROLLMENT_KEYS)
    // Use readFirst to initialize major.
    const major = readFirst(row, MAJOR_KEYS)
    // Use readFirst to initialize gender.
    const gender = readFirst(row, GENDER_KEYS)

    // Check whether !name before running this branch.
    if (!name) errors.push({ row: rowNum, message: 'Missing Student Name.' })
    // if (!netID) {
    //   errors.push({ row: rowNum, message: 'Missing SSO ID.' })
    // } else if (seenNetIds.has(netID)) {
    //   errors.push({ row: rowNum, message: `Duplicate SSO ID "${netID}".` })
    // } else {
    //   seenNetIds.add(netID)
    // }
    // if (!classification) {
    //   errors.push({ row: rowNum, message: 'Missing Classification.' })
    // } else if (!VALID_CLASSIFICATIONS.has(classification.trim().toLowerCase())) {
    //   errors.push({ row: rowNum, message: `Unrecognized Classification "${classification}".` })
    // }
    // if (!enrollment) {
    //   errors.push({ row: rowNum, message: 'Missing Enrollment.' })
    // } else if (!/(2200|3200)/.test(enrollment)) {
    //   errors.push({
    //     row: rowNum,
    //     message: `Unrecognized Enrollment "${enrollment}" (expected 2200 or 3200).`,
    //   })
    // }
    // if (!major) errors.push({ row: rowNum, message: 'Missing School and Major.' })
    // if (!gender) {
    //   errors.push({ row: rowNum, message: 'Missing Gender.' })
    // } else if (!VALID_GENDERS.has(gender.trim().toLowerCase())) {
    //   errors.push({ row: rowNum, message: `Unrecognized Gender "${gender}".` })
    // }
  })

  // Pass { errors, missingColumns: [], rowCount: rows.length } back to the caller.
  return { errors, missingColumns: [], rowCount: rows.length }
}
