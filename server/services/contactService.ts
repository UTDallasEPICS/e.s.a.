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

const getContactById = async (id: string): Promise<ContactRead | null> => {
  const contact = await prisma.contact.findUnique({
    where: { id },
  })
  return contact
}

const createContact = async (data: ContactCreate): Promise<ContactRead> => {
  return await prisma.$transaction(async (tx) => {
    const existingContactCount = await tx.contact.count({ where: { partnerId: data.partnerId } })
    return await tx.contact.create({
      data: { ...data, isPrimary: existingContactCount === 0 },
    })
  })
}

const updateContact = async (id: string, data: ContactUpdate): Promise<ContactRead> => {
  if (data.isPrimary) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUniqueOrThrow({ where: { id } })
      await tx.contact.updateMany({
        where: { partnerId: existing.partnerId, id: { not: id } },
        data: { isPrimary: false },
      })
      return await tx.contact.update({ where: { id }, data })
    })
  }

  const contact = await prisma.contact.update({
    where: { id },
    data,
  })
  return contact
}

const deleteContact = async (id: string): Promise<void> => {
  await prisma.contact.delete({ where: { id } })
}

const contactService = {
  getContactById,
  createContact,
  updateContact,
  deleteContact,
}

export default contactService
