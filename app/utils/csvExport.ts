/**
 * Purpose
 * Provide the csv export logic used by other parts of ESA.
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
// Define the helper that will csv cell.
function csvCell(value: string): string {
  // Pass /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value back to the caller.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Define the helper that will rows to csv.
export function rowsToCsv(rows: string[][]): string {
  // Pass rows.map((row) => row.map(csvCell).join(',')).join('\n') back to the caller.
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

// Define the helper that will download csv.
export function downloadCsv(filename: string, rows: string[][]): void {
  // Define blob for the steps below.
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  // Use URL.createObjectURL to initialize url.
  const url = URL.createObjectURL(blob)
  // Use document.createElement to initialize anchor.
  const anchor = document.createElement('a')
  // Update anchor.href with the value on the right.
  anchor.href = url
  // Update anchor.download with the value on the right.
  anchor.download = filename
  // Call anchor.click to run this step.
  anchor.click()
  // Call URL.revokeObjectURL to run this step.
  URL.revokeObjectURL(url)
}
