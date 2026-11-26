/**
 * Purpose
 * Handle requests for the upload API operation.
 *
 * Inputs
 * - Request parameters, body, and any session required by the handler.
 *
 * Outputs
 * - The operation’s response or an error with an HTTP status.
 *
 * Pseudocode
 * Read the request → apply the handler’s checks → call the matching operation → return its result.
 */
import path from 'path'
import fs from 'fs'
import { prisma } from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  // Define session for the steps below.
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  // Check whether !session before running this branch.
  if (!session) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Define form for the steps below.
  const form = await readMultipartFormData(event)

  // Check whether !form before running this branch.
  if (!form) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'No form data' })
  }

  // Use form.find to initialize file.
  const file = form.find((i) => i.name === 'file')

  // Check whether !file || !file.data before running this branch.
  if (!file || !file.data) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'File missing' })
  }

  // Use path.join to initialize dirPath.
  const dirPath = path.join(
    process.env.UPLOAD_STORAGE_PATH || 'public/images',
    'users',
    session.user.id,
    'images'
  )

  // Check whether !fs.existsSync(dirPath) before running this branch.
  if (!fs.existsSync(dirPath)) {
    // Call fs.mkdirSync to run this step.
    fs.mkdirSync(dirPath, { recursive: true })
  }

  // Use crypto.randomUUID to initialize randomImageId.
  const randomImageId = crypto.randomUUID()

  // Use path.join to initialize filePath.
  const filePath = path.join(dirPath, randomImageId)

  // Check whether fs.existsSync(filePath) before running this branch.
  if (fs.existsSync(filePath)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, message: 'Image already exists.' })
  }

  await fs.writeFile(filePath, file.data, (err) => {
    // Check whether err before running this branch.
    if (err) throw err
  })

  // Store the generated image ID in the database as required
  const addedImage = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      image: path.join('users', session.user.id, 'images', randomImageId),
    },
  })

  // Call console.log to run this step.
  console.log(addedImage)

  // Call setResponseStatus to run this step.
  setResponseStatus(event, 201)

  // Pass { message: 'Added profile picture to logged in user.', } back to the caller.
  return {
    message: 'Added profile picture to logged in user.',
  }
})
