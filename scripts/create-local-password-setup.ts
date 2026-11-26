/**
 * Purpose
 * Run the create local password setup maintenance task.
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
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { prisma } from '../server/utils/prisma'
// Define the helper that will main.
async function main() {
  // Define admins for the steps below.
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, include: { accounts: { where: { providerId: 'credential' } } } })
  // Check whether admins.length !== 1 before running this branch.
  if (admins.length !== 1) throw new Error('Choose the owner account explicitly; this database does not have exactly one administrator.')
  // Define owner for the steps below.
  const owner = admins[0]!
  // Check whether owner.accounts.some(account => account.password) before running this branch.
  if (owner.accounts.some(account => account.password)) throw new Error('The administrator already has a password. Sign in with the existing password.')
  // Use randomBytes(32).toString to initialize token.
  const token = randomBytes(32).toString('hex')
  await prisma.verification.create({ data: { identifier: `reset-password:${token}`, value: owner.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } })
  // Call console.log to run this step.
  console.log(JSON.stringify({ setupUrl: `http://127.0.0.1:3000/auth#setup=${token}&email=${encodeURIComponent(owner.email)}` }))
}
// Call main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally to run this step.
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
