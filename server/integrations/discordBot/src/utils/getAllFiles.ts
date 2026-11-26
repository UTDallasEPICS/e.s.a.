/**
 * Purpose
 * Provide the get all files logic used by other parts of ESA.
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
//A re-useable function sometimes called by other functions that will
//return the current filestructure of a given file tree.

import * as fs from 'fs'
import * as path from 'path'

// Define getAllFiles for the steps below.
const getAllFiles = (directory: string, foldersOnly: boolean = false): string[] => {
  // Array to store file names
  let fileNames: string[] = []

  // Import any files/folders inside a specific directory
  const files: fs.Dirent[] = fs.readdirSync(directory, { withFileTypes: true })

  // Loop for checking if something is a file or a folder
  for (const file of files) {
    // Use path.join to initialize filePath.
    const filePath = path.join(directory, file.name)

    // Check whether foldersOnly before running this branch.
    if (foldersOnly) {
      // If a file is a folder:
      if (file.isDirectory()) {
        // Call fileNames.push to run this step.
        fileNames.push(filePath)
      }
    } else {
      // If a file is a file:
      if (file.isFile()) {
        // Call fileNames.push to run this step.
        fileNames.push(filePath)
      }
    }
  }

  // Pass fileNames back to the caller.
  return fileNames
}

export default getAllFiles
