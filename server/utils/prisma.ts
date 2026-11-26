/**
 * Purpose
 * Provide the prisma logic used by other parts of ESA.
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
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../prisma/generated/client'

// Define connectionString for the steps below.
const connectionString = `${process.env.DATABASE_URL}`

// Define adapter for the steps below.
const adapter = new PrismaBetterSqlite3({ url: connectionString })
// Define prisma for the steps below.
const prisma = new PrismaClient({ adapter })

export { prisma }
