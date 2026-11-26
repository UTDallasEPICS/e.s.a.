/**
 * Purpose
 * Handle requests for the profile API operation.
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
import fs from 'node:fs'
import path from 'node:path'

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

  // Use getRouterParam to initialize userId.
  const userId = getRouterParam(event, 'id')

  // Check whether !userId before running this branch.
  if (!userId) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  // Define record for the steps below.
  const record = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      image: true,
    },
  })

  // Define imagePath for the steps below.
  const imagePath = record?.image

  // Use path.join to initialize filePath.
  const filePath = path.join(
    process.env.UPLOAD_STORAGE_PATH || 'public/images',
    imagePath || 'null'
  )

  // Check whether !fs.existsSync(filePath) before running this branch.
  if (!fs.existsSync(filePath)) {
    // Stop this operation and tell the caller why it cannot continue.
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  // Use fs.createReadStream to initialize fileStream.
  const fileStream = fs.createReadStream(filePath)

  // Set content type based on file extension
  // const ext = path.extname(filePath).toLowerCase()

  // Defaults to octet stream as file types are NOT saved
  // const mime =
  //   ext === ".png" ? "image/png" :
  //   ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
  //   ext === ".gif" ? "image/gif" :
  //   ext === ".webp" ? "image/webp" :
  //   "application/octet-stream"

  setHeader(event, 'Content-Type', 'application/octet-stream')

  // Pass sendStream(event, fileStream) back to the caller.
  return sendStream(event, fileStream)
})
