/**
 * Purpose
 * Provide the contact service logic used by other parts of ESA.
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
import { prisma } from '#server/utils/prisma'

export interface ContactRead {
  id: string
  partnerId: string
  name: string
  email: string
  phone: string | null
  isPrimary: boolean
}

export interface ContactCreate {
  partnerId: string
  name: string
  email: string
  phone?: string | null
  isPrimary?: boolean
}

export interface ContactUpdate {
  name?: string
  email?: string
  phone?: string | null
  isPrimary?: boolean
}

// Define getContactById for the steps below.
const getContactById = async (id: string): Promise<ContactRead | null> => {
  // Define contact for the steps below.
  const contact = await prisma.contact.findUnique({
    where: { id },
  })
  // Pass contact back to the caller.
  return contact
}

// Define createContact for the steps below.
const createContact = async (data: ContactCreate): Promise<ContactRead> => {
  // Pass await prisma.$transaction(async (tx) => { const existingContactCount = await tx.contact.count({ wher back to the caller.
  return await prisma.$transaction(async (tx) => {
    // Define existingContactCount for the steps below.
    const existingContactCount = await tx.contact.count({ where: { partnerId: data.partnerId } })
    // Pass await tx.contact.create({ data: { ...data, isPrimary: existingContactCount === 0 }, }) back to the caller.
    return await tx.contact.create({
      data: { ...data, isPrimary: existingContactCount === 0 },
    })
  })
}

// Define updateContact for the steps below.
const updateContact = async (id: string, data: ContactUpdate): Promise<ContactRead> => {
  // Check whether data.isPrimary before running this branch.
  if (data.isPrimary) {
    // Pass await prisma.$transaction(async (tx) => { const existing = await tx.contact.findUniqueOrThrow({ wher back to the caller.
    return await prisma.$transaction(async (tx) => {
      // Define existing for the steps below.
      const existing = await tx.contact.findUniqueOrThrow({ where: { id } })
      await tx.contact.updateMany({
        where: { partnerId: existing.partnerId, id: { not: id } },
        data: { isPrimary: false },
      })
      // Pass await tx.contact.update({ where: { id }, data }) back to the caller.
      return await tx.contact.update({ where: { id }, data })
    })
  }

  // Define contact for the steps below.
  const contact = await prisma.contact.update({
    where: { id },
    data,
  })
  // Pass contact back to the caller.
  return contact
}

// Define deleteContact for the steps below.
const deleteContact = async (id: string): Promise<void> => {
  await prisma.contact.delete({ where: { id } })
}

// Define contactService for the steps below.
const contactService = {
  getContactById,
  createContact,
  updateContact,
  deleteContact,
}

export default contactService
