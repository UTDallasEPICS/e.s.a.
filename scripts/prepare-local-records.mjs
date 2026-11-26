/**
 * Purpose: Create an empty workspace on a fresh checkout without replacing real records.
 * Inputs: The empty example data and any existing private local import.
 * Outputs: The ignored verified-data.json file used by the app.
 * Pseudocode: Try to copy the starter data. Keep the local file if it already exists.
 */
import { constants } from 'node:fs'
import { copyFile } from 'node:fs/promises'

try {
  await copyFile(
    new URL('../app/components/verified-data.example.json', import.meta.url),
    new URL('../app/components/verified-data.json', import.meta.url),
    constants.COPYFILE_EXCL
  )
} catch (error) {
  if (error.code !== 'EEXIST') throw error
}
