/**
 * Purpose
 * Provide the errors logic used by other parts of ESA.
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
/** The message buried in a `$fetch` rejection, falling back when the server sent nothing useful. */
export function errorMessage(error: any, fallback = 'Something went wrong.') {
  // Pass error?.data?.message ?? error?.message ?? fallback back to the caller.
  return error?.data?.message ?? error?.message ?? fallback
}
